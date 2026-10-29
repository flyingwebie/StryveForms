import type { Database } from "@StryveForms/db";
import { formSubmission } from "@StryveForms/db/schema/forms";
import type { FormField } from "@StryveForms/forms/types";
import {
	answerFields,
	displayValueToText,
	formatFieldValue,
} from "@StryveForms/forms/values";
import { and, inArray } from "drizzle-orm";

import type { AppConfig } from "../context";
import { submissionFileUrl } from "../lib/files";
import type { FormRow } from "../lib/serialize";
import {
	submissionFilters,
	submissionOrderBy,
} from "../lib/submission-filters";

const CSV_SPECIAL = /[",\n\r]/;
const FORMULA_START = /^[=+\-@\t\r]/;
const PAGE_SIZE = 1000;
const EXPORT_FILE_TTL = 7 * 24 * 60 * 60;

/** Quotes a CSV cell and defuses spreadsheet formulas. */
function cell(value: string): string {
	const safe = FORMULA_START.test(value) ? `'${value}` : value;
	return CSV_SPECIAL.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export interface ExportSubmissionsOptions {
	/** Only these field ids, in this order — the table's visible columns. */
	columns?: string[];
	/** ISO date-time bounds, same as the submissions table's date range. */
	from?: string;
	/** Only these submission ids (the current selection), when given. */
	ids?: string[];
	/** Free-text search across every answer, same as the submissions table. */
	search?: string;
	sortBy?: string;
	sortDir?: "asc" | "desc";
	status?: "completed" | "partial";
	to?: string;
}

/**
 * Streams a CSV of a form's submissions, matching whatever the submissions
 * table currently shows: the same status/search/date-range filters, the
 * same sort, a given selection of ids, and only the visible columns.
 */
export async function* exportSubmissionsCsv(
	db: Database,
	config: AppConfig,
	form: FormRow,
	options: ExportSubmissionsOptions = {}
): AsyncGenerator<string> {
	const allFields = answerFields(
		form.properties as FormField[],
		form.removedProperties as FormField[]
	);
	// When the caller passes a column list, use ITS order (the submissions
	// table's current column order), not the form's own field order.
	const fields = options.columns
		? options.columns
				.map((id) => allFields.find((f) => f.id === id))
				.filter((f): f is FormField => Boolean(f))
		: allFields;
	yield `${["Submitted at", "Status", ...fields.map((f) => f.name)].map(cell).join(",")}\n`;

	const where = and(
		submissionFilters({
			formId: form.id,
			from: options.from,
			search: options.search,
			status: options.status,
			to: options.to,
		}),
		options.ids?.length ? inArray(formSubmission.id, options.ids) : undefined
	);
	const orderBy = submissionOrderBy(
		options.sortBy ?? "createdAt",
		options.sortDir ?? "desc"
	);
	for (let offset = 0; ; offset += PAGE_SIZE) {
		// biome-ignore lint/performance/noAwaitInLoops: streaming page by page keeps memory flat
		const rows = await db
			.select()
			.from(formSubmission)
			.where(where)
			.orderBy(orderBy)
			.limit(PAGE_SIZE)
			.offset(offset);
		for (const row of rows) {
			const values = fields.map((field) =>
				displayValueToText(
					formatFieldValue(field, row.data[field.id], {
						fileUrl: (_id, name) =>
							submissionFileUrl(config, form.id, name, EXPORT_FILE_TTL),
					})
				)
			);
			yield `${[row.createdAt.toISOString(), row.status, ...values].map(cell).join(",")}\n`;
		}
		if (rows.length < PAGE_SIZE) {
			return;
		}
	}
}
