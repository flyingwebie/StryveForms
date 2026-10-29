import type { FormField } from "@StryveForms/forms/types";
import { LAST_PAGE_KEY } from "@StryveForms/forms/types";
import { describe, expect, test } from "bun:test";

import {
	addPage,
	materializeImplicitPages,
	mergeWithNextPage,
	moveFieldToPage,
	moveImplicitPageBy,
	movePage,
	removeEmptyPage,
	splitPage,
	toEditorPages,
} from "./pages-model";

function text(id: string, image?: FormField["image"]): FormField {
	return { id, image, name: id, type: "text" };
}

function layoutText(id: string): FormField {
	return { id, name: id, type: "nf-text" };
}

function brk(id: string): FormField {
	return { id, name: "Page break", type: "nf-page-break" };
}

describe("toEditorPages — explicit (at least one page break)", () => {
	test("groups fields by page and excludes the break itself", () => {
		const pages = toEditorPages([text("a"), text("b"), brk("p1"), text("c")]);
		expect(pages).toEqual([
			{ fields: [text("a"), text("b")], key: "p1" },
			{ fields: [text("c")], key: LAST_PAGE_KEY },
		]);
	});
});

describe("toEditorPages — implicit (no page breaks: one page per question)", () => {
	test("one question, one page, keyed and imaged by that question", () => {
		expect(toEditorPages([text("a")])).toEqual([
			{ fields: [text("a")], imageFieldId: "a", key: "a" },
		]);
	});

	test("every question gets its own page, matching the focused renderer's grouping", () => {
		const pages = toEditorPages([text("a"), text("b"), text("c")]);
		expect(pages.map((p) => p.key)).toEqual(["a", "b", "c"]);
		expect(pages.map((p) => p.fields.map((f) => f.id))).toEqual([
			["a"],
			["b"],
			["c"],
		]);
	});

	test("a leading nf-text attaches to the next question, which carries the page's image", () => {
		const pages = toEditorPages([layoutText("intro"), text("a")]);
		expect(pages).toEqual([
			{
				fields: [layoutText("intro"), text("a")],
				imageFieldId: "a",
				key: "a",
			},
		]);
	});
});

describe("materializeImplicitPages", () => {
	test("is a no-op once the form already has a page break", () => {
		const properties = [text("a"), brk("p1"), text("b")];
		expect(materializeImplicitPages(properties)).toEqual({
			pageImages: {},
			properties,
		});
	});

	test("is a no-op with zero or one implicit page (nothing to group)", () => {
		expect(materializeImplicitPages([])).toEqual({
			pageImages: {},
			properties: [],
		});
		const one = [text("a")];
		expect(materializeImplicitPages(one)).toEqual({
			pageImages: {},
			properties: one,
		});
	});

	test("inserts a break after every question and moves each one's image into pageImages, stripping it off the field", () => {
		const a = text("a", { layout: "stack", url: "/a.png" });
		const b = text("b"); // no image
		const c = text("c", { layout: "wallpaper", url: "/c.png" });
		const { pageImages, properties } = materializeImplicitPages([a, b, c]);

		// Structurally: a, <break>, b, <break>, c — same question order,
		// each still alone on its own page.
		const pages = toEditorPages(properties);
		expect(pages.map((p) => p.fields.map((f) => f.id))).toEqual([
			["a"],
			["b"],
			["c"],
		]);

		// "a"'s image moved to the break that now ends its page.
		expect(pageImages[pages[0].key]).toEqual({
			layout: "stack",
			url: "/a.png",
		});
		// "c" (the last page) has no trailing break, so it's keyed LAST_PAGE_KEY.
		expect(pages[2].key).toBe(LAST_PAGE_KEY);
		expect(pageImages[LAST_PAGE_KEY]).toEqual({
			layout: "wallpaper",
			url: "/c.png",
		});
		// Nothing visibly changes: the fields no longer carry the image
		// themselves (it's page-owned now), and "b" never had one.
		for (const field of properties) {
			if (field.type !== "nf-page-break") {
				expect(field.image).toBeUndefined();
			}
		}
	});
});

describe("moveImplicitPageBy", () => {
	test("reorders whole questions without inserting any break", () => {
		const properties = [text("a"), text("b"), text("c")];
		const next = moveImplicitPageBy(properties, 0, 1);
		expect(next.map((f) => f.id)).toEqual(["b", "a", "c"]);
		expect(next.some((f) => f.type === "nf-page-break")).toBe(false);
	});

	test("moves an attached nf-text along with its question", () => {
		const properties = [layoutText("intro"), text("a"), text("b")];
		const next = moveImplicitPageBy(properties, 0, 1);
		expect(next.map((f) => f.id)).toEqual(["b", "intro", "a"]);
	});

	test("is a no-op past either end", () => {
		const properties = [text("a"), text("b")];
		expect(moveImplicitPageBy(properties, 0, -1)).toEqual(properties);
		expect(moveImplicitPageBy(properties, 1, 1)).toEqual(properties);
	});
});

