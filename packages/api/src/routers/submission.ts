import {
	formIntegration,
	formIntegrationEvent,
	formSubmission,
} from "@StryveForms/db/schema/forms";
import type { FormField } from "@StryveForms/forms/types";
import { normalizeSelectValues } from "@StryveForms/forms/validation";
import { fileList, isFileField } from "@StryveForms/forms/values";
import { TRPCError } from "@trpc/server";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import type { AppConfig } from "../context";
import { protectedProcedure, router } from "../index";
import { requireForm } from "../lib/access";
import { submissionFileUrl } from "../lib/files";
import type { FormRow } from "../lib/serialize";
import {
	submissionFilters as buildSubmissionFilters,
	submissionOrderBy,
} from "../lib/submission-filters";
import { INTEGRATION_CATALOG } from "../services/integrations/handlers";
import { sanitizeRichText } from "../services/sanitize";

/** Kept here (not just in lib/) so existing consumers (e.g. the AI tools) keep working. */
export const submissionFilters = buildSubmissionFilters;

type SubmissionRow = typeof formSubmission.$inferSelect;

/** Owner view of a submission, with signed links for uploaded files. */
export function toSubmissionDto(
	row: FormRow,
	submission: SubmissionRow,
	config: AppConfig
) {
	const data = { ...submission.data };
	const fields = [
		...(row.properties as FormField[]),
		...(row.removedProperties as FormField[]),
	];
	for (const field of fields) {
		if (isFileField(field) && data[field.id]) {
			data[field.id] = fileList(data[field.id]).map((name) => ({
				file_name: name,
				file_url: submissionFileUrl(config, row.id, name),
			}));
		}
	}
	return {
		completionTime: submission.completionTime,
		createdAt: submission.createdAt.toISOString(),
		data,
		id: submission.id,
		meta: submission.meta,
		publicId: submission.publicId,
		status: submission.status,
		updatedAt: submission.updatedAt.toISOString(),
	};
}

export type SubmissionDto = ReturnType<typeof toSubmissionDto>;

const listInput = z.object({
	formId: z.string(),
	page: z.number().int().min(1).default(1),
	perPage: z.number().int().min(1).max(200).default(50),
	status: z.enum(["all", "completed", "partial"]).default("all"),
	search: z.string().max(200).optional(),
	/** "createdAt" | "status" | "completionTime", or any answer field id. */
	sortBy: z.string().max(255).default("createdAt"),
	sortDir: z.enum(["asc", "desc"]).default("desc"),
	from: z.string().datetime().optional(),
	to: z.string().datetime().optional(),
});

