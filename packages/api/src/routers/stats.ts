import {
	formStatistic,
	formSubmission,
	formView,
} from "@StryveForms/db/schema/forms";
import { type AnyColumn, and, count, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { requireForm } from "../lib/access";
import { buildFormOverview, buildFormSummary } from "../services/stats";

const DAY_MS = 86_400_000;

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

export const statsRouter = router({
	overview: protectedProcedure
		.input(z.object({ formId: z.string() }))
		.query(async ({ ctx, input }) => {
			await requireForm(ctx.db, input.formId, ctx.session.user.id);
			return buildFormOverview(ctx.db, input.formId);
		}),

	timeline: protectedProcedure
		.input(
			z.object({
				formId: z.string(),
				days: z.number().int().min(1).max(365).default(30),
			})
		)
		.query(async ({ ctx, input }) => {
			await requireForm(ctx.db, input.formId, ctx.session.user.id);
			const since = new Date(Date.now() - (input.days - 1) * DAY_MS);
			since.setHours(0, 0, 0, 0);
			const day = (column: AnyColumn) =>
				sql<string>`to_char(${column}, 'YYYY-MM-DD')`;
			const [views, archived, submissions] = await Promise.all([
				ctx.db
					.select({ date: day(formView.createdAt), n: count() })
					.from(formView)
					.where(
						and(
							eq(formView.formId, input.formId),
							gte(formView.createdAt, since)
						)
					)
					.groupBy(day(formView.createdAt)),
				ctx.db
					.select({
						date: formStatistic.date,
						n: sql<number>`(${formStatistic.data}->>'views')::int`,
					})
					.from(formStatistic)
					.where(
						and(
							eq(formStatistic.formId, input.formId),
							gte(formStatistic.date, since.toISOString().slice(0, 10))
						)
					),
				ctx.db
					.select({
						date: day(formSubmission.createdAt),
						n: count(),
						status: formSubmission.status,
					})
					.from(formSubmission)
					.where(
						and(
							eq(formSubmission.formId, input.formId),
							gte(formSubmission.createdAt, since)
						)
					)
					.groupBy(day(formSubmission.createdAt), formSubmission.status),
			]);
			const points = Array.from({ length: input.days }, (_, i) => {
				const date = new Date(since.getTime() + i * DAY_MS)
					.toISOString()
					.slice(0, 10);
				return { date, partial: 0, submissions: 0, views: 0 };
			});
			const byDate = new Map(points.map((p) => [p.date, p]));
			for (const v of [...views, ...archived]) {
				const point = byDate.get(v.date);
				if (point) {
					point.views += Number(v.n);
				}
			}
			for (const s of submissions) {
				const point = byDate.get(s.date);
				if (point) {
					point[s.status === "completed" ? "submissions" : "partial"] += Number(
						s.n
					);
				}
			}
			return points;
		}),

	traffic: protectedProcedure
		.input(z.object({ formId: z.string() }))
		.query(async ({ ctx, input }) => {
			await requireForm(ctx.db, input.formId, ctx.session.user.id);
			const rows = await ctx.db
				.select({ meta: formView.meta })
				.from(formView)
				.where(eq(formView.formId, input.formId))
				.orderBy(desc(formView.createdAt))
				.limit(10_000);
			const sources: Bucket = {};
			const countries: Bucket = {};
			for (const { meta } of rows) {
				bump(sources, String(meta?.source ?? "Unknown"));
				bump(countries, String(meta?.country ?? "Unknown"));
			}
			return {
				countries: distribution(countries, rows.length),
				sources: distribution(sources, rows.length),
			};
		}),

	summary: protectedProcedure
		.input(
			z.object({
				formId: z.string(),
				from: z.string().datetime().optional(),
				to: z.string().datetime().optional(),
			})
		)
		.query(async ({ ctx, input }) => {
			const { form } = await requireForm(
				ctx.db,
				input.formId,
				ctx.session.user.id
			);
			return buildFormSummary(ctx.db, form, { from: input.from, to: input.to });
		}),
});
