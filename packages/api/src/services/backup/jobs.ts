/**
 * `backup_job` row helpers shared by every backup/export/import path (P's
 * workspace export/import, R's instance backup/restore/scheduled jobs). The
 * shape mirrors services/import/jobs.ts's `JobReporter`, generalized across
 * the four `BackupJobKind`s.
 */
import type { Database } from "@StryveForms/db";
import { backupJob } from "@StryveForms/db/schema/backup";
import { and, desc, eq } from "drizzle-orm";

import { newId } from "../../lib/ids";

export type BackupJobKind =
	| "workspace_export"
	| "workspace_import"
	| "instance_backup"
	| "instance_restore";

export type BackupJobStatus =
	| "pending"
	| "running"
	| "completed"
	| "failed"
	| "cancelled";

export type BackupJobTrigger = "manual" | "scheduled" | "safety" | "cli";

export type LogLevel = "info" | "warn" | "error";

/**
 * Live progress shown in the job's UI card. `entities` holds a done/total
 * pair per entity kind (`forms`, `submissions`, `files`, `integrations`,
 * `notifications`, `pdfTemplates`, `templates`, `folders`, `users`,
 * `workspaces`…) — exporters/importers only set the keys they touch.
 */
export interface BackupProgress {
	bytesWritten?: number;
	currentEntity?: string;
	entities: Record<string, { done: number; total: number }>;
	phase?: string;
	[key: string]: unknown;
}

const MAX_LOG_ENTRIES = 500;
const PROGRESS_FLUSH_MS = 1000;

const cancelled = new Set<string>();

/** Signals a running job to stop at its next checkpoint. Used by `cancelBackupJob`. */
export function requestCancel(jobId: string) {
	cancelled.add(jobId);
}

export class BackupJobCancelled extends Error {
	constructor() {
		super("Job cancelled");
	}
}

export class BackupJobReporter {
	readonly jobId: string;
	readonly log: { at: string; level: LogLevel; message: string }[] = [];
	readonly progress: BackupProgress = { entities: {} };
	readonly warnings: string[] = [];
	private lastFlush = 0;
	private readonly db: Database;

	constructor(db: Database, jobId: string) {
		this.db = db;
		this.jobId = jobId;
	}

	add(level: LogLevel, message: string) {
		this.log.push({ at: new Date().toISOString(), level, message });
		if (this.log.length > MAX_LOG_ENTRIES) {
			this.log.splice(0, this.log.length - MAX_LOG_ENTRIES);
		}
		if (level !== "info") {
			this.warnings.push(message);
		}
	}

	/** Merges a partial progress update (e.g. `{ entities: { forms: { done: 3, total: 10 } } }`). */
	setProgress(patch: Partial<BackupProgress>) {
		Object.assign(this.progress, patch);
		if (patch.entities) {
			this.progress.entities = { ...this.progress.entities, ...patch.entities };
		}
	}

	entityProgress(entity: string, done: number, total: number) {
		this.progress.currentEntity = entity;
		this.progress.entities[entity] = { done, total };
	}

	async flush(force = false) {
		if (!force && Date.now() - this.lastFlush < PROGRESS_FLUSH_MS) {
			return;
		}
		this.lastFlush = Date.now();
		await this.db
			.update(backupJob)
			.set({ log: this.log, progress: this.progress })
			.where(eq(backupJob.id, this.jobId));
	}

	checkCancelled() {
		if (cancelled.has(this.jobId)) {
			throw new BackupJobCancelled();
		}
	}
}

export interface CreateBackupJobInput {
	destinationId?: string | null;
	id?: string;
	kind: BackupJobKind;
	options?: Record<string, unknown>;
	trigger?: BackupJobTrigger;
	userId?: string | null;
	workspaceId?: string | null;
}

export async function createBackupJob(
	db: Database,
	input: CreateBackupJobInput
): Promise<{ id: string }> {
	const id = input.id ?? newId();
	await db.insert(backupJob).values({
		destinationId: input.destinationId ?? null,
		id,
		kind: input.kind,
		options: input.options ?? {},
		startedAt: new Date(),
		status: "running",
		trigger: input.trigger ?? "manual",
		userId: input.userId ?? null,
		workspaceId: input.workspaceId ?? null,
	});
	return { id };
}

export interface FinishBackupJobInput {
	expiresAt?: Date | null;
	fileKey?: string | null;
	fileName?: string | null;
	result?: Record<string, unknown> | null;
	sizeBytes?: number | null;
}

export async function finishBackupJob(
	db: Database,
	jobId: string,
	input: FinishBackupJobInput = {}
) {
	await db
		.update(backupJob)
		.set({
			expiresAt: input.expiresAt ?? null,
			fileKey: input.fileKey ?? null,
			fileName: input.fileName ?? null,
			finishedAt: new Date(),
			result: input.result ?? null,
			sizeBytes: input.sizeBytes ?? null,
			status: "completed",
		})
		.where(eq(backupJob.id, jobId));
	cancelled.delete(jobId);
}

export async function failBackupJob(
	db: Database,
	jobId: string,
	error: string
) {
	await db
		.update(backupJob)
		.set({ error, finishedAt: new Date(), status: "failed" })
		.where(eq(backupJob.id, jobId));
	cancelled.delete(jobId);
}

/** Marks a job cancelled (used once the run loop observes `BackupJobCancelled`). */
export async function markBackupJobCancelled(db: Database, jobId: string) {
	await db
		.update(backupJob)
		.set({ finishedAt: new Date(), status: "cancelled" })
		.where(eq(backupJob.id, jobId));
	cancelled.delete(jobId);
}

export async function getBackupJob(db: Database, jobId: string) {
	const [row] = await db
		.select()
		.from(backupJob)
		.where(eq(backupJob.id, jobId));
	return row ?? null;
}

export interface ListBackupJobsFilter {
	kind?: BackupJobKind;
	userId?: string | null;
	workspaceId?: string | null;
}

/** Lists jobs, most recent first. Pass `userId` to scope to one caller's own jobs (the `jobs` tRPC procedure's contract). */
export async function listBackupJobs(
	db: Database,
	filter: ListBackupJobsFilter = {}
) {
	const conditions: ReturnType<typeof eq>[] = [];
	if (filter.userId) {
		conditions.push(eq(backupJob.userId, filter.userId));
	}
	if (filter.workspaceId) {
		conditions.push(eq(backupJob.workspaceId, filter.workspaceId));
	}
	if (filter.kind) {
		conditions.push(eq(backupJob.kind, filter.kind));
	}
	return await db
		.select()
		.from(backupJob)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(backupJob.createdAt));
}

/**
 * Requests cancellation of a running job. Only the job's own owner (or an
 * instance admin, checked by the caller — see routers/backup.ts) may cancel
 * it; this function itself just flips the signal the run loop polls.
 */
export async function cancelBackupJob(db: Database, jobId: string) {
	const job = await getBackupJob(db, jobId);
	if (job?.status !== "running") {
		return false;
	}
	requestCancel(jobId);
	return true;
}

/** Marks jobs left "running" by a server restart as failed, like import's `failInterruptedJobs`. */
export async function failInterruptedBackupJobs(db: Database) {
	await db
		.update(backupJob)
		.set({
			error: "The server restarted while this job was running. Start it again.",
			finishedAt: new Date(),
			status: "failed",
		})
		.where(eq(backupJob.status, "running"));
}
