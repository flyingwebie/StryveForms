/**
 * Manual, scheduled and safety full-instance backups, and instance restores.
 * Wraps engineer P's `writeInstanceArchive` / `restoreInstanceArchive` /
 * `inspectInstanceBackup` (services/backup/index.ts) with `backup_job`
 * bookkeeping (jobs.ts), a destination to send the archive to
 * (destinations.ts), and admin failure emails.
 *
 * P's archive functions aren't wired in by name here — they're passed in as
 * `InstanceArchiveOps` (an `ArchiveBackend`) so this module compiles and is
 * fully unit-testable with a fake backend today. Once services/backup/index.ts
 * lands, `routers/backup-admin.ts` passes the real `writeInstanceArchive`/
 * `restoreInstanceArchive`/`inspectInstanceBackup` in as that one object —
 * nothing in this file needs to change.
 */
import type { Database } from "@StryveForms/db";
import { user } from "@StryveForms/db/schema/auth";
import { emails } from "@StryveForms/emails/messages";
import { eq } from "drizzle-orm";

import type { Services } from "../../context";
import { emailBranding, getInstanceSettings } from "../instance";
import { type DestinationConfig, openDestination } from "./destinations";
import {
	BackupJobReporter,
	type BackupJobTrigger,
	createBackupJob,
	failBackupJob,
	finishBackupJob,
	getBackupJob,
} from "./jobs";
import {
	getBackupSettings,
	type StoredDestinationConfig,
	selectBackupsToExpire,
} from "./scheduler";
import type { ArchiveSink, ArchiveSource } from "./streams";

/** The three P functions this module builds on — see services/backup/index.ts (CONTRACT.md). */
export interface ArchiveBackend {
	inspectInstanceBackup: (
		db: Database,
		services: Services,
		args: { passphrase: string; source: ArchiveSource }
	) => Promise<{ manifest: unknown }>;
	restoreInstanceArchive: (
		db: Database,
		services: Services,
		args: {
			passphrase: string;
			reporter: BackupJobReporter;
			source: ArchiveSource;
		}
	) => Promise<{ manifest: unknown }>;
	writeInstanceArchive: (
		db: Database,
		services: Services,
		args: { passphrase: string; reporter: BackupJobReporter; sink: ArchiveSink }
	) => Promise<{ manifest: unknown; sizeBytes: number }>;
}

function toConfig(stored: StoredDestinationConfig): DestinationConfig {
	return stored;
}

/** Converts a stored destination + the instance secret into something `openDestination` can use. */
function openStoredDestination(
	stored: StoredDestinationConfig,
	services: Services
) {
	return openDestination(toConfig(stored), {
		instanceSecret: services.config.signingSecret,
		storage: services.storage,
	});
}

function backupFileName(trigger: BackupJobTrigger) {
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	return `stryveforms-${trigger}-${stamp}.stryve-backup`;
}

async function emailAdminsOfFailure(
	db: Database,
	services: Services,
	trigger: BackupJobTrigger,
	error: string
) {
	const admins = await db
		.select({ email: user.email })
		.from(user)
		.where(eq(user.isAdmin, true));
	if (admins.length === 0) {
		return;
	}
	const branding = await emailBranding(db, services.config);
	const adminUrl = `${services.config.appUrl}/dashboard/admin?tab=backups`;
	await Promise.all(
		admins.map((admin) =>
			services.mailer
				.send({
					react: emails.backupFailed({ adminUrl, branding, error, trigger }),
					subject: "A StryveForms backup failed",
					to: admin.email,
				})
				.catch((sendError: unknown) => {
					console.error("[backup] failed to email admin of failure", sendError);
				})
		)
	);
}

export interface RunBackupInput {
	/** Which configured destination (`backup_settings.destinations`) to send the archive to. */
	destinationId: string;
	passphrase: string;
	trigger: BackupJobTrigger;
	userId?: string | null;
}

