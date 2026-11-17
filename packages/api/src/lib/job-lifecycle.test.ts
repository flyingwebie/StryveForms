import { describe, expect, test } from "bun:test";

import {
	isJobActive,
	isJobSettled,
	isJobUnsuccessful,
	JOB_STATUSES,
} from "./job-lifecycle";

describe("job lifecycle", () => {
	test("every status is either active or settled, never both", () => {
		for (const status of JOB_STATUSES) {
			expect(isJobActive(status)).toBe(!isJobSettled(status));
		}
	});

	test("a job that hasn't loaded is neither active nor settled", () => {
		expect(isJobActive(undefined)).toBe(false);
		expect(isJobSettled(undefined)).toBe(false);
		expect(isJobActive(null)).toBe(false);
	});

	test("cancelled counts as settled and unsuccessful", () => {
		expect(isJobSettled("cancelled")).toBe(true);
		expect(isJobUnsuccessful("cancelled")).toBe(true);
		expect(isJobUnsuccessful("failed")).toBe(true);
		expect(isJobUnsuccessful("completed")).toBe(false);
	});
});
