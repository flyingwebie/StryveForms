import type { FormField } from "@StryveForms/forms/types";
import { describe, expect, test } from "bun:test";

import { buildSubmissionSections } from "./submission-sections";

function field(overrides: Partial<FormField> & { id: string }): FormField {
	return { name: overrides.id, type: "text", ...overrides };
}

describe("buildSubmissionSections", () => {
	test("a single page with no headings becomes one 'Answers' section", () => {
		const sections = buildSubmissionSections([
			field({ id: "name" }),
			field({ id: "email", type: "email" }),
		]);
		expect(sections).toEqual([
			{
				fields: [field({ id: "name" }), field({ id: "email", type: "email" })],
				kind: "page",
				title: "Answers",
			},
		]);
	});

	test("page breaks split fields into numbered page sections", () => {
		const sections = buildSubmissionSections([
			field({ id: "a" }),
			field({ id: "break1", type: "nf-page-break" }),
			field({ id: "b" }),
		]);
		expect(sections.map((s) => s.title)).toEqual(["Page 1", "Page 2"]);
		expect(sections[0]?.fields.map((f) => f.id)).toEqual(["a"]);
		expect(sections[1]?.fields.map((f) => f.id)).toEqual(["b"]);
	});

	test("a hidden page break does not split the page", () => {
		const sections = buildSubmissionSections([
			field({ id: "a" }),
			field({ hidden: true, id: "break1", type: "nf-page-break" }),
			field({ id: "b" }),
		]);
		expect(sections).toHaveLength(1);
		expect(sections[0]?.fields.map((f) => f.id)).toEqual(["a", "b"]);
	});

	test("an nf-text heading titles the section that follows it", () => {
		const sections = buildSubmissionSections([
			field({ content: "<b>Contact info</b>", id: "h1", type: "nf-text" }),
			field({ id: "a" }),
		]);
		expect(sections).toEqual([
			{ fields: [field({ id: "a" })], kind: "page", title: "Contact info" },
		]);
	});

	test("a heading at the start of a later page overrides the page number title", () => {
		const sections = buildSubmissionSections([
			field({ id: "a" }),
			field({ id: "break1", type: "nf-page-break" }),
			field({ content: "Shipping", id: "h1", type: "nf-text" }),
			field({ id: "b" }),
		]);
		expect(sections.map((s) => s.title)).toEqual(["Page 1", "Shipping"]);
	});

	test("hidden fields are pulled into their own section, in form order", () => {
		const sections = buildSubmissionSections([
			field({ id: "a" }),
			field({ hidden: true, id: "utm_source" }),
			field({ id: "break1", type: "nf-page-break" }),
			field({ hidden: true, id: "ref" }),
		]);
		expect(sections).toEqual([
			{ fields: [field({ id: "a" })], kind: "page", title: "Page 1" },
			{
				fields: [
					field({ hidden: true, id: "utm_source" }),
					field({ hidden: true, id: "ref" }),
				],
				kind: "hidden",
				title: "Hidden & URL fields",
			},
		]);
	});

	test("fields removed from the form still show, under their own section", () => {
		const sections = buildSubmissionSections(
			[field({ id: "a" })],
			[field({ id: "old" })]
		);
		expect(sections).toEqual([
			{ fields: [field({ id: "a" })], kind: "page", title: "Answers" },
			{
				fields: [field({ id: "old" })],
				kind: "removed",
				title: "Fields no longer in the form",
			},
		]);
	});

	test("a removed field still present in properties (e.g. re-added) is not duplicated", () => {
		const sections = buildSubmissionSections(
			[field({ id: "a" })],
			[field({ id: "a" })]
		);
		expect(sections.every((s) => s.kind !== "removed")).toBe(true);
	});

	test("layout blocks other than text/page-break are not treated as answers", () => {
		const sections = buildSubmissionSections([
			field({ id: "a" }),
			field({ id: "img1", type: "nf-image" }),
			field({ id: "b" }),
		]);
		expect(sections[0]?.fields.map((f) => f.id)).toEqual(["a", "b"]);
	});
});
