import { template } from "@StryveForms/db/schema/forms";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";
import { requireForm, requireWorkspace } from "../lib/access";
import { newId, slugify } from "../lib/ids";
import { toFormDto } from "../lib/serialize";
import {
	BUILTIN_CATEGORIES,
	getTemplate,
	structureFromForm,
	TEMPLATES,
} from "../services/templates";

const templateDetailsSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(2000).nullable().optional(),
	category: z.string().max(50).nullable().optional(),
	color: z.string().max(20).nullable().optional(),
	icon: z.string().max(10).nullable().optional(),
	folderId: z.string().nullable().optional(),
});

async function uniqueTemplateSlug(
	db: Parameters<typeof requireWorkspace>[0],
	name: string
) {
	const base = slugify(name) || "template";
	const candidates = [
		base,
		...Array.from(
			{ length: 4 },
			() => `${base}-${newId().toLowerCase().slice(0, 6)}`
		),
	];
	const taken = await db
		.select({ slug: template.slug })
		.from(template)
		.where(inArray(template.slug, candidates));
	const used = new Set(taken.map((t) => t.slug));
	return (
		candidates.find((slug) => !used.has(slug)) ??
		`${base}-${newId().toLowerCase()}`
	);
}

export const templateRouter = router({
	/** Built-in starter templates, bundled with the app. */
	list: publicProcedure.query(() =>
		TEMPLATES.map(({ structure, ...meta }) => ({
			...meta,
			fieldsCount: structure.properties?.length ?? 0,
			/** For the gallery card's mini field-skeleton preview. */
			properties: structure.properties ?? [],
		}))
	),
	categories: publicProcedure.query(() => BUILTIN_CATEGORIES),
	get: publicProcedure
		.input(z.object({ slug: z.string() }))
		.query(({ input }) => getTemplate(input.slug)),

	/** A workspace's own saved templates (not the built-ins). */
	listMine: protectedProcedure
		.input(z.object({ workspaceId: z.string() }))
		.query(async ({ ctx, input }) => {
			await requireWorkspace(ctx.db, input.workspaceId, ctx.session.user.id);
			const rows = await ctx.db
				.select()
				.from(template)
				.where(eq(template.workspaceId, input.workspaceId))
				.orderBy(desc(template.updatedAt));
			return rows.map((row) => {
				const structure = row.structure as { properties?: unknown[] };
				return {
					...row,
					fieldsCount: structure.properties?.length ?? 0,
					properties: structure.properties ?? [],
				};
			});
		}),

	getMine: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const [row] = await ctx.db
				.select()
				.from(template)
				.where(eq(template.id, input.id));
			if (!row?.workspaceId) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Template not found",
				});
			}
			await requireWorkspace(ctx.db, row.workspaceId, ctx.session.user.id);
			return row;
		}),

	/** "Save as template": snapshots a form's current settings into a new workspace template. */
	createFromForm: protectedProcedure
		.input(
			z.object({
				formId: z.string(),
				name: z.string().min(1).max(100),
				description: z.string().max(2000).optional(),
				category: z.string().max(50).optional(),
				color: z.string().max(20).optional(),
				icon: z.string().max(10).optional(),
				folderId: z.string().nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { form: row } = await requireForm(
				ctx.db,
				input.formId,
				ctx.session.user.id,
				"edit"
			);
			const structure = structureFromForm(toFormDto(row, ctx.services.config));
			const id = newId();
			const slug = await uniqueTemplateSlug(ctx.db, input.name);
			await ctx.db.insert(template).values({
				id,
				workspaceId: row.workspaceId,
				folderId: input.folderId ?? null,
				category: input.category ?? null,
				color: input.color ?? null,
				icon: input.icon ?? null,
				slug,
				name: input.name,
				shortDescription: input.description ?? null,
				description: input.description ?? null,
				structure: structure as Record<string, unknown>,
				creatorId: ctx.session.user.id,
			});
			return { id, slug };
		}),

	/** "New template" from blank: an empty starting point for a workspace template. */
	createBlank: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				name: z.string().min(1).max(100),
				description: z.string().max(2000).optional(),
				category: z.string().max(50).optional(),
				color: z.string().max(20).optional(),
				icon: z.string().max(10).optional(),
				folderId: z.string().nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			await requireWorkspace(
				ctx.db,
				input.workspaceId,
				ctx.session.user.id,
				"edit"
			);
			const id = newId();
			const slug = await uniqueTemplateSlug(ctx.db, input.name);
			await ctx.db.insert(template).values({
				id,
				workspaceId: input.workspaceId,
				folderId: input.folderId ?? null,
				category: input.category ?? null,
				color: input.color ?? null,
				icon: input.icon ?? null,
				slug,
				name: input.name,
				shortDescription: input.description ?? null,
				description: input.description ?? null,
				structure: { title: input.name, properties: [] },
				creatorId: ctx.session.user.id,
			});
			return { id, slug };
		}),

	/** Edits a workspace template's details (name, description, category, colour, icon, folder). */
	update: protectedProcedure
		.input(templateDetailsSchema.extend({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { id, ...rest } = input;
			const [row] = await ctx.db
				.select()
				.from(template)
				.where(eq(template.id, id));
			if (!row?.workspaceId) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Template not found",
				});
			}
			await requireWorkspace(
				ctx.db,
				row.workspaceId,
				ctx.session.user.id,
				"edit"
			);
			await ctx.db.update(template).set(rest).where(eq(template.id, id));
			return { ok: true };
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const [row] = await ctx.db
				.select()
				.from(template)
				.where(eq(template.id, input.id));
			if (!row?.workspaceId) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Template not found",
				});
			}
			await requireWorkspace(
				ctx.db,
				row.workspaceId,
				ctx.session.user.id,
				"edit"
			);
			await ctx.db.delete(template).where(eq(template.id, input.id));
			return { ok: true };
		}),

	/** Moves one of the workspace's own templates into a folder (or out, with `null`). */
	moveToFolder: protectedProcedure
		.input(z.object({ id: z.string(), folderId: z.string().nullable() }))
		.mutation(async ({ ctx, input }) => {
			const [row] = await ctx.db
				.select()
				.from(template)
				.where(eq(template.id, input.id));
			if (!row?.workspaceId) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Template not found",
				});
			}
			await requireWorkspace(
				ctx.db,
				row.workspaceId,
				ctx.session.user.id,
				"edit"
			);
			await ctx.db
				.update(template)
				.set({ folderId: input.folderId })
				.where(
					and(
						eq(template.id, input.id),
						eq(template.workspaceId, row.workspaceId)
					)
				);
			return { ok: true };
		}),
});