export const submissionRouter = router({
	/** Server-side paged, filtered and sorted — sorting (incl. answer columns) covers every page, not just the one shown. */
	list: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
		const { form } = await requireForm(
			ctx.db,
			input.formId,
			ctx.session.user.id
		);
		const where = submissionFilters(input);
		const [rows, [total]] = await Promise.all([
			ctx.db
				.select()
				.from(formSubmission)
				.where(where)
				.orderBy(submissionOrderBy(input.sortBy, input.sortDir))
				.limit(input.perPage)
				.offset((input.page - 1) * input.perPage),
			ctx.db.select({ n: count() }).from(formSubmission).where(where),
		]);
		return {
			items: rows.map((r) => toSubmissionDto(form, r, ctx.services.config)),
			page: input.page,
			perPage: input.perPage,
			total: total?.n ?? 0,
		};
	}),

	get: protectedProcedure
		.input(z.object({ formId: z.string(), id: z.string() }))
		.query(async ({ ctx, input }) => {
			const { form } = await requireForm(
				ctx.db,
				input.formId,
				ctx.session.user.id
			);
			const [row] = await ctx.db
				.select()
				.from(formSubmission)
				.where(
					and(
						eq(formSubmission.formId, input.formId),
						eq(formSubmission.id, input.id)
					)
				);
			if (!row) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Submission not found",
				});
			}
			return toSubmissionDto(form, row, ctx.services.config);
		}),

	/**
	 * A timeline for one submission: when it was created/last edited, plus
	 * every integration delivery (including email notifications, which run
	 * through the same "email" integration) recorded against it. Loaded
	 * separately from the submission itself so opening the detail view
	 * doesn't wait on it.
	 */
	activity: protectedProcedure
		.input(z.object({ formId: z.string(), id: z.string() }))
		.query(async ({ ctx, input }) => {
			await requireForm(ctx.db, input.formId, ctx.session.user.id);
			const [row] = await ctx.db
				.select()
				.from(formSubmission)
				.where(
					and(
						eq(formSubmission.formId, input.formId),
						eq(formSubmission.id, input.id)
					)
				);
			if (!row) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Submission not found",
				});
			}
			const events = await ctx.db
				.select({
					createdAt: formIntegrationEvent.createdAt,
					data: formIntegrationEvent.data,
					id: formIntegrationEvent.id,
					integrationId: formIntegration.integrationId,
					type: formIntegrationEvent.type,
				})
				.from(formIntegrationEvent)
				.innerJoin(
					formIntegration,
					eq(formIntegrationEvent.integrationId, formIntegration.id)
				)
				.where(
					and(
						eq(formIntegration.formId, input.formId),
						sql`${formIntegrationEvent.data} ->> 'submissionId' = ${row.publicId}`
					)
				)
				.orderBy(asc(formIntegrationEvent.createdAt));
			return {
				createdAt: row.createdAt.toISOString(),
				events: events.map((event) => ({
					createdAt: event.createdAt.toISOString(),
					id: event.id,
					integrationName:
						INTEGRATION_CATALOG.find((i) => i.id === event.integrationId)
							?.name ?? event.integrationId,
					message:
						typeof (event.data as Record<string, unknown> | null)?.message ===
						"string"
							? ((event.data as Record<string, unknown>).message as string)
							: null,
					type: event.type,
				})),
				updatedAt: row.updatedAt.toISOString(),
			};
		}),

	/** Lets the form owner correct answers. */
	update: protectedProcedure
		.input(
			z.object({
				formId: z.string(),
				id: z.string(),
				data: z.record(z.string(), z.unknown()),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { form } = await requireForm(
				ctx.db,
				input.formId,
				ctx.session.user.id,
				"edit"
			);
			const fields = form.properties as FormField[];
			const data = normalizeSelectValues(fields, input.data);
			for (const field of fields) {
				if (field.type === "rich_text" && typeof data[field.id] === "string") {
					data[field.id] = sanitizeRichText(data[field.id] as string);
				}
				// File values come back as {file_name, file_url}; store names only.
				if (isFileField(field) && data[field.id] !== undefined) {
					data[field.id] = fileList(data[field.id]);
				}
			}
			const [row] = await ctx.db
				.update(formSubmission)
				.set({
					data: sql`${formSubmission.data} || ${JSON.stringify(data)}::jsonb`,
				})
				.where(
					and(
						eq(formSubmission.formId, input.formId),
						eq(formSubmission.id, input.id)
					)
				)
				.returning();
			if (!row) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Submission not found",
				});
			}
			return toSubmissionDto(form, row, ctx.services.config);
		}),

	delete: protectedProcedure
		.input(
			z.object({
				formId: z.string(),
				ids: z.array(z.string()).min(1).max(1000),
			})
		)
		.mutation(async ({ ctx, input }) => {
			await requireForm(
				ctx.db,
				input.formId,
				ctx.session.user.id,
				"edit",
				"manage_submissions"
			);
			const deleted = await ctx.db
				.delete(formSubmission)
				.where(
					and(
						eq(formSubmission.formId, input.formId),
						inArray(formSubmission.id, input.ids)
					)
				)
				.returning({ id: formSubmission.id });
			return { deleted: deleted.length };
		}),
});
