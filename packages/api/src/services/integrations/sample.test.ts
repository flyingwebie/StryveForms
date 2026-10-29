import type { FormField } from "@StryveForms/forms/types";
import { describe, expect, test } from "bun:test";

import type { FormRow } from "../../lib/serialize";
import {
	buildSampleData,
	buildSampleSubmission,
	sampleFieldValue,
} from "./sample";

const FIELD_TYPES: FormField["type"][] = [
	"text",
	"rich_text",
	"date",
	"url",
	"phone_number",
	"email",
	"checkbox",
	"select",
	"multi_select",
	"matrix",
	"number",
	"rating",
	"scale",
	"slider",
	"files",
	"signature",
	"barcode",
	"payment",
];

function field(overrides: Partial<FormField>): FormField {
	return { id: "f1", name: "Field", type: "text", ...overrides };
}

describe("sampleFieldValue", () => {
	test("produces a non-empty, type-appropriate value for every input field type", () => {
		for (const type of FIELD_TYPES) {
			const value = sampleFieldValue(field({ type }));
			expect(value).not.toBeUndefined();
			expect(value).not.toBeNull();
			if (typeof value === "string") {
				expect(value.length).toBeGreaterThan(0);
			}
		}
	});

	test("picks an option id for select fields", () => {
		const value = sampleFieldValue(
			field({
				select: { options: [{ id: "opt-a", name: "A" }] },
				type: "select",
			})
		);
		expect(value).toBe("opt-a");
	});

	test("picks up to two option ids for multi-select fields", () => {
		const value = sampleFieldValue(
			field({
				multi_select: {
					options: [
						{ id: "a", name: "A" },
						{ id: "b", name: "B" },
						{ id: "c", name: "C" },
					],
				},
				type: "multi_select",
			})
		);
		expect(value).toEqual(["a", "b"]);
	});

	test("respects a field's own min values for rating/scale/slider", () => {
		expect(
			sampleFieldValue(field({ rating_max_value: 10, type: "rating" }))
		).toBe(5);
		expect(sampleFieldValue(field({ scale_min_value: 3, type: "scale" }))).toBe(
			3
		);
		expect(
			sampleFieldValue(field({ slider_min_value: 20, type: "slider" }))
		).toBe(20);
	});

	test("builds a matrix answer keyed by row, using the first column", () => {
		const value = sampleFieldValue(
			field({
				columns: ["Col A", "Col B"],
				rows: ["Row 1", "Row 2"],
				type: "matrix",
			})
		);
		expect(value).toEqual({ "Row 1": "Col A", "Row 2": "Col A" });
	});
});

describe("buildSampleData", () => {
	test("keys the sample by field id, skipping layout blocks", () => {
		const data = buildSampleData([
			field({ id: "name", type: "text" }),
			field({ id: "email", type: "email" }),
			field({ id: "break", type: "nf-page-break" }),
		]);
		expect(Object.keys(data).sort()).toEqual(["email", "name"]);
	});
});

describe("buildSampleSubmission", () => {
	test("builds a submission with obviously fake ids and completed status", () => {
		const form = {
			id: "form-1",
			properties: [field({ id: "name", type: "text" })],
			removedProperties: [],
		} as unknown as FormRow;
		const submission = buildSampleSubmission(form);
		expect(submission.id).toBe("test-submission");
		expect(submission.publicId).toBe("test-submission");
		expect(submission.formId).toBe("form-1");
		expect(submission.status).toBe("completed");
		expect(submission.data.name).toBeDefined();
	});
});
