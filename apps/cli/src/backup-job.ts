/**
 * Shared by `export` and `backup`: polls a `backup_job` row until it settles,
 * and downloads the finished file through the authenticated
 * `GET /api/backups/jobs/:id/download` route (apps/server/src/index.ts).
 */
const POLL_MS = 1500;

export interface BackupJobRow {
	error?: string | null;
	fileKey?: string | null;
	fileName?: string | null;
	id: string;
	progress?: unknown;
	status: string;
}

export class BackupJobFailedError extends Error {}

/** Polls `getJob` until the job is no longer pending/running. Throws `BackupJobFailedError` on failure/cancellation. */
export async function waitForBackupJob(
	getJob: () => Promise<BackupJobRow | null>,
	onProgress?: (job: BackupJobRow) => void
): Promise<BackupJobRow> {
	for (;;) {
		// biome-ignore lint/performance/noAwaitInLoops: polling a job's own status is inherently sequential
		const job = await getJob();
		if (!job) {
			throw new BackupJobFailedError("Job not found");
		}
		onProgress?.(job);
		if (job.status === "completed") {
			return job;
		}
		if (job.status === "failed" || job.status === "cancelled") {
			throw new BackupJobFailedError(job.error || `Job ${job.status}`);
		}
		await new Promise((resolve) => setTimeout(resolve, POLL_MS));
	}
}

/** Downloads a finished job's file to `outPath`. */
export async function downloadBackupJobFile(
	serverUrl: string,
	token: string,
	jobId: string,
	outPath: string
): Promise<void> {
	const response = await fetch(
		`${serverUrl}/api/backups/jobs/${jobId}/download`,
		{
			headers: { Authorization: `Bearer ${token}` },
		}
	);
	if (!response.ok) {
		throw new Error(`Download failed (HTTP ${response.status})`);
	}
	const bytes = new Uint8Array(await response.arrayBuffer());
	await Bun.write(outPath, bytes);
}
