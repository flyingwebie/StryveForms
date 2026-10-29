/**
 * Scheduled full-instance backups: "is a backup due right now", which old
 * runs to keep (retention), and a Postgres advisory lock so two API replicas
 * never start the same scheduled backup twice. Also owns the
 * `instance_settings.backup_settings` jsonb shape (destinations, schedule,
 * retention, the unattended passphrase) — this is where it's defined so
 * destinations.ts, instance-jobs.ts and routers/backup-admin.ts can all read
 * it the same way, even before engineer P's migration adds the real column
 * (see `resolveBackupSettings`, which works fine against an empty `{}`).
 */
import type { Database } from "@StryveForms/db";
import { instanceSettings } from "@StryveForms/db/schema/forms";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
	clearInstanceCache,
	getInstanceSettings,
	INSTANCE_ID,
} from "../instance";
import { S3_PRESET_IDS } from "./destinations";

export type { S3PresetId } from "./destinations";

/* -------------------------------------------------------------------------- */
/*                         instance_settings.backup_settings                 */
/* -------------------------------------------------------------------------- */

const serverDestinationSchema = z.object({
	id: z.string(),
	kind: z.literal("server"),
	label: z.string(),
	prefix: z.string().default("backups/"),
});

const s3DestinationSchema = z.object({
	accessKeyId: z.string(),
	bucket: z.string(),
	endpoint: z.string(),
	id: z.string(),
	kind: z.literal("s3"),
	label: z.string(),
	pathStyle: z.boolean(),
	prefix: z.string().default("backups/"),
	preset: z.enum(S3_PRESET_IDS),
	region: z.string(),
	/** AES-256-GCM, base64 — see destinations.ts `encryptDestinationSecret`. */
	secretAccessKeyEncrypted: z.string(),
});

export const destinationConfigSchema = z.discriminatedUnion("kind", [
	serverDestinationSchema,
	s3DestinationSchema,
]);

export type StoredDestinationConfig = z.infer<typeof destinationConfigSchema>;

export const backupScheduleSchema = z.object({
	enabled: z.boolean().default(false),
	frequency: z.enum(["daily", "weekly"]).default("daily"),
	/** Default destination id a scheduled/safety backup is sent to. */
	destinationId: z.string().nullable().default(null),
	/** "HH:MM", 24-hour, in `timezone`. */
	time: z.string().default("03:00"),
	/** IANA timezone name the schedule's `time` is interpreted in. */
	timezone: z.string().default("UTC"),
	/** 0 (Sunday) – 6 (Saturday). Only used when `frequency` is "weekly". */
	weekday: z.number().int().min(0).max(6).default(0),
});

export type BackupScheduleConfig = z.infer<typeof backupScheduleSchema>;

export const backupRetentionSchema = z.object({
	/** Keep the last N completed backups per destination. */
	keepLast: z.number().int().min(1).max(365).default(7),
});

export type BackupRetentionConfig = z.infer<typeof backupRetentionSchema>;

export const backupSettingsSchema = z.object({
	destinations: z.array(destinationConfigSchema).default([]),
	/**
	 * The unattended backup passphrase, encrypted with BETTER_AUTH_SECRET
	 * (same helper as destinations' secret keys — see destinations.ts).
	 * Required for scheduled/safety backups to run without a human present;
	 * manual backups from the admin UI may use a one-off passphrase instead.
	 */
	passphraseEncrypted: z.string().nullable().default(null),
	retention: backupRetentionSchema.default({ keepLast: 7 }),
	schedule: backupScheduleSchema.default({
		destinationId: null,
		enabled: false,
		frequency: "daily",
		time: "03:00",
		timezone: "UTC",
		weekday: 0,
	}),
});

export type BackupSettings = z.infer<typeof backupSettingsSchema>;

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
	destinations: [],
	passphraseEncrypted: null,
	retention: { keepLast: 7 },
	schedule: {
		destinationId: null,
		enabled: false,
		frequency: "daily",
		time: "03:00",
		timezone: "UTC",
		weekday: 0,
	},
};

/** Fills in defaults for any key missing from the stored jsonb (including a totally empty `{}`). */
export function resolveBackupSettings(
	raw: Record<string, unknown> | null | undefined
): BackupSettings {
	const parsed = backupSettingsSchema.partial().safeParse(raw ?? {});
	if (!parsed.success) {
		return DEFAULT_BACKUP_SETTINGS;
	}
	return {
		...DEFAULT_BACKUP_SETTINGS,
		...parsed.data,
		retention: {
			...DEFAULT_BACKUP_SETTINGS.retention,
			...parsed.data.retention,
		},
		schedule: { ...DEFAULT_BACKUP_SETTINGS.schedule, ...parsed.data.schedule },
	};
}

