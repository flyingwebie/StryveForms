import type { Database } from "@StryveForms/db";
import { backupJob } from "@StryveForms/db/schema/backup";
import { form, formSubmission, storedFile } from "@StryveForms/db/schema/forms";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";

import type { Services } from "../context";
import { uploadKeyCreatedAt } from "./backup/index";

const HOUR_MS = 3_600_000;
const TEMP_FILE_MAX_AGE_MS = 24 * HOUR_MS;
const UNIT_SQL: Record<string, string> = {
	day: "day",
	month: "month",
	week: "week",
	year: "year",
};

/** Deletes submissions older than each form's retention setting. */
export async function purgeExpiredSubmissions(
	db: Database,
	services: Services
) {
	const forms = await db
		.select({
			id: form.id,
			unit: form.submissionRetentionUnit,
			value: form.submissionRetentionValue,
		})
		.from(form)
		.where(
			and(
				isNotNull(form.submissionRetentionValue),
				isNotNull(form.submissionRetentionUnit)
			)
		);
	let deleted = 0;
	for (const f of forms) {
		const unit = UNIT_SQL[f.unit ?? ""];
		if (!(unit && f.value)) {
			continue;
		}
		const cutoff = sql`now() - (${f.value} || ' ' || ${unit})::interval`;
		// biome-ignore lint/performance/noAwaitInLoops: one form at a time keeps the database calm
		const files = await db
			.select({ key: storedFile.key })
			.from(storedFile)
			.innerJoin(formSubmission, eq(formSubmission.id, storedFile.submissionId))
			.where(
				and(
					eq(formSubmission.formId, f.id),
					lt(formSubmission.updatedAt, cutoff)
				)
			);
		await Promise.all(
			files.map((file) =>
				services.storage.delete(file.key).catch(() => undefined)
			)
		);
		const rows = await db
			.delete(formSubmission)
			.where(
				and(
					eq(formSubmission.formId, f.id),
					lt(formSubmission.updatedAt, cutoff)
				)
			)
			.returning({ id: formSubmission.id });
		deleted += rows.length;
	}
	return deleted;
}

/** Removes uploads that were never attached to a submission. */
export async function purgeTemporaryUploads(db: Database, services: Services) {
	const cutoff = new Date(Date.now() - TEMP_FILE_MAX_AGE_MS);
	const stale = await db
		.delete(storedFile)
		.where(
			and(eq(storedFile.temporary, true), lt(storedFile.createdAt, cutoff))
		)
		.returning({ key: storedFile.key });
	await Promise.all(
		stale.map((f) => services.storage.delete(f.key).catch(() => undefined))
	);
	return stale.length;
}

/**
 * Deletes finished workspace exports and manual instance-backup downloads
 * once their `expiresAt` has passed (BACKUP_DESIGN.md "Finished exports and
 * the CLI": 7 days). Clears `fileKey`/`sizeBytes` so the job's history
 * stays (the UI shows it as expired) without the file lingering in storage.
 */
export async function purgeExpiredBackupFiles(
	db: Database,
	services: Services
) {
	const expired = await db
		.select({ fileKey: backupJob.fileKey, id: backupJob.id })
		.from(backupJob)
		.where(
			and(isNotNull(backupJob.fileKey), lt(backupJob.expiresAt, new Date()))
		);
	await Promise.all(
		expired.map(async (job) => {
			if (job.fileKey) {
				await services.storage.delete(job.fileKey).catch(() => undefined);
			}
			await db
				.update(backupJob)
				.set({ fileKey: null, sizeBytes: null })
				.where(eq(backupJob.id, job.id));
		})
	);
	return expired.length;
}

const ABANDONED_UPLOAD_MS = 2 * 24 * HOUR_MS;

/** Deletes backup/import uploads (`tmp/backups/…`) nobody used within two days. */
export async function purgeAbandonedBackupUploads(services: Services) {
	const cutoff = Date.now() - ABANDONED_UPLOAD_MS;
	const keys = await services.storage.list("tmp/backups/");
	const stale = keys.filter((key) => {
		const createdAt = uploadKeyCreatedAt(key.split("/").pop() ?? "");
		// Malformed names predate timestamped ids; treat them as stale too.
		return (createdAt?.getTime() ?? 0) < cutoff;
	});
	await Promise.all(
		stale.map((key) => services.storage.delete(key).catch(() => undefined))
	);
	return stale.length;
}

/**
 * Deletes fresh-instance-restore uploads (`tmp/setup-restore/…`, see
 * apps/server/src/index.ts `/api/setup/restore-upload`) nobody used within
 * two days. Edit-only addition by engineer R — mirrors
 * `purgeAbandonedBackupUploads` above (P), same id shape (`newUploadKey()`).
 */
export async function purgeAbandonedSetupRestoreUploads(services: Services) {
	const cutoff = Date.now() - ABANDONED_UPLOAD_MS;
	const keys = await services.storage.list("tmp/setup-restore/");
	const stale = keys.filter((key) => {
		const createdAt = uploadKeyCreatedAt(key.split("/").pop() ?? "");
		return (createdAt?.getTime() ?? 0) < cutoff;
	});
	await Promise.all(
		stale.map((key) => services.storage.delete(key).catch(() => undefined))
	);
	return stale.length;
}

/** Runs maintenance every hour. Returns a function that stops the timer. */
export function startMaintenance(db: Database, services: Services): () => void {
	const run = async () => {
		try {
			await purgeExpiredSubmissions(db, services);
			await purgeTemporaryUploads(db, services);
			await purgeExpiredBackupFiles(db, services);
			await purgeAbandonedBackupUploads(services);
			await purgeAbandonedSetupRestoreUploads(services);
		} catch (error) {
			console.error("[maintenance]", error);
		}
	};
	const timer = setInterval(run, HOUR_MS);
	setTimeout(run, 30_000);
	return () => clearInterval(timer);
}
