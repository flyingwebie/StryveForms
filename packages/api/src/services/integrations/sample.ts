/**
 * Builds a realistic-looking sample submission for a form, so the "Send
 * test" button can exercise a real integration delivery without needing an
 * actual submission on file.
 */

import type { FormField } from "@StryveForms/forms/types";
import { fieldOptions } from "@StryveForms/forms/types";
import { answerFields } from "@StryveForms/forms/values";
import type { FormRow } from "../../lib/serialize";
import type { SubmissionRow } from "./payload";

const SAMPLE_NAMES = ["Jane Doe", "Alex Rivera", "Sam Okafor"];

function sampleMatrixValue(field: FormField): Record<string, string> {
	const rows = (field.rows ?? ["Row 1", "Row 2"]) as string[];
	const columns = (field.columns ?? ["Column 1"]) as string[];
	const value: Record<string, string> = {};
	for (const row of rows) {
		value[row] = String(columns[0] ?? "Column 1");
	}
	return value;
}

/** A plausible sample answer for one field, matching its type's stored shape. */
export function sampleFieldValue(field: FormField): unknown {
	const options = fieldOptions(field);
	switch (field.type) {
		case "text":
			return field.multi_lines
				? "This is a sample multi-line answer, used only for a test send."
				: SAMPLE_NAMES[0];
		case "rich_text":
			return "<p>This is a <strong>sample</strong> answer for a test send.</p>";
		case "email":
			return "jane@example.com";
		case "phone_number":
			return "+1 555-0100";
		case "url":
			return "https://example.com";
		case "number":
			return 42;
		case "date":
			return new Date().toISOString();
		case "checkbox":
			return true;
		case "select":
			return options[0]?.id ?? "Option 1";
		case "multi_select":
			return options.slice(0, 2).map((option) => option.id);
		case "matrix":
			return sampleMatrixValue(field);
		case "rating":
			return Math.min(field.rating_max_value ?? 5, 5);
		case "scale":
			return field.scale_min_value ?? 1;
		case "slider":
			return field.slider_min_value ?? 50;
		case "files":
			return ["sample-file_00000000-0000-0000-0000-000000000000.pdf"];
		case "signature":
			return ["sample-signature_00000000-0000-0000-0000-000000000000.png"];
		case "barcode":
			return "012345678905";
		case "payment":
			return "sample_payment";
		default:
			return "Sample answer";
	}
}

/** Sample answers for every answerable field on a form, keyed by field id. */
export function buildSampleData(
	fields: FormField[],
	removed: FormField[] = []
): Record<string, unknown> {
	const data: Record<string, unknown> = {};
	for (const field of answerFields(fields, removed)) {
		data[field.id] = sampleFieldValue(field);
	}
	return data;
}

/**
 * A fake, never-persisted submission row, for test sends. Carries an obviously
 * fake id/publicId so a receiver can't confuse it with a real submission.
 */
export function buildSampleSubmission(form: FormRow): SubmissionRow {
	const now = new Date();
	return {
		completionTime: 42,
		createdAt: now,
		data: buildSampleData(
			form.properties as FormField[],
			form.removedProperties as FormField[]
		),
		formId: form.id,
		id: "test-submission",
		legacyOpnformId: null,
		meta: {},
		publicId: "test-submission",
		status: "completed",
		updatedAt: now,
	} as SubmissionRow;
}
