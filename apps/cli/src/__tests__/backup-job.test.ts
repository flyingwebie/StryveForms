import { describe, expect, test } from "bun:test";

import {
	BackupJobFailedError,
	type BackupJobRow,
	waitForBackupJob,
} from "../backup-job";

describe("waitForBackupJob", () => {
	test("resolves once the job completes", async () => {
		const statuses: BackupJobRow["status"][] = [
			"pending",
			"running",
			"completed",
		];
		let i = 0;
		const seen: string[] = [];
		const job = await waitForBackupJob(
			() => {
				const status = statuses[i] ?? "completed";
				i += 1;
				return Promise.resolve({ id: "job_1", status });
			},
			(current) => seen.push(current.status)
		);
		expect(job.status).toBe("completed");
		expect(seen).toEqual(["pending", "running", "completed"]);
	});

	test("throws BackupJobFailedError with the job's error message on failure", async () => {
		await expect(
			waitForBackupJob(() =>
				Promise.resolve({
					error: "Could not reach the destination",
					id: "job_1",
					status: "failed",
				})
			)
		).rejects.toThrow(BackupJobFailedError);
		await expect(
			waitForBackupJob(() =>
				Promise.resolve({
					error: "Could not reach the destination",
					id: "job_1",
					status: "failed",
				})
			)
		).rejects.toThrow("Could not reach the destination");
	});

	test("throws BackupJobFailedError on cancellation, even without an error message", async () => {
		await expect(
			waitForBackupJob(() =>
				Promise.resolve({ id: "job_1", status: "cancelled" })
			)
		).rejects.toThrow("cancelled");
	});

	test("throws BackupJobFailedError when the job disappears", async () => {
		await expect(waitForBackupJob(() => Promise.resolve(null))).rejects.toThrow(
			BackupJobFailedError
		);
	});
});
