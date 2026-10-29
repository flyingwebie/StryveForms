/**
 * Submission statistics: the per-question summaries the Summary page shows
 * (choice counts, numeric averages, recent text answers…) and the overview
 * numbers (views, completion rate, average time). Shared by the `stats`
 * tRPC router (routers/stats.ts) and the AI assistant's
 * `get_submission_stats` tool (services/ai/tools.ts) — pulled out here
 * rather than having the tool import the router, which would create a
 * routers/index.ts -> ai.ts -> stats.ts -> routers/index.ts import cycle.
 */
import type { Database } from "@StryveForms/db";
import {
	formStatistic,
	formSubmission,
	formView,
} from "@StryveForms/db/schema/forms";
import { blockForField } from "@StryveForms/forms/blocks";
import type { FormField } from "@StryveForms/forms/types";
import { answerFields, fileList } from "@StryveForms/forms/values";
import { and, avg, count, desc, eq, gte, lte, sql } from "drizzle-orm";

import type { FormRow } from "../lib/serialize";

const MAX_SUMMARY_SUBMISSIONS = 5000;
const TEXT_SAMPLE = 20;

type Bucket = Record<string, number>;

function bump(bucket: Bucket, key: string) {
	bucket[key] = (bucket[key] ?? 0) + 1;
}

function distribution(bucket: Bucket, total: number) {
	return Object.entries(bucket)
		.map(([value, n]) => ({
			count: n,
			percentage: total ? Math.round((n / total) * 1000) / 10 : 0,
			value,
		}))
		.sort((a, b) => b.count - a.count);
}

function numericStats(values: number[]) {
	if (values.length === 0) {
		return { average: null, count: 0, max: null, min: null };
	}
	const sum = values.reduce((a, b) => a + b, 0);
	return {
		average: Math.round((sum / values.length) * 100) / 100,
		count: values.length,
		max: Math.max(...values),
		min: Math.min(...values),
	};
}

type Summarizer = (
	field: FormField,
	answered: unknown[],
	all: unknown[]
) => Record<string, unknown>;

const SUMMARIZERS: Record<string, Summarizer> = {
	boolean: (_field, _answered, all) => {
		const bucket: Bucket = { No: 0, Yes: 0 };
		for (const a of all) {
			bump(bucket, a === true ? "Yes" : "No");
		}
		return { distribution: distribution(bucket, all.length) };
	},
	date_summary: (_field, answered) => {
		const dates = answered
			.map((a) => String(Array.isArray(a) ? a[0] : a))
			.sort();
		return { earliest: dates[0] ?? null, latest: dates.at(-1) ?? null };
	},
	distribution: (_field, answered) => {
		const bucket: Bucket = {};
		for (const a of answered) {
			for (const v of Array.isArray(a) ? a : [a]) {
				bump(bucket, String(v));
			}
		}
		return { distribution: distribution(bucket, answered.length) };
	},
	matrix: (_field, answered) => {
		const rows: Record<string, Bucket> = {};
		for (const a of answered) {
			for (const [row, column] of Object.entries(
				(a ?? {}) as Record<string, unknown>
			)) {
				rows[row] ??= {};
				bump(rows[row], String(column));
			}
		}
		return {
			rows: Object.fromEntries(
				Object.entries(rows).map(([row, bucket]) => [
					row,
					distribution(bucket, answered.length),
				])
			),
		};
	},
	numeric_stats: (_field, answered) => {
		const numbers = answered.map(Number).filter(Number.isFinite);
		const bucket: Bucket = {};
		for (const n of numbers) {
			bump(bucket, String(n));
		}
		return {
			...numericStats(numbers),
			distribution: distribution(bucket, numbers.length),
		};
	},
	text_list: (field, answered) => {
		const isFile = field.type === "files" || field.type === "signature";
		const values = answered
			.slice(0, TEXT_SAMPLE)
			.map((a) => (isFile ? fileList(a).join(", ") : String(a)));
		return { total: answered.length, values };
	},
};

