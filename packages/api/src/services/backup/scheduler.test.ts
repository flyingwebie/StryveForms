import { describe, expect, test } from "bun:test";

import {
	advisoryLockKey,
	type BackupScheduleConfig,
	isBackupDue,
	type RetainableBackup,
	resolveBackupSettings,
	selectBackupsToExpire,
	withAdvisoryLock,
} from "./scheduler";

const BASE_SCHEDULE: BackupScheduleConfig = {
	destinationId: null,
	enabled: true,
	frequency: "daily",
	time: "03:00",
	timezone: "UTC",
	weekday: 0,
};

describe("isBackupDue", () => {
	test("is never due when disabled", () => {
		const schedule = { ...BASE_SCHEDULE, enabled: false };
		expect(isBackupDue(schedule, new Date("2026-01-01T03:30:00Z"), null)).toBe(
			false
		);
	});

	test("not due before the scheduled time today", () => {
		expect(
			isBackupDue(BASE_SCHEDULE, new Date("2026-01-01T02:59:00Z"), null)
		).toBe(false);
	});

	test("due right at the scheduled time with no prior run", () => {
		expect(
			isBackupDue(BASE_SCHEDULE, new Date("2026-01-01T03:00:00Z"), null)
		).toBe(true);
	});

	test("due later the same day with no prior run", () => {
		expect(
			isBackupDue(BASE_SCHEDULE, new Date("2026-01-01T14:00:00Z"), null)
		).toBe(true);
	});

	test("not due again the same day once it already ran", () => {
		const lastRunAt = new Date("2026-01-01T03:05:00Z");
		expect(
			isBackupDue(BASE_SCHEDULE, new Date("2026-01-01T10:00:00Z"), lastRunAt)
		).toBe(false);
	});

	test("due again the next day after the scheduled time", () => {
		const lastRunAt = new Date("2026-01-01T03:05:00Z");
		expect(
			isBackupDue(BASE_SCHEDULE, new Date("2026-01-02T03:00:00Z"), lastRunAt)
		).toBe(true);
	});

	test("catches up the day after a missed run (scheduler was down)", () => {
		const lastRunAt = new Date("2025-12-30T03:05:00Z");
		expect(
			isBackupDue(BASE_SCHEDULE, new Date("2026-01-02T09:00:00Z"), lastRunAt)
		).toBe(true);
	});

	test("weekly: only due on the configured weekday", () => {
		const weekly: BackupScheduleConfig = {
			...BASE_SCHEDULE,
			frequency: "weekly",
			weekday: 4, // Thursday
		};
		// 2026-01-01 is a Thursday.
		expect(isBackupDue(weekly, new Date("2026-01-01T03:00:00Z"), null)).toBe(
			true
		);
		// 2026-01-02 is a Friday.
		expect(isBackupDue(weekly, new Date("2026-01-02T03:00:00Z"), null)).toBe(
			false
		);
	});

	test("respects a non-UTC timezone", () => {
		// 03:00 in America/New_York (UTC-5 in January) is 08:00 UTC.
		const nyc: BackupScheduleConfig = {
			...BASE_SCHEDULE,
			timezone: "America/New_York",
		};
		expect(isBackupDue(nyc, new Date("2026-01-01T07:59:00Z"), null)).toBe(
			false
		);
		expect(isBackupDue(nyc, new Date("2026-01-01T08:00:00Z"), null)).toBe(true);
	});
});

describe("selectBackupsToExpire", () => {
	function backup(id: string, daysAgo: number): RetainableBackup {
		return {
			finishedAt: new Date(Date.now() - daysAgo * 86_400_000),
			id,
		};
	}

	test("keeps the most recent N, expires the rest", () => {
		const backups = [
			backup("a", 0),
			backup("b", 1),
			backup("c", 2),
			backup("d", 3),
			backup("e", 4),
		];
		const expired = selectBackupsToExpire(backups, 3);
		expect(expired.map((b) => b.id).sort()).toEqual(["d", "e"]);
	});

	test("expires nothing when under the limit", () => {
		const backups = [backup("a", 0), backup("b", 1)];
		expect(selectBackupsToExpire(backups, 7)).toEqual([]);
	});

	test("a non-positive keepLast keeps everything (caller's safety net, not a 'delete all')", () => {
		const backups = [backup("a", 0), backup("b", 1)];
		expect(selectBackupsToExpire(backups, 0)).toHaveLength(2);
	});
});

describe("resolveBackupSettings", () => {
	test("fills in every default from an empty object", () => {
		const resolved = resolveBackupSettings({});
		expect(resolved.destinations).toEqual([]);
		expect(resolved.schedule.enabled).toBe(false);
		expect(resolved.schedule.frequency).toBe("daily");
		expect(resolved.retention.keepLast).toBe(7);
		expect(resolved.passphraseEncrypted).toBeNull();
	});

	test("falls back to defaults entirely for garbage input", () => {
		const resolved = resolveBackupSettings({
			schedule: "not an object",
		} as never);
		expect(resolved.schedule.frequency).toBe("daily");
	});

	test("preserves a partially-filled schedule, keeping other fields' defaults", () => {
		const resolved = resolveBackupSettings({
			schedule: { enabled: true, time: "04:30" },
		});
		expect(resolved.schedule.enabled).toBe(true);
		expect(resolved.schedule.time).toBe("04:30");
		expect(resolved.schedule.timezone).toBe("UTC");
	});
});

describe("advisoryLockKey", () => {
	test("is deterministic for the same name", () => {
		expect(advisoryLockKey("stryveforms:scheduled-backup")).toBe(
			advisoryLockKey("stryveforms:scheduled-backup")
		);
	});

	test("differs for different names", () => {
		expect(advisoryLockKey("a")).not.toBe(advisoryLockKey("b"));
	});
});

describe("withAdvisoryLock", () => {
	function fakePool(locked: boolean) {
		const calls: string[] = [];
		let released = false;
		return {
			calls,
			pool: {
				connect: async () => ({
					query: (sql: string) => {
						calls.push(sql);
						if (sql.includes("pg_try_advisory_lock")) {
							return Promise.resolve({ rows: [{ locked }] });
						}
						return Promise.resolve({ rows: [] });
					},
					release: () => {
						released = true;
					},
				}),
			},
			wasReleased: () => released,
		};
	}

	test("runs fn and unlocks + releases when the lock is acquired", async () => {
		const { pool, calls, wasReleased } = fakePool(true);
		let ran = false;
		const result = await withAdvisoryLock(pool, "test-lock", () => {
			ran = true;
			return Promise.resolve("done");
		});
		expect(ran).toBe(true);
		expect(result).toEqual({ locked: true, result: "done" });
		expect(calls.some((c) => c.includes("pg_advisory_unlock"))).toBe(true);
		expect(wasReleased()).toBe(true);
	});

	test("skips fn and reports locked:false when another replica holds it", async () => {
		const { pool, wasReleased } = fakePool(false);
		let ran = false;
		const result = await withAdvisoryLock(pool, "test-lock", () => {
			ran = true;
			return Promise.resolve();
		});
		expect(ran).toBe(false);
		expect(result).toEqual({ locked: false });
		expect(wasReleased()).toBe(true);
	});

	test("still unlocks and releases when fn throws", async () => {
		const { pool, calls, wasReleased } = fakePool(true);
		await expect(
			withAdvisoryLock(pool, "test-lock", () => {
				throw new Error("boom");
			})
		).rejects.toThrow("boom");
		expect(calls.some((c) => c.includes("pg_advisory_unlock"))).toBe(true);
		expect(wasReleased()).toBe(true);
	});
});
