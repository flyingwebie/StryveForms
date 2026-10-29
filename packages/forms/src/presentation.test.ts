import { describe, expect, test } from "bun:test";

import {
	flattenToQuestions,
	prunePageImages,
	removePageBreak,
	restructureForStyle,
	styleSwitchImpact,
} from "./presentation";
import { type FormField, LAST_PAGE_KEY } from "./types";

const field = (id: string, type = "text", extra: Partial<FormField> = {}) =>
	({ id, name: id, type, ...extra }) as FormField;
const img = (url: string) => ({ layout: "stack" as const, url });

const twoPages = [
	field("a"),
	field("b"),
	field("break1", "nf-page-break"),
	field("c"),
	field("d"),
];

describe("prunePageImages", () => {
	test("keeps images of existing pages and drops orphans", () => {
		expect(
			prunePageImages(twoPages, {
				[LAST_PAGE_KEY]: img("last"),
				break1: img("one"),
				gone: img("x"),
			})
		).toEqual({ [LAST_PAGE_KEY]: img("last"), break1: img("one") });
	});

	test("empties the map when there are no page breaks", () => {
		expect(prunePageImages([field("a")], { page_break: img("x") })).toEqual({});
	});
});

describe("flattenToQuestions", () => {
	test("removes page breaks and moves page images onto each page's first field", () => {
		const result = flattenToQuestions(twoPages, {
			[LAST_PAGE_KEY]: img("last"),
			break1: img("one"),
		});
		expect(result.pageImages).toEqual({});
		expect(result.properties.map((f) => f.id)).toEqual(["a", "b", "c", "d"]);
		expect(result.properties[0]?.image?.url).toBe("one");
		expect(result.properties[2]?.image?.url).toBe("last");
		expect(result.properties[1]?.image).toBeUndefined();
	});

	test("doesn't overwrite a question that already has its own image", () => {
		const fields = [
			field("a"),
			field("b", "text", { image: img("own") }),
			field("break1", "nf-page-break"),
			field("c"),
		];
		const result = flattenToQuestions(fields, { break1: img("page") });
		expect(result.properties[0]?.image).toBeUndefined();
		expect(result.properties[1]?.image?.url).toBe("own");
	});
});

describe("removePageBreak", () => {
	test("merges into the next page, which inherits the image when it has none", () => {
		const fields = [...twoPages, field("break2", "nf-page-break"), field("e")];
		const result = removePageBreak(fields, { break1: img("one") }, "break1");
		expect(result.properties.some((f) => f.id === "break1")).toBe(false);
		expect(result.pageImages).toEqual({ break2: img("one") });
	});

	test("removing the last break goes back to one question per screen, keeping images", () => {
		const result = removePageBreak(
			twoPages,
			{ [LAST_PAGE_KEY]: img("last"), break1: img("one") },
			"break1"
		);
		expect(result.pageImages).toEqual({});
		expect(result.properties.map((f) => f.id)).toEqual(["a", "b", "c", "d"]);
		expect(result.properties[0]?.image?.url).toBe("one");
		expect(result.properties[2]?.image?.url).toBe("last");
	});
});

describe("styleSwitchImpact", () => {
	const fields = [
		field("a", "text", { image: img("q") }),
		field("div", "nf-divider"),
		field("pic", "nf-image"),
		field("break1", "nf-page-break"),
		field("c"),
	];

	test("to focused: classic-only blocks and page breaks", () => {
		const impact = styleSwitchImpact(fields, {}, "focused");
		expect(impact.removedBlocks.map((f) => f.id)).toEqual(["div", "pic"]);
		expect(impact.pageBreakCount).toBe(1);
	});

	test("to classic: counts question and live page images", () => {
		const impact = styleSwitchImpact(
			fields,
			{ break1: img("p"), orphan: img("o") },
			"classic"
		);
		expect(impact.hiddenQuestionImageCount).toBe(2);
		expect(impact.pageBreakCount).toBe(1);
	});
});

describe("restructureForStyle", () => {
	test("to focused, one per screen: no breaks, no classic-only blocks", () => {
		const result = restructureForStyle(
			[...twoPages, field("div", "nf-divider")],
			{},
			"focused",
			{ onePerScreen: true }
		);
		expect(result.properties.map((f) => f.id)).toEqual(["a", "b", "c", "d"]);
	});

	test("to focused, keeping pages", () => {
		const result = restructureForStyle(twoPages, {}, "focused");
		expect(result.properties).toHaveLength(5);
	});

	test("to classic: removes page breaks and keeps page images on questions", () => {
		const result = restructureForStyle(
			twoPages,
			{ break1: img("one") },
			"classic"
		);
		expect(result.properties.map((f) => f.id)).toEqual(["a", "b", "c", "d"]);
		expect(result.properties[0]?.image?.url).toBe("one");
		expect(result.pageImages).toEqual({});
	});
});
