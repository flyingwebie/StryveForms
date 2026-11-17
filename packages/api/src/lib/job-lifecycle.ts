/**
 * The lifecycle every background job follows — backups, exports, restores and
 * imports from other services (`backup_job` and `import_job` rows).
 *
 *   pending ──▶ running ──▶ completed
 *                  │
 *                  ├──────▶ failed      (an error, or the server restarted)
 *                  └──────▶ cancelled   (someone asked it to stop)
 *
 * A job that reaches completed, failed or cancelled never changes again.
 *
 * This file has no imports on purpose: the server, the web app and the CLI
 * all read it, so "is this job still going?" has one answer everywhere.
 * Ask `isJobActive` / `isJobSettled` instead of comparing status strings.
 */

export const JOB_STATUSES = [
	"pending",
	"running",
	"completed",
	"failed",
	"cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

/** Still going: keep polling, keep the spinner, offer "Cancel". */
export const ACTIVE_JOB_STATUSES = [
	"pending",
	"running",
] as const satisfies readonly JobStatus[];

/** Finished for good: stop polling, show the outcome, offer "Close". */
export const SETTLED_JOB_STATUSES = [
	"completed",
	"failed",
	"cancelled",
] as const satisfies readonly JobStatus[];

export type ActiveJobStatus = (typeof ACTIVE_JOB_STATUSES)[number];
export type SettledJobStatus = (typeof SETTLED_JOB_STATUSES)[number];

const ACTIVE: ReadonlySet<string> = new Set(ACTIVE_JOB_STATUSES);
const SETTLED: ReadonlySet<string> = new Set(SETTLED_JOB_STATUSES);

/**
 * True while the job is pending or running. A missing status (the job hasn't
 * loaded yet) is neither active nor settled.
 */
export function isJobActive(
	status: string | null | undefined
): status is ActiveJobStatus {
	return typeof status === "string" && ACTIVE.has(status);
}

/** True once the job has completed, failed or been cancelled. */
export function isJobSettled(
	status: string | null | undefined
): status is SettledJobStatus {
	return typeof status === "string" && SETTLED.has(status);
}

/** True when the job ended without producing its result (failed or cancelled). */
export function isJobUnsuccessful(
	status: string | null | undefined
): status is "cancelled" | "failed" {
	return status === "failed" || status === "cancelled";
}