/**
 * One question's summary: a choice distribution, numeric stats
 * (rating/scale/number/slider), a date range, matrix rows, or a sample of
 * recent text answers — whichever fits the field type.
 */
export function summarizeField(field: FormField, answers: unknown[]) {
	const answered = answers.filter(
		(a) =>
			a !== undefined &&
			a !== null &&
			a !== "" &&
			!(Array.isArray(a) && a.length === 0)
	);
	const summaryType = blockForField(field)?.summaryType ?? "text_list";
	const summarize =
		SUMMARIZERS[summaryType === "rating" ? "numeric_stats" : summaryType] ??
		SUMMARIZERS.text_list;
	return {
		answeredCount: answered.length,
		data: summarize ? summarize(field, answered, answers) : {},
		id: field.id,
		name: field.name,
		summaryType,
		type: field.type,
	};
}

export type FieldSummary = ReturnType<typeof summarizeField>;

export interface FormOverview {
	averageCompletionSeconds: number | null;
	completionRate: number;
	partialSubmissions: number;
	submissions: number;
	views: number;
}

/** Views, completion rate, and submission counts — the top numbers on the Summary page. */
export async function buildFormOverview(
	db: Database,
	formId: string
): Promise<FormOverview> {
	const completed = and(
		eq(formSubmission.formId, formId),
		eq(formSubmission.status, "completed")
	);
	const [[views], [archived], [subs], [partial], [time]] = await Promise.all([
		db.select({ n: count() }).from(formView).where(eq(formView.formId, formId)),
		db
			.select({
				n: sql<number>`coalesce(sum((${formStatistic.data}->>'views')::int), 0)::int`,
			})
			.from(formStatistic)
			.where(eq(formStatistic.formId, formId)),
		db.select({ n: count() }).from(formSubmission).where(completed),
		db
			.select({ n: count() })
			.from(formSubmission)
			.where(
				and(
					eq(formSubmission.formId, formId),
					eq(formSubmission.status, "partial")
				)
			),
		db
			.select({ seconds: avg(formSubmission.completionTime) })
			.from(formSubmission)
			.where(completed),
	]);
	const totalViews = (views?.n ?? 0) + (archived?.n ?? 0);
	const submissions = subs?.n ?? 0;
	return {
		averageCompletionSeconds: time?.seconds
			? Math.round(Number(time.seconds))
			: null,
		completionRate: totalViews
			? Math.round((submissions / totalViews) * 1000) / 10
			: 0,
		partialSubmissions: partial?.n ?? 0,
		submissions,
		views: totalViews,
	};
}

export interface FormSummary {
	fields: FieldSummary[];
	isLimited: boolean;
	totalSubmissions: number;
}

/** Per-question summaries over completed submissions, optionally in a date range. */
export async function buildFormSummary(
	db: Database,
	form: FormRow,
	options: { from?: string; to?: string } = {}
): Promise<FormSummary> {
	const filters = [
		eq(formSubmission.formId, form.id),
		eq(formSubmission.status, "completed"),
	];
	if (options.from) {
		filters.push(gte(formSubmission.createdAt, new Date(options.from)));
	}
	if (options.to) {
		filters.push(lte(formSubmission.createdAt, new Date(options.to)));
	}
	const rows = await db
		.select({ data: formSubmission.data })
		.from(formSubmission)
		.where(and(...filters))
		.orderBy(desc(formSubmission.createdAt))
		.limit(MAX_SUMMARY_SUBMISSIONS);
	const fields = answerFields(form.properties as FormField[]);
	return {
		fields: fields.map((field) =>
			summarizeField(
				field,
				rows.map((r) => r.data[field.id])
			)
		),
		isLimited: rows.length === MAX_SUMMARY_SUBMISSIONS,
		totalSubmissions: rows.length,
	};
}
