/**
 * Shared machinery for imports (OpnForm, JotForm): job rows, progress, logs,
 * cancellation, the source → StryveForms id mapping and the summary email.
 */
import type { Database } from "@StryveForms/db";
import { user } from "@StryveForms/db/schema/auth";
import {
	form,
	importJob,
	importMapping,
	storedFile,
} from "@StryveForms/db/schema/forms";
import { emails } from "@StryveForms/emails/messages";
import { and, eq, inArray, sql } from "drizzle-orm";

import type { Services } from "../../context";
import { assetKey, assetUrl, submissionFileKey } from "../../lib/files";
import { newId } from "../../lib/ids";
import { emailBranding } from "../instance";

const MAX_LOG_ENTRIES = 500;
const PROGRESS_FLUSH_MS = 1000;
const UNSAFE_NAME = /[^\w.-]+/g;

export type ImportSource = "opnform" | "jotform";

export const SOURCE_NAMES: Record<ImportSource, string> = {
	jotform: "JotForm",
	opnform: "OpnForm",
};

export type MappingEntity = typeof importMapping.$inferInsert.entity;

export interface ImportProgress {
	currentForm?: string;
	files: { done: number; total: number };
	forms: { done: number; total: number };
	integrations: { done: number };
	submissions: { done: number; total: number };
	[key: string]: unknown;
}

export type LogLevel = "info" | "warn" | "error";

const cancelled = new Set<string>();

export function cancelImport(jobId: string) {
	cancelled.add(jobId);
}

export class ImportCancelled extends Error {}

export class JobReporter {
	readonly log: { at: string; level: LogLevel; message: string }[] = [];
	readonly progress: ImportProgress = {
		files: { done: 0, total: 0 },
		forms: { done: 0, total: 0 },
		integrations: { done: 0 },
		submissions: { done: 0, total: 0 },
	};
	readonly warnings: string[] = [];
	private lastFlush = 0;
	private readonly db: Database;
	readonly jobId: string;

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

	async flush(force = false) {
		if (!force && Date.now() - this.lastFlush < PROGRESS_FLUSH_MS) {
			return;
		}
		this.lastFlush = Date.now();
		await this.db
			.update(importJob)
			.set({ log: this.log, progress: this.progress })
			.where(eq(importJob.id, this.jobId));
	}

	checkCancelled() {
		if (cancelled.has(this.jobId)) {
			throw new ImportCancelled();
		}
	}
}

/* -------------------------------- Mapping -------------------------------- */

/** Remembers what was imported where, so running an import again updates. */
export class ImportMappings {
	private readonly db: Database;
	private readonly sourceUrl: string;
	private readonly userId: string;

	constructor(db: Database, sourceUrl: string, userId: string) {
		this.db = db;
		this.sourceUrl = sourceUrl;
		this.userId = userId;
	}

	async get(entity: MappingEntity, sourceId: string): Promise<string | null> {
		const [row] = await this.db
			.select({ targetId: importMapping.targetId })
			.from(importMapping)
			.where(
				and(
					eq(importMapping.sourceUrl, this.sourceUrl),
					eq(importMapping.entity, entity),
					eq(importMapping.sourceId, sourceId),
					eq(importMapping.userId, this.userId)
				)
			);
		return row?.targetId ?? null;
	}

	async set(entity: MappingEntity, sourceId: string, targetId: string) {
		await this.db
			.insert(importMapping)
			.values({
				entity,
				sourceId,
				sourceUrl: this.sourceUrl,
				targetId,
				userId: this.userId,
			})
			.onConflictDoUpdate({
				set: { targetId },
				target: [
					importMapping.sourceUrl,
					importMapping.entity,
					importMapping.sourceId,
					importMapping.userId,
				],
			});
	}

	/** Source form id → StryveForms form id, for forms imported before (and not deleted). */
	async importedForms(sourceIds: string[]): Promise<Map<string, string>> {
		if (sourceIds.length === 0) {
			return new Map();
		}
		const rows = await this.db
			.select({
				sourceId: importMapping.sourceId,
				targetId: importMapping.targetId,
			})
			.from(importMapping)
			.innerJoin(form, eq(form.id, importMapping.targetId))
			.where(
				and(
					eq(importMapping.sourceUrl, this.sourceUrl),
					eq(importMapping.entity, "form"),
					eq(importMapping.userId, this.userId),
					inArray(importMapping.sourceId, sourceIds),
					sql`${form.deletedAt} is null`
				)
			);
		return new Map(rows.map((r) => [r.sourceId, r.targetId]));
	}
}

/* --------------------------------- Files --------------------------------- */

/** Copies an image used in a form (logo, cover, image block) into storage. */
export async function copyAsset(
	db: Database,
	services: Services,
	workspaceId: string,
	url: string,
	download: (url: string) => Promise<Blob>
): Promise<string> {
	const blob = await download(url);
	const original = decodeURIComponent(
		new URL(url).pathname.split("/").pop() ?? "asset"
	);
	const name = `${newId()}_${original.replace(UNSAFE_NAME, "_").slice(-60)}`;
	await services.storage.put(assetKey(name), blob, blob.type || undefined);
	await db.insert(storedFile).values({
		id: newId(),
		key: assetKey(name),
		kind: "asset",
		mimeType: blob.type || null,
		originalName: original,
		size: blob.size,
		workspaceId,
	});
	return assetUrl(services.config, name);
}

