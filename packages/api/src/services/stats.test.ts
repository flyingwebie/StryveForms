import type { FormField } from "@StryveForms/forms/types";
import { describe, expect, test } from "bun:test";

import { summarizeField } from "./stats";

function field(
	overrides: Partial<FormField> & { id: string; type: string }
): FormField {
	return { name: overrides.id, ...overrides } as FormField;
}

describe("summarizeField", () => {
	test("select: choice counts as a sorted distribution", () => {
		const summary = summarizeField(field({ id: "f1", type: "select" }), [
			"Red",
			"Red",
			"Blue",
			null,
		]);
		expect(summary.summaryType).toBe("distribution");
		expect(summary.answeredCount).toBe(3);
		expect(summary.data.distribution).toEqual([
			{ count: 2, percentage: 66.7, value: "Red" },
			{ count: 1, percentage: 33.3, value: "Blue" },
		]);
	});

	test("multi_select: counts every chosen option, not just the first", () => {
		const summary = summarizeField(field({ id: "f1", type: "multi_select" }), [
			["Red", "Blue"],
			["Red"],
		]);
		expect(summary.data.distribution).toEqual([
			{ count: 2, percentage: 100, value: "Red" },
			{ count: 1, percentage: 50, value: "Blue" },
		]);
	});

	test("number: average/min/max over answered values", () => {
		const summary = summarizeField(field({ id: "f1", type: "number" }), [
			10,
			20,
			30,
			null,
			"",
		]);
		expect(summary.summaryType).toBe("numeric_stats");
		expect(summary.answeredCount).toBe(3);
		expect(summary.data.average).toBe(20);
		expect(summary.data.min).toBe(10);
		expect(summary.data.max).toBe(30);
	});

	test("rating: averages like other numeric fields", () => {
		const summary = summarizeField(field({ id: "f1", type: "rating" }), [4, 5]);
		expect(summary.summaryType).toBe("rating");
		expect(summary.data.average).toBe(4.5);
	});

	test("scale and slider: numeric_stats summary type", () => {
		for (const type of ["scale", "slider"]) {
			const summary = summarizeField(field({ id: "f1", type }), [1, 2, 3]);
			expect(summary.summaryType).toBe("numeric_stats");
			expect(summary.data.average).toBe(2);
		}
	});

	test("text: a capped sample of recent answers, most recent first", () => {
		const answers = Array.from({ length: 25 }, (_, i) => `answer ${i}`);
		const summary = summarizeField(field({ id: "f1", type: "text" }), answers);
		expect(summary.summaryType).toBe("text_list");
		expect(summary.answeredCount).toBe(25);
		expect(summary.data.total).toBe(25);
		expect((summary.data.values as string[]).length).toBe(20);
		expect((summary.data.values as string[])[0]).toBe("answer 0");
	});

	test("checkbox (boolean): yes/no distribution", () => {
		const summary = summarizeField(field({ id: "f1", type: "checkbox" }), [
			true,
			true,
			false,
		]);
		expect(summary.summaryType).toBe("boolean");
		expect(summary.data.distribution).toEqual([
			{ count: 2, percentage: 66.7, value: "Yes" },
			{ count: 1, percentage: 33.3, value: "No" },
		]);
	});

	test("date: earliest/latest range", () => {
		const summary = summarizeField(field({ id: "f1", type: "date" }), [
			"2024-03-01",
			"2024-01-15",
			"2024-02-10",
		]);
		expect(summary.data.earliest).toBe("2024-01-15");
		expect(summary.data.latest).toBe("2024-03-01");
	});

	test("matrix: per-row distributions", () => {
		const summary = summarizeField(field({ id: "f1", type: "matrix" }), [
			{ Quality: "Good", Price: "Fair" },
			{ Quality: "Good", Price: "Good" },
		]);
		expect(summary.data.rows).toEqual({
			Quality: [{ count: 2, percentage: 100, value: "Good" }],
			Price: [
				{ count: 1, percentage: 50, value: "Fair" },
				{ count: 1, percentage: 50, value: "Good" },
			],
		});
	});

	test("files: joins file names instead of stringifying the array", () => {
		const summary = summarizeField(field({ id: "f1", type: "files" }), [
			["a.pdf", "b.pdf"],
		]);
		expect(summary.data.values).toEqual(["a.pdf, b.pdf"]);
	});

	test("no answers at all: zero counts, not an error", () => {
		const summary = summarizeField(field({ id: "f1", type: "number" }), [
			null,
			undefined,
			"",
		]);
		expect(summary.answeredCount).toBe(0);
		expect(summary.data.average).toBeNull();
	});
});
