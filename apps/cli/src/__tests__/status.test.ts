import { describe, expect, test } from "bun:test";

import { requireStatus } from "../status";

describe("requireStatus", () => {
	test("returns undefined when the flag was omitted", () => {
		expect(requireStatus(undefined, false)).toBeUndefined();
	});

	test("passes through a valid status unchanged", () => {
		expect(requireStatus("active", false)).toBe("active");
		expect(requireStatus("inactive", false)).toBe("inactive");
	});

	// An invalid value calls `fail()`, which exits the process — covered by
	// reading the command files' usage, not exercised here to avoid killing
	// the test runner.
});