/** Reads `instance_settings.backup_settings`, with defaults filled in. */
export async function getBackupSettings(db: Database): Promise<BackupSettings> {
	const row = await getInstanceSettings(db);
	return resolveBackupSettings(row.backupSettings);
}

/** Merges `patch` into the stored backup settings and returns the resolved result. */
export async function updateBackupSettings(
	db: Database,
	patch: Partial<BackupSettings>
): Promise<BackupSettings> {
	const current = await getBackupSettings(db);
	const next: BackupSettings = {
		...current,
		...patch,
		retention: { ...current.retention, ...patch.retention },
		schedule: { ...current.schedule, ...patch.schedule },
	};
	await db
		.update(instanceSettings)
		.set({ backupSettings: next })
		.where(eq(instanceSettings.id, INSTANCE_ID));
	clearInstanceCache();
	return next;
}

/* -------------------------------------------------------------------------- */
/*                              Is a backup due?                             */
/* -------------------------------------------------------------------------- */

interface WallClock {
	day: number;
	hour: number;
	minute: number;
	month: number;
	weekday: number;
	year: number;
}

const WEEKDAY_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const HOUR_24_MIDNIGHT = "24";
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/** Reads one part's value out of `Intl.DateTimeFormat#formatToParts`'s result, or "" if absent. */
function partValue(parts: Intl.DateTimeFormatPart[], type: string): string {
	return parts.find((part) => part.type === type)?.value ?? "";
}

/** The wall-clock date/time `date` represents in `timeZone`, correctly handling DST. */
function wallClockIn(date: Date, timeZone: string): WallClock {
	const parts = new Intl.DateTimeFormat("en-US", {
		day: "2-digit",
		hour: "2-digit",
		hour12: false,
		minute: "2-digit",
		month: "2-digit",
		timeZone,
		weekday: "short",
		year: "numeric",
	}).formatToParts(date);
	const hour = partValue(parts, "hour");
	const weekdayName = partValue(parts, "weekday").toLowerCase().slice(0, 3);
	return {
		day: Number(partValue(parts, "day")),
		hour: hour === HOUR_24_MIDNIGHT ? 0 : Number(hour),
		minute: Number(partValue(parts, "minute")),
		month: Number(partValue(parts, "month")),
		weekday: Math.max(WEEKDAY_ORDER.indexOf(weekdayName), 0),
		year: Number(partValue(parts, "year")),
	};
}

function sameWallClockDay(a: WallClock, b: WallClock): boolean {
	return a.year === b.year && a.month === b.month && a.day === b.day;
}

function minutesSinceMidnight(w: WallClock): number {
	return w.hour * 60 + w.minute;
}

/** Parses "HH:MM" into minutes since midnight; invalid input is treated as midnight. */
function parseScheduledMinutes(time: string): number {
	const match = TIME_RE.exec(time);
	if (!match) {
		return 0;
	}
	const hour = Number(match[1]);
	const minute = Number(match[2]);
	return hour * 60 + minute;
}

/**
 * Whether a scheduled backup should run right now. Called once a minute by
 * the scheduler timer; pure and deterministic given `now`/`lastRunAt`, so
 * it's fully unit-testable without a clock mock library.
 *
 * Rule: due once the wall-clock time in the schedule's timezone has reached
 * `schedule.time` on a day matching `schedule.frequency`/`weekday`, and the
 * last run wasn't already on that same wall-clock day (so it fires once per
 * scheduled day, and catches up the next check after any downtime).
 */
export function isBackupDue(
	schedule: BackupScheduleConfig,
	now: Date,
	lastRunAt: Date | null
): boolean {
	if (!schedule.enabled) {
		return false;
	}
	const timeZone = schedule.timezone || "UTC";
	const current = wallClockIn(now, timeZone);
	if (schedule.frequency === "weekly" && current.weekday !== schedule.weekday) {
		return false;
	}
	const scheduledMinutes = parseScheduledMinutes(schedule.time);
	if (minutesSinceMidnight(current) < scheduledMinutes) {
		return false;
	}
	if (!lastRunAt) {
		return true;
	}
	const last = wallClockIn(lastRunAt, timeZone);
	if (!sameWallClockDay(current, last)) {
		return true;
	}
	return minutesSinceMidnight(last) < scheduledMinutes;
}