/** Stores one submission file. Skips it when it was copied before. */
export async function storeSubmissionFile(
	db: Database,
	services: Services,
	file: {
		formId: string;
		kind: "signature" | "upload";
		originalName: string;
		storedName: string;
		submissionId: string;
	},
	download: () => Promise<Blob>
) {
	const key = submissionFileKey(file.formId, file.storedName);
	const [already] = await db
		.select({ id: storedFile.id })
		.from(storedFile)
		.where(eq(storedFile.key, key));
	if (already) {
		return;
	}
	const blob = await download();
	await services.storage.put(key, blob, blob.type || undefined);
	await db.insert(storedFile).values({
		formId: file.formId,
		id: newId(),
		key,
		kind: file.kind,
		mimeType: blob.type || null,
		originalName: file.originalName,
		size: blob.size,
		submissionId: file.submissionId,
	});
}

/** Runs tasks with a fixed number of workers. */
export async function runPool<T>(
	items: T[],
	concurrency: number,
	task: (item: T) => Promise<void>
) {
	const queue = [...items];
	const worker = async () => {
		for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
			// biome-ignore lint/performance/noAwaitInLoops: each worker handles one item at a time
			await task(item);
		}
	};
	await Promise.all(Array.from({ length: concurrency }, worker));
}

/* ---------------------------------- Jobs --------------------------------- */

export async function createJob(
	db: Database,
	input: {
		options: Record<string, unknown>;
		reporter: JobReporter;
		source: ImportSource;
		sourceUrl: string;
		userId: string;
	}
) {
	await db.insert(importJob).values({
		id: input.reporter.jobId,
		options: input.options,
		progress: input.reporter.progress,
		source: input.source,
		sourceUrl: input.sourceUrl,
		startedAt: new Date(),
		status: "running",
		userId: input.userId,
	});
}

async function sendSummaryEmail(
	db: Database,
	services: Services,
	input: {
		reporter: JobReporter;
		source: ImportSource;
		status: "completed" | "failed";
		userId: string;
	}
) {
	const [owner] = await db.select().from(user).where(eq(user.id, input.userId));
	if (!owner) {
		return;
	}
	const { config } = services;
	const { progress, warnings } = input.reporter;
	const sourceName = SOURCE_NAMES[input.source];
	await services.mailer.send({
		react: emails.importFinished({
			branding: await emailBranding(db, config),
			counts: {
				files: progress.files.done,
				forms: progress.forms.done,
				integrations: progress.integrations.done,
				submissions: progress.submissions.done,
			},
			dashboardUrl: `${config.appUrl}/dashboard`,
			errors: warnings,
			sourceName,
			status: input.status,
		}),
		subject:
			input.status === "completed"
				? `Your ${sourceName} import is done`
				: `Your ${sourceName} import failed`,
		to: owner.email,
	});
}

/**
 * Runs an import in the background: marks the job completed, failed or
 * cancelled at the end and emails the summary.
 */
export function runJob(
	db: Database,
	services: Services,
	input: {
		reporter: JobReporter;
		run: () => Promise<void>;
		source: ImportSource;
		userId: string;
	}
) {
	const { reporter } = input;
	const execute = async () => {
		try {
			await input.run();
			reporter.progress.currentForm = undefined;
			reporter.add("info", "Import finished");
			await db
				.update(importJob)
				.set({
					finishedAt: new Date(),
					log: reporter.log,
					progress: reporter.progress,
					status: "completed",
				})
				.where(eq(importJob.id, reporter.jobId));
			await sendSummaryEmail(db, services, { ...input, status: "completed" });
		} catch (error) {
			const wasCancelled = error instanceof ImportCancelled;
			const message = wasCancelled
				? "Import cancelled"
				: (error as Error).message;
			reporter.add(wasCancelled ? "warn" : "error", message);
			await db
				.update(importJob)
				.set({
					error: wasCancelled ? null : message,
					finishedAt: new Date(),
					log: reporter.log,
					progress: reporter.progress,
					status: wasCancelled ? "cancelled" : "failed",
				})
				.where(eq(importJob.id, reporter.jobId));
			if (!wasCancelled) {
				await sendSummaryEmail(db, services, {
					...input,
					status: "failed",
				}).catch(() => undefined);
			}
		} finally {
			cancelled.delete(reporter.jobId);
		}
	};
	execute().catch((error: unknown) => {
		console.error("[import]", error);
	});
}

/** Marks jobs left "running" by a server restart as failed. */
export async function failInterruptedJobs(db: Database) {
	await db
		.update(importJob)
		.set({
			error:
				"The server restarted during the import. Run it again — already imported items are updated, not duplicated.",
			finishedAt: new Date(),
			status: "failed",
		})
		.where(eq(importJob.status, "running"));
}
