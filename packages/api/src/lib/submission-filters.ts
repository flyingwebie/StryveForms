import { formSubmission } from "@StryveForms/db/schema/forms";
import { type AnyColumn, and, asc, desc, eq, type SQL, sql } from "drizzle-orm";

/** Shared submission list/export filters: status, free-text search, date range. */
export interface SubmissionFilterInput {
	formId: string;
	from?: string;
	search?: string;
	status?: "all" | "completed" | "partial";
	to?: string;
}

export function submissionFilters(input: SubmissionFilterInput) {
	const filters = [eq(formSubmission.formId, input.formId)];
	if (input.status && input.status !== "all") {
		filters.push(eq(formSubmission.status, input.status));
	}
	if (input.search) {
		filters.push(
			sql`exists (select 1 from jsonb_each_text(${formSubmission.data}) as kv where kv.value ilike ${`%${input.search}%`})`
		);
	}
	if (input.from) {
		filters.push(sql`${formSubmission.createdAt} >= ${new Date(input.from)}`);
	}
	if (input.to) {
		filters.push(sql`${formSubmission.createdAt} <= ${new Date(input.to)}`);
	}
	return and(...filters);
}

const SORTABLE_COLUMNS: Record<string, AnyColumn> = {
	completionTime: formSubmission.completionTime,
	createdAt: formSubmission.createdAt,
	status: formSubmission.status,
};

/**
 * Resolves a `sortBy` request to a sortable SQL expression: either a real
 * column (createdAt, status, completionTime) or, for anything else, the
 * submission's jsonb answer under that field id — so submissions can be
 * sorted by any answer column, not just the built-in ones.
 */
export function submissionSortExpr(sortBy: string): AnyColumn | SQL {
	const column = SORTABLE_COLUMNS[sortBy];
	if (column) {
		return column;
	}
	return sql`${formSubmission.data} ->> ${sortBy}`;
}

export function submissionOrderBy(sortBy: string, sortDir: "asc" | "desc") {
	const expr = submissionSortExpr(sortBy);
	return sortDir === "asc" ? asc(expr) : desc(expr);
}