/* -------------------------------------------------------------------------- */
/*                                 Retention                                  */
/* -------------------------------------------------------------------------- */

export interface RetainableBackup {
	finishedAt: Date;
	id: string;
}

/**
 * Given every completed backup for one destination, returns the ones to
 * delete to keep only the most recent `keepLast`. Ties (equal timestamps)
 * are broken by `id` so the result is deterministic.
 */
export function selectBackupsToExpire<T extends RetainableBackup>(
	backups: T[],
	keepLast: number
): T[] {
	if (keepLast <= 0) {
		return [...backups];
	}
	const sorted = [...backups].sort((a, b) => {
		const byDate = b.finishedAt.getTime() - a.finishedAt.getTime();
		return byDate === 0 ? a.id.localeCompare(b.id) : byDate;
	});
	return sorted.slice(keepLast);
}

/* -------------------------------------------------------------------------- */
/*                         Postgres advisory lock                            */
/* -------------------------------------------------------------------------- */

export interface AdvisoryLockClient {
	query: (
		sql: string,
		params?: unknown[]
	) => Promise<{ rows: Record<string, unknown>[] }>;
	release: () => void;
}

/** The minimal shape of `db.$client` (a `pg.Pool`) this module needs. */
export interface AdvisoryLockPool {
	connect: () => Promise<AdvisoryLockClient>;
}

/** Deterministic 32-bit signed int key for `pg_(try_)advisory_lock`, derived from a name. */
export function advisoryLockKey(name: string): number {
	let hash = 5381;
	for (let i = 0; i < name.length; i += 1) {
		// biome-ignore lint/suspicious/noBitwiseOperators: a 32-bit hash needs bitwise ops
		hash = (hash * 33) ^ name.charCodeAt(i);
	}
	// biome-ignore lint/suspicious/noBitwiseOperators: forces the result into int32 range
	return hash | 0;
}

/**
 * Runs `fn` while holding a session-level Postgres advisory lock named
 * `lockName`, so two API replicas can never run the same scheduled/safety
 * backup at once. Acquires a *dedicated* connection from the pool (advisory
 * locks are tied to one connection) and always unlocks + releases it, even
 * if `fn` throws. Returns `{ locked: false }` without calling `fn` when
 * another replica already holds the lock.
 */
export async function withAdvisoryLock<T>(
	pool: AdvisoryLockPool,
	lockName: string,
	fn: () => Promise<T>
): Promise<{ locked: false } | { locked: true; result: T }> {
	const client = await pool.connect();
	try {
		const key = advisoryLockKey(lockName);
		const { rows } = await client.query(
			"select pg_try_advisory_lock($1) as locked",
			[key]
		);
		if (!rows[0]?.locked) {
			return { locked: false };
		}
		try {
			const result = await fn();
			return { locked: true, result };
		} finally {
			await client.query("select pg_advisory_unlock($1)", [key]);
		}
	} finally {
		client.release();
	}
}

/* -------------------------------------------------------------------------- */
/*                                  Timer                                     */
/* -------------------------------------------------------------------------- */

const CHECK_INTERVAL_MS = 60_000;

export interface SchedulerDeps {
	/** Returns when the last scheduled/safety run finished, or null if there's never been one. */
	getLastRunAt: () => Promise<Date | null>;
	/** Returns the current (resolved) backup settings. */
	getSettings: () => Promise<BackupSettings>;
	/** Advisory-locked pool, typically `db.$client`. */
	pool: AdvisoryLockPool;
	/** Starts (and is responsible for finishing/failing) one scheduled backup run. */
	runScheduledBackup: () => Promise<void>;
}

const SCHEDULED_BACKUP_LOCK = "stryveforms:scheduled-backup";

/**
 * Checks once a minute whether a scheduled backup is due and, if so, runs it
 * under the advisory lock. Returns a function that stops the timer — call it
 * on shutdown/test teardown, same pattern as `services/maintenance.ts`.
 */
export function startBackupScheduler(deps: SchedulerDeps): () => void {
	const tick = async () => {
		try {
			const settings = await deps.getSettings();
			const lastRunAt = await deps.getLastRunAt();
			if (!isBackupDue(settings.schedule, new Date(), lastRunAt)) {
				return;
			}
			await withAdvisoryLock(
				deps.pool,
				SCHEDULED_BACKUP_LOCK,
				deps.runScheduledBackup
			);
		} catch (error) {
			console.error("[backup-scheduler]", error);
		}
	};
	const timer = setInterval(tick, CHECK_INTERVAL_MS);
	return () => clearInterval(timer);
}
