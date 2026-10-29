import { describe, expect, test } from "bun:test";

import { conditionsMet, resolveFieldState } from "./logic";
import { mentionHtml, resolveMentions } from "./mentions";
import {
	type BlockImage,
	type FormField,
	LAST_PAGE_KEY,
	resolvePageImage,
	splitIntoPagesWithKeys,
} from "./types";
import { matchesInputMask, validateSubmission } from "./validation";
import { displayFileName, formatFieldValue } from "./values";

const DATE_DISPLAY = /2[12]\/10\/2026/;

const nameField: FormField = {
	id: "name",
	name: "Name",
	type: "text",
	required: true,
};
const plan: FormField = {
	id: "plan",
	name: "Plan",
	type: "select",
	select: {
		options: [
			{ id: "a", name: "Free" },
			{ id: "b", name: "Pro" },
		],
	},
};
const company: FormField = {
	id: "company",
	name: "Company",
	type: "text",
	hidden: true,
	logic: {
		actions: ["show-block", "require-answer"],
		conditions: {
			children: [
				{
					identifier: "plan",
					value: {
						operator: "equals",
						property_meta: { id: "plan", type: "select" },
						value: "Pro",
					},
				},
			],
			operatorIdentifier: "and",
		},
	},
};

describe("logic", () => {
	test("shows and requires a field when the condition matches", () => {
		expect(resolveFieldState(company, { plan: "Free" })).toEqual({
			disabled: false,
			hidden: true,
			required: false,
		});
		expect(resolveFieldState(company, { plan: "Pro" })).toEqual({
			disabled: false,
			hidden: false,
			required: true,
		});
	});

	test("or groups and numeric comparisons", () => {
		const tree = {
			children: [
				{
					value: {
						operator: "greater_than",
						property_meta: { id: "age", type: "number" },
						value: 17,
					},
				},
				{
					value: {
						operator: "is_checked",
						property_meta: { id: "ok", type: "checkbox" },
					},
				},
			],
			operatorIdentifier: "or" as const,
		};
		expect(conditionsMet(tree, { age: "21" })).toBe(true);
		expect(conditionsMet(tree, { age: 12, ok: true })).toBe(true);
		expect(conditionsMet(tree, { age: 12, ok: false })).toBe(false);
	});
});

describe("validation", () => {
	test("required, select name mapping and conditional requirement", () => {
		const fields = [nameField, plan, company];
		const bad = validateSubmission(fields, { plan: "b" });
		expect(bad.errors.name).toBeDefined();
		expect(bad.errors.company).toBeDefined();
		const ok = validateSubmission(fields, { name: "Ada", plan: "a" });
		expect(ok.valid).toBe(true);
		expect(ok.data.plan).toBe("Free");
	});

	test("input masks", () => {
		expect(matchesInputMask("(999) 999-9999", "(555) 123-4567")).toBe(true);
		expect(matchesInputMask("(999) 999-9999", "555-1234")).toBe(false);
		expect(matchesInputMask("aa-99?9", "AB-12")).toBe(true);
	});

	test("phone numbers are normalised to E.164", () => {
		const phone: FormField = { id: "p", name: "Phone", type: "phone_number" };
		expect(validateSubmission([phone], { p: "US+12025550142" }).data.p).toBe(
			"+12025550142"
		);
		expect(validateSubmission([phone], { p: "123" }).valid).toBe(false);
	});
});

describe("mentions", () => {
	test("resolves values, fallbacks and removes empty mentions", () => {
		const html = `<p>Hi ${mentionHtml(nameField, "there")}, plan: ${mentionHtml(plan)}</p>`;
		expect(resolveMentions(html, { name: "<Ada>" })).toBe(
			"<p>Hi &lt;Ada&gt;, plan: </p>"
		);
		expect(resolveMentions(html, {}, { mode: "text" })).toBe("Hi there, plan:");
		expect(
			resolveMentions(
				`https://x.com/?n=${mentionHtml(nameField)}`,
				{ name: "A B" },
				{ mode: "url" }
			)
		).toBe("https://x.com/?n=A%20B");
	});
});

describe("focused pages", () => {
	const q1: FormField = { id: "q1", name: "Q1", type: "text" };
	const q2: FormField = { id: "q2", name: "Q2", type: "text" };
	const q3: FormField = { id: "q3", name: "Q3", type: "text" };
	const brk: FormField = {
		id: "brk1",
		name: "Page break",
		type: "nf-page-break",
	};

	test("splitIntoPagesWithKeys keys pages by their trailing break id, last page by LAST_PAGE_KEY", () => {
		const pages = splitIntoPagesWithKeys([q1, q2, brk, q3]);
		expect(pages).toHaveLength(2);
		const [first, second] = pages;
		expect(first?.key).toBe("brk1");
		expect(first?.fields.map((f) => f.id)).toEqual(["q1", "q2", "brk1"]);
		expect(second?.key).toBe(LAST_PAGE_KEY);
		expect(second?.fields.map((f) => f.id)).toEqual(["q3"]);
	});

	test("a hidden page break doesn't split the page", () => {
		const hiddenBreak: FormField = { ...brk, hidden: true };
		const pages = splitIntoPagesWithKeys([q1, hiddenBreak, q2]);
		expect(pages).toHaveLength(1);
		expect(pages[0]?.key).toBe(LAST_PAGE_KEY);
	});

	test("resolvePageImage prefers the stored page image over a field's", () => {
		const fieldImage: BlockImage = { layout: "stack", url: "/field.png" };
		const pageImage: BlockImage = { layout: "wallpaper", url: "/page.png" };
		const fields = [{ ...q1, image: fieldImage }, q2];

		// No pageImages entry yet: falls back to the field carrying one
		// (backward compatibility with forms saved before this round).
		expect(resolvePageImage(fields, undefined, "brk1")).toEqual(fieldImage);

		// Once the page has its own stored image, it wins.
		expect(resolvePageImage(fields, { brk1: pageImage }, "brk1")).toEqual(
			pageImage
		);
	});

	test("resolvePageImage keeps following the field that carries the image when fields reorder", () => {
		const fieldImage: BlockImage = { layout: "stack", url: "/field.png" };
		const fields = [{ ...q1, image: fieldImage }, q2];
		const reordered = [q2, { ...q1, image: fieldImage }];
		expect(resolvePageImage(fields, undefined, LAST_PAGE_KEY)).toEqual(
			fieldImage
		);
		expect(resolvePageImage(reordered, undefined, LAST_PAGE_KEY)).toEqual(
			fieldImage
		);
	});
});

describe("values", () => {
	test("file names and dates", () => {
		expect(
			displayFileName("report_123e4567-e89b-12d3-a456-426614174000.pdf")
		).toBe("report.pdf");
		const date: FormField = {
			id: "d",
			name: "Date",
			type: "date",
			date_format: "dd/MM/yyyy",
		};
		expect(formatFieldValue(date, "2026-10-22")).toMatch(DATE_DISPLAY);
	});
});