describe("removeEmptyPage", () => {
	test("drops an empty explicit page", () => {
		const properties = [brk("p1"), text("a")];
		const { properties: next } = removeEmptyPage(properties, {}, "p1");
		const pages = toEditorPages(next);
		expect(pages).toHaveLength(1);
		expect(pages[0].fields.map((f) => f.id)).toEqual(["a"]);
	});

	test("is a no-op when the page still has fields", () => {
		const properties = [text("a"), brk("p1"), text("b")];
		expect(removeEmptyPage(properties, {}, "p1")).toEqual({
			pageImages: {},
			properties,
		});
	});

	test("keeps 2+ grouped real questions explicit instead of collapsing to zero breaks", () => {
		const properties = [brk("p1"), text("a"), text("b")];
		const { properties: next } = removeEmptyPage(properties, {}, "p1");
		expect(next.some((f) => f.type === "nf-page-break")).toBe(true);
		const pages = toEditorPages(next);
		expect(pages.map((p) => p.fields.map((f) => f.id))).toEqual([
			["a", "b"],
			[],
		]);
	});
});

describe("addPage", () => {
	test("appends an empty page and carries the previous last page's image to its new real key", () => {
		const properties = [text("a"), text("b")];
		const { pageImages, properties: next } = addPage(properties, {
			[LAST_PAGE_KEY]: { url: "/hero.png" },
		});
		const pages = toEditorPages(next);
		expect(pages).toHaveLength(2);
		expect(pages[1].fields).toEqual([]);
		expect(pages[1].key).toBe(LAST_PAGE_KEY);
		// The old last page's image now lives under the new break's id, not
		// LAST_PAGE_KEY (which belongs to the new, still-empty final page).
		expect(pageImages[LAST_PAGE_KEY]).toBeUndefined();
		expect(pageImages[pages[0].key]).toEqual({ url: "/hero.png" });
	});
});

describe("splitPage", () => {
	test("splits after a field, giving each half a distinct key", () => {
		const properties = [text("a"), text("b"), text("c")];
		const next = splitPage(properties, "b");
		const pages = toEditorPages(next);
		expect(pages.map((p) => p.fields.map((f) => f.id))).toEqual([
			["a", "b"],
			["c"],
		]);
		expect(pages[0].key).not.toBe(pages[1].key);
		expect(pages[1].key).toBe(LAST_PAGE_KEY);
	});

	test("is a no-op when splitting after the page's last field", () => {
		const properties = [text("a"), text("b")];
		expect(splitPage(properties, "b")).toEqual(properties);
	});
});

describe("mergeWithNextPage", () => {
	test("combines two pages into one, keeping it explicit via a trailing empty page (2 real questions can't be zero breaks)", () => {
		const properties = [text("a"), brk("p1"), text("b")];
		const { pageImages, properties: next } = mergeWithNextPage(
			properties,
			{ p1: { url: "/old.png" } },
			"p1"
		);
		expect(next.some((f) => f.type === "nf-page-break")).toBe(true);
		const pages = toEditorPages(next);
		expect(pages.map((p) => p.fields.map((f) => f.id))).toEqual([
			["a", "b"],
			[],
		]);
		// The merged-away page's image carried forward onto the survivor,
		// under whatever key it ended up with (not LAST_PAGE_KEY anymore —
		// that now belongs to the fresh trailing empty page).
		expect(pageImages[pages[0].key]).toEqual({ url: "/old.png" });
		expect(pageImages.p1).toBeUndefined();
		expect(pageImages[LAST_PAGE_KEY]).toBeUndefined();
	});

	test("combining into a single-real-field page doesn't need to stay explicit", () => {
		const properties = [brk("p1"), text("a")];
		const { properties: next } = mergeWithNextPage(properties, {}, "p1");
		// Nothing to merge forward (p1's page is empty), so this just drops
		// the break — one real question needs no page break to stay itself.
		expect(toEditorPages(next)).toEqual([
			{ fields: [text("a")], imageFieldId: "a", key: "a" },
		]);
	});

	test("keeps the surviving page's own image when it already has one", () => {
		const properties = [text("a"), brk("p1"), text("b")];
		const { pageImages, properties: next } = mergeWithNextPage(
			properties,
			{ p1: { url: "/old.png" }, [LAST_PAGE_KEY]: { url: "/new.png" } },
			"p1"
		);
		const pages = toEditorPages(next);
		expect(pageImages[pages[0].key]).toEqual({ url: "/new.png" });
	});
});

describe("movePage", () => {
	test("reorders whole pages, each keeping its own key", () => {
		const properties = [text("a"), brk("p1"), text("b")];
		const next = movePage(properties, LAST_PAGE_KEY, -1);
		const pages = toEditorPages(next);
		expect(pages.map((p) => p.fields.map((f) => f.id))).toEqual([["b"], ["a"]]);
	});

	test("is a no-op at the first/last position", () => {
		const properties = [text("a"), brk("p1"), text("b")];
		expect(movePage(properties, "p1", -1)).toEqual(properties);
		expect(movePage(properties, LAST_PAGE_KEY, 1)).toEqual(properties);
	});
});

describe("moveFieldToPage", () => {
	test("moves a field out of its page and onto the end of another", () => {
		const properties = [text("a"), text("b"), brk("p1"), text("c")];
		const next = moveFieldToPage(properties, "a", LAST_PAGE_KEY);
		const pages = toEditorPages(next);
		expect(pages.map((p) => p.fields.map((f) => f.id))).toEqual([
			["b"],
			["c", "a"],
		]);
	});
});