/**
 * Runs one full-instance backup to a destination and records it as a
 * `backup_job`. Returns once the job is created; the archive write itself
 * continues in the background — poll `getBackupJob` for progress.
 */
export async function runInstanceBackup(
	db: Database,
	services: Services,
	archive: ArchiveBackend,
	input: RunBackupInput
): Promise<{ jobId: string }> {
	const settings = await getBackupSettings(db);
	const destination = settings.destinations.find(
		(d) => d.id === input.destinationId
	);
	if (!destination) {
		throw new Error(`Unknown backup destination: ${input.destinationId}`);
	}

	const { id: jobId } = await createBackupJob(db, {
		destinationId: input.destinationId,
		kind: "instance_backup",
		trigger: input.trigger,
		userId: input.userId ?? null,
	});

	writeBackupInBackground(
		db,
		services,
		archive,
		destination,
		settings,
		input,
		jobId
	).catch((error: unknown) => {
		console.error("[backup] background backup write crashed", error);
	});

	return { jobId };
}

/** The actual archive write, run in the background — the caller gets `{ jobId }` back immediately. */
async function writeBackupInBackground(
	db: Database,
	services: Services,
	archive: ArchiveBackend,
	destination: StoredDestinationConfig,
	settings: { retention: { keepLast: number } },
	input: RunBackupInput,
	jobId: string
) {
	const reporter = new BackupJobReporter(db, jobId);
	const opened = openStoredDestination(destination, services);
	const fileName = backupFileName(input.trigger);
	const sink = opened.sink(fileName);
	try {
		const { manifest, sizeBytes } = await archive.writeInstanceArchive(
			db,
			services,
			{ passphrase: input.passphrase, reporter, sink }
		);
		await reporter.flush(true);
		await finishBackupJob(db, jobId, {
			fileKey: fileName,
			fileName,
			result: { manifest: manifest as Record<string, unknown> },
			sizeBytes,
		});
		await expireOldBackups(
			db,
			services,
			destination,
			settings.retention.keepLast
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await sink.abort(error).catch(() => undefined);
		await reporter.flush(true).catch(() => undefined);
		await failBackupJob(db, jobId, message);
		if (input.trigger === "scheduled" || input.trigger === "safety") {
			await emailAdminsOfFailure(db, services, input.trigger, message);
		}
	}
}

/** Deletes old backups at `destination` beyond `keepLast`, using `backup_job` rows as the source of truth. */
async function expireOldBackups(
	db: Database,
	services: Services,
	destination: StoredDestinationConfig,
	keepLast: number
) {
	const { listBackupJobs } = await import("./jobs");
	const completed = await listBackupJobs(db, { kind: "instance_backup" });
	const atThisDestination = completed
		.filter(
			(job) =>
				job.destinationId === destination.id &&
				job.status === "completed" &&
				job.fileKey &&
				job.finishedAt
		)
		.map((job) => ({ finishedAt: job.finishedAt as Date, id: job.id }));
	const toExpire = selectBackupsToExpire(atThisDestination, keepLast);
	if (toExpire.length === 0) {
		return;
	}
	const opened = openStoredDestination(destination, services);
	const byId = new Map(completed.map((job) => [job.id, job]));
	await Promise.all(
		toExpire.map(async ({ id }) => {
			const job = byId.get(id);
			if (job?.fileKey) {
				await opened.delete(job.fileKey).catch((error: unknown) => {
					console.error("[backup] failed to delete expired backup", error);
				});
			}
		})
	);
}

/**
 * Runs the scheduled backup (called by scheduler.ts under the advisory
 * lock): resolves the configured schedule/destination/passphrase and defers
 * to {@link runInstanceBackup}. Does nothing (silently) if scheduling isn't
 * fully configured yet, so a half-finished setup can't throw every minute.
 */
export function runScheduledBackup(
	db: Database,
	services: Services,
	archive: ArchiveBackend,
	decryptPassphrase: (encrypted: string) => string
) {
	return async () => {
		const settings = await getBackupSettings(db);
		const { destinationId } = settings.schedule;
		if (!(destinationId && settings.passphraseEncrypted)) {
			console.error(
				"[backup-scheduler] a backup is due, but no destination or passphrase is configured"
			);
			return;
		}
		const passphrase = decryptPassphrase(settings.passphraseEncrypted);
		const { jobId } = await runInstanceBackup(db, services, archive, {
			destinationId,
			passphrase,
			trigger: "scheduled",
		});
		await waitForJob(db, jobId);
	};
}

/** Polls a job until it's no longer running — used where the caller needs to know the outcome before continuing (e.g. a safety backup before a restore). */
async function waitForJob(
	db: Database,
	jobId: string,
	pollMs = 500
): Promise<Awaited<ReturnType<typeof getBackupJob>>> {
	for (;;) {
		// biome-ignore lint/performance/noAwaitInLoops: polling a job's own status is inherently sequential
		const job = await getBackupJob(db, jobId);
		if (job?.status !== "running") {
			return job;
		}
		await new Promise((resolve) => setTimeout(resolve, pollMs));
	}
}

export class RestoreConfirmationError extends Error {
	constructor() {
		super("Type the instance name exactly to confirm this restore.");
	}
}

export interface RunRestoreInput {
	confirmInstanceName: string;
	passphrase: string;
	safetyDestinationId: string | null;
	source: ArchiveSource;
	userId: string;
}

/**
 * Restores a full-instance backup, after:
 * 1. checking the typed confirmation matches the instance's real name, and
 * 2. taking an automatic safety backup first (same passphrase), as agreed in
 *    BACKUP_DESIGN.md Q10 — skipped only if no destination is configured at
 *    all, which is noted as a warning rather than blocking the restore.
 *
 * The restore itself (wipe + restore) is engineer P's `restoreInstanceArchive`;
 * this function only sequences the safety backup, confirmation and job
 * bookkeeping around it.
 */
export async function runInstanceRestore(
	db: Database,
	services: Services,
	archive: ArchiveBackend,
	input: RunRestoreInput
): Promise<{ jobId: string }> {
	const instance = await getInstanceSettings(db);
	if (input.confirmInstanceName !== instance.name) {
		throw new RestoreConfirmationError();
	}

	if (input.safetyDestinationId) {
		const { jobId: safetyJobId } = await runInstanceBackup(
			db,
			services,
			archive,
			{
				destinationId: input.safetyDestinationId,
				passphrase: input.passphrase,
				trigger: "safety",
				userId: input.userId,
			}
		);
		const safetyJob = await waitForJob(db, safetyJobId);
		if (safetyJob?.status !== "completed") {
			throw new Error(
				"The automatic safety backup failed, so the restore was not started. Fix the backup destination and try again."
			);
		}
	}

	const { id: jobId } = await createBackupJob(db, {
		kind: "instance_restore",
		trigger: "manual",
		userId: input.userId,
	});

	restoreInBackground(db, services, archive, input, jobId).catch(
		(error: unknown) => {
			console.error("[backup] background restore crashed", error);
		}
	);

	return { jobId };
}

/** The actual restore, run in the background — the caller gets `{ jobId }` back immediately. */
async function restoreInBackground(
	db: Database,
	services: Services,
	archive: ArchiveBackend,
	input: RunRestoreInput,
	jobId: string
) {
	const reporter = new BackupJobReporter(db, jobId);
	try {
		const { manifest } = await archive.restoreInstanceArchive(db, services, {
			passphrase: input.passphrase,
			reporter,
			source: input.source,
		});
		await reporter.flush(true);
		await finishBackupJob(db, jobId, {
			result: { manifest: manifest as Record<string, unknown> },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await reporter.flush(true).catch(() => undefined);
		await failBackupJob(db, jobId, message);
		await emailAdminsOfFailure(db, services, "manual", message);
	}
}
