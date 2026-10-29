import { describe, expect, test } from "bun:test";

import { computeSubtreeIds } from "./folders";

const ROWS = [
	{ id: "marketing", parentId: null },
	{ id: "campaigns", parentId: "marketing" },
	{ id: "social", parentId: "campaigns" },
	{ id: "hr", parentId: null },
	{ id: "onboarding", parentId: "hr" },
];

describe("computeSubtreeIds", () => {
	test("includes the root plus every nested descendant", () => {
		const ids = computeSubtreeIds(ROWS, "marketing");
		expect(new Set(ids)).toEqual(new Set(["marketing", "campaigns", "social"]));
	});

	test("a leaf folder with no children returns just itself", () => {
		expect(computeSubtreeIds(ROWS, "social")).toEqual(["social"]);
	});

	test("doesn't cross into an unrelated branch", () => {
		const ids = computeSubtreeIds(ROWS, "hr");
		expect(ids).not.toContain("marketing");
		expect(ids).not.toContain("campaigns");
		expect(new Set(ids)).toEqual(new Set(["hr", "onboarding"]));
	});

	test("an unknown root id returns just that id (no matches, no crash)", () => {
		expect(computeSubtreeIds(ROWS, "ghost")).toEqual(["ghost"]);
	});
});
