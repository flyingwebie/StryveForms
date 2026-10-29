import { describe, expect, test } from "bun:test";

import {
	isLucideIconValue,
	parseIconValue,
	toLucideIconValue,
} from "./icon-value";

describe("parseIconValue", () => {
	test("treats null/undefined/empty as none", () => {
		expect(parseIconValue(null)).toEqual({ kind: "none" });
		expect(parseIconValue(undefined)).toEqual({ kind: "none" });
		expect(parseIconValue("")).toEqual({ kind: "none" });
	});

	test("reads a plain emoji", () => {
		expect(parseIconValue("🚀")).toEqual({ kind: "emoji", value: "🚀" });
	});

	test("reads a lucide icon name", () => {
		expect(parseIconValue("lucide:briefcase")).toEqual({
			kind: "lucide",
			name: "briefcase",
		});
	});

	test("treats a bare lucide prefix with no name as none", () => {
		expect(parseIconValue("lucide:")).toEqual({ kind: "none" });
		expect(parseIconValue("lucide:  ")).toEqual({ kind: "none" });
	});

	test("trims whitespace around the icon name", () => {
		expect(parseIconValue("lucide: folder-heart ")).toEqual({
			kind: "lucide",
			name: "folder-heart",
		});
	});
});

describe("toLucideIconValue / isLucideIconValue", () => {
	test("round-trips a lucide icon name", () => {
		const stored = toLucideIconValue("alarm-clock-check");
		expect(stored).toBe("lucide:alarm-clock-check");
		expect(isLucideIconValue(stored)).toBe(true);
		expect(parseIconValue(stored)).toEqual({
			kind: "lucide",
			name: "alarm-clock-check",
		});
	});

	test("isLucideIconValue is false for emoji and empty values", () => {
		expect(isLucideIconValue("🚀")).toBe(false);
		expect(isLucideIconValue(null)).toBe(false);
		expect(isLucideIconValue(undefined)).toBe(false);
	});
});
