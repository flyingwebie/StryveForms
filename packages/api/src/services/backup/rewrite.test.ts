import { describe, expect, test } from "bun:test";

import {
	fileReferenceMap,
	RemapTable,
	rewriteValueReferences,
} from "./rewrite";

describe("RemapTable", () => {
	test("get/set per entity kind", () => {
		const remap = new RemapTable();
		remap.set("form", "old-1", "new-1");
		remap.set("submission", "old-1", "new-sub-1");
		expect(remap.get("form", "old-1")).toBe("new-1");
		expect(remap.get("submission", "old-1")).toBe("new-sub-1");
		expect(remap.get("form", "unknown")).toBeUndefined();
	});

	test("getOrSame falls back to the original id when nothing was remapped", () => {
		const remap = new RemapTable();
		remap.set("folder", "a", "b");
		expect(remap.getOrSame("folder", "a")).toBe("b");
		expect(remap.getOrSame("folder", "never-set")).toBe("never-set");
	});
});

describe("rewriteValueReferences", () => {
	test("replaces a bare storage key wherever it appears as a string", () => {
		const map = new Map([["assets/old_logo.png", "assets/new_logo.png"]]);
		const value = {
			logoKey: "assets/old_logo.png",
			unrelated: "no match here",
		};
		const rewritten = rewriteValueReferences(value, map);
		expect(rewritten).toEqual({
			logoKey: "assets/new_logo.png",
			unrelated: "no match here",
		});
	});

	test("rewrites a key embedded inside a full signed URL", () => {
		const map = new Map([["assets/old_logo.png", "assets/new_logo.png"]]);
		const url =
			"https://host.example/api/assets/old_logo.png?expires=123&signature=abc";
		const rewritten = rewriteValueReferences(url, map);
		expect(rewritten).toBe(
			"https://host.example/api/assets/new_logo.png?expires=123&signature=abc"
		);
	});

	test("walks arrays and nested objects", () => {
		const map = new Map([["old-key", "new-key"]]);
		const value = {
			blocks: [
				{ id: "f1", settings: { imageKey: "old-key" } },
				{ id: "f2", settings: { imageKey: "unrelated-key" } },
			],
		};
		const rewritten = rewriteValueReferences(value, map) as typeof value;
		expect(rewritten.blocks[0]?.settings.imageKey).toBe("new-key");
		expect(rewritten.blocks[1]?.settings.imageKey).toBe("unrelated-key");
	});

	test("replaces every occurrence, not just the first", () => {
		const map = new Map([["a", "b"]]);
		expect(rewriteValueReferences("a-a-a", map)).toBe("b-b-b");
	});

	test("leaves numbers, booleans and null untouched", () => {
		const map = new Map([["1", "2"]]);
		const value = { count: 1, flag: true, missing: null };
		expect(rewriteValueReferences(value, map)).toEqual(value);
	});

	test("is a no-op with an empty replacement map", () => {
		const value = { key: "assets/old.png" };
		expect(rewriteValueReferences(value, new Map())).toEqual(value);
	});

	test("never touches unrelated text that merely looks similar", () => {
		const map = new Map([["assets/abc.png", "assets/xyz.png"]]);
		const value = "a completely unrelated sentence about abc and png files";
		expect(rewriteValueReferences(value, map)).toBe(value);
	});
});

describe("fileReferenceMap", () => {
	test("maps old storage keys to new ones, skipping unchanged keys", () => {
		const map = fileReferenceMap([
			{ newKey: "assets/new.png", oldKey: "assets/old.png" },
			{ newKey: "assets/same.png", oldKey: "assets/same.png" },
		]);
		expect(map.get("assets/old.png")).toBe("assets/new.png");
		expect(map.has("assets/same.png")).toBe(false);
	});

	test("also maps the built URL for each key when urlOf is given", () => {
		const urlOf = (key: string) => `https://host.example/api/${key}`;
		const map = fileReferenceMap(
			[{ newKey: "assets/new.png", oldKey: "assets/old.png" }],
			urlOf
		);
		expect(map.get("https://host.example/api/assets/old.png")).toBe(
			"https://host.example/api/assets/new.png"
		);
	});
});
