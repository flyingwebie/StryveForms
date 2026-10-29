import { pdfTemplate } from "@StryveForms/db/schema/features";
import { form } from "@StryveForms/db/schema/forms";
import type { FormField } from "@StryveForms/forms/types";
import { answerFields } from "@StryveForms/forms/values";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { type Capability, requireForm } from "../lib/access";
import { newId } from "../lib/ids";
import {
	autoZonesForFields,
	blankPages,
	PDF_ORIENTATIONS,
	PDF_PAGE_SIZES,
	pdfPageSchema,
	pdfTemplateSettingsSchema,
	pdfZoneSchema,
} from "../services/pdf/model";

type Db = Parameters<typeof requireForm>[0];

async function requireTemplate(
	db: Db,
	id: string,
	userId: string,
	permission: "view" | "edit" = "view",
	capability?: Capability
) {
	const [row] = await db
		.select()
		.from(pdfTemplate)
		.where(eq(pdfTemplate.id, id));
	if (!row) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "PDF template not found",
		});
	}
	const { form: formRow } = await requireForm(
		db,
		row.formId,
		userId,
		permission,
		capability
	);
	return { form: formRow, template: row };
}

const createBlankInput = z.object({
	autoGenerateZones: z.boolean().default(true),
	formId: z.string(),
	name: z.string().min(1).max(100),
	orientation: z.enum(PDF_ORIENTATIONS).default("portrait"),
	pageCount: z.number().int().min(1).max(20).default(1),
	pageSize: z.enum(PDF_PAGE_SIZES).default("A4"),
});

const createFromUploadInput = z.object({
	formId: z.string(),
	name: z.string().min(1).max(100),
	pages: z.array(pdfPageSchema).min(1).max(50),
	sourceFileKey: z.string().min(1).max(500),
});

const updateInput = z.object({
	enabled: z.boolean().optional(),
	filenamePattern: z.string().max(200).optional(),
	id: z.string(),
	name: z.string().min(1).max(100).optional(),
	pages: z.array(pdfPageSchema).max(50).optional(),
	settings: pdfTemplateSettingsSchema.optional(),
	zones: z.array(pdfZoneSchema).max(500).optional(),
});

export const pdfRouter = router({
	/** Every PDF template on a form, newest first. */
	list: protectedProcedure
		.input(z.object({ formId: z.string() }))
		.query(async ({ ctx, input }) => {
			await requireForm(ctx.db, input.formId, ctx.session.user.id);
			return ctx.db
				.select()
				.from(pdfTemplate)
				.where(eq(pdfTemplate.formId, input.formId))
				.orderBy(asc(pdfTemplate.createdAt));
		}),

	get: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const { template } = await requireTemplate(
				ctx.db,
				input.id,
				ctx.session.user.id
			);
			return template;
		}),

	/** "Create from scratch": blank A4/Letter pages, optionally with auto-generated field zones. */
	createBlank: protectedProcedure
		.input(createBlankInput)
		.mutation(async ({ ctx, input }) => {
			const { form: formRow } = await requireForm(
				ctx.db,
				input.formId,
				ctx.session.user.id,
				"edit"
			);
			const fields = input.autoGenerateZones
				? answerFields(
						formRow.properties as FormField[],
						formRow.removedProperties as FormField[]
					)
				: [];
			const generated = input.autoGenerateZones
				? autoZonesForFields(fields)
				: null;
			const zones = generated?.zones ?? [];
			const pageCount = Math.max(input.pageCount, generated?.pageCount ?? 0);
			const pages = blankPages(pageCount, input.pageSize, input.orientation);
			const id = newId();
			const [row] = await ctx.db
				.insert(pdfTemplate)
				.values({
					creatorId: ctx.session.user.id,
					formId: input.formId,
					id,
					name: input.name,
					pages,
					sourceFileKey: null,
					zones,
				})
				.returning();
			return row;
		}),

	/** "Upload a PDF": the file was already stored via the upload HTTP route. */
	createFromUpload: protectedProcedure
		.input(createFromUploadInput)
		.mutation(async ({ ctx, input }) => {
			await requireForm(ctx.db, input.formId, ctx.session.user.id, "edit");
			const id = newId();
			const [row] = await ctx.db
				.insert(pdfTemplate)
				.values({
					creatorId: ctx.session.user.id,
					formId: input.formId,
					id,
					name: input.name,
					pages: input.pages,
					sourceFileKey: input.sourceFileKey,
					zones: [],
				})
				.returning();
			return row;
		}),

	update: protectedProcedure
		.input(updateInput)
		.mutation(async ({ ctx, input }) => {
			const { id, ...rest } = input;
			await requireTemplate(ctx.db, id, ctx.session.user.id, "edit");
			const [row] = await ctx.db
				.update(pdfTemplate)
				.set(rest)
				.where(eq(pdfTemplate.id, id))
				.returning();
			return row;
		}),

	duplicate: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { template } = await requireTemplate(
				ctx.db,
				input.id,
				ctx.session.user.id,
				"edit"
			);
			const id = newId();
			const [row] = await ctx.db
				.insert(pdfTemplate)
				.values({
					creatorId: ctx.session.user.id,
					enabled: template.enabled,
					filenamePattern: template.filenamePattern,
					formId: template.formId,
					id,
					name: `${template.name} copy`,
					pages: template.pages,
					settings: template.settings,
					sourceFileKey: template.sourceFileKey,
					zones: template.zones,
				})
				.returning();
			return row;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await requireTemplate(
				ctx.db,
				input.id,
				ctx.session.user.id,
				"edit",
				"manage_pdf_templates"
			);
			await ctx.db.delete(pdfTemplate).where(eq(pdfTemplate.id, input.id));
			return { ok: true };
		}),

	/**
	 * Owned here (not the form settings router) so this feature stays
	 * self-contained: whether a download button appears on the respondent
	 * success screen, and its label.
	 */
	getFormDownloadSettings: protectedProcedure
		.input(z.object({ formId: z.string() }))
		.query(async ({ ctx, input }) => {
			const { form: formRow } = await requireForm(
				ctx.db,
				input.formId,
				ctx.session.user.id
			);
			return {
				pdfDownloadButtonText: formRow.pdfDownloadButtonText,
				pdfDownloadEnabled: formRow.pdfDownloadEnabled,
			};
		}),

	updateFormDownloadSettings: protectedProcedure
		.input(
			z.object({
				formId: z.string(),
				pdfDownloadButtonText: z.string().max(100).nullable().optional(),
				pdfDownloadEnabled: z.boolean(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			await requireForm(ctx.db, input.formId, ctx.session.user.id, "edit");
			await ctx.db
				.update(form)
				.set({
					pdfDownloadButtonText: input.pdfDownloadButtonText ?? null,
					pdfDownloadEnabled: input.pdfDownloadEnabled,
				})
				.where(eq(form.id, input.formId));
			return { ok: true };
		}),
});
