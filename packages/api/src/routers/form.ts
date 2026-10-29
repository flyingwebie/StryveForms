import type { Database } from "@StryveForms/db";
import {
	folder,
	form,
	formSubmission,
	formVersion,
	template as templateTable,
} from "@StryveForms/db/schema/forms";
import {
	defaultFormSettings,
	formUpdateSchema,
	VISIBILITIES,
} from "@StryveForms/forms/settings";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { type Capability, requireForm, requireWorkspace } from "../lib/access";
import { folderSubtreeIds } from "../lib/folders";
import { formSlug, newId, slugify } from "../lib/ids";
import { type FormRow, toFormColumns, toFormDto } from "../lib/serialize";
import { getTemplate } from "../services/templates";

const BULK_MAX_IDS = 200;
const idsSchema = z.array(z.string()).min(1).max(BULK_MAX_IDS);

/** A plain db handle or one yielded inside `db.transaction(async (tx) => …)`. */
type Db = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Loads every (non-deleted) form in `ids` and checks the caller may edit each
 * one's workspace. Throws if any id is missing or not permitted.
 */
async function requireFormsEditable(
	db: Parameters<typeof requireForm>[0],
	ids: string[],
	userId: string,
	capability: Capability = "edit_forms"
): Promise<FormRow[]> {
	const rows = await db
		.select()
		.from(form)
		.where(and(inArray(form.id, ids), isNull(form.deletedAt)));
	if (rows.length !== ids.length) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Some forms were not found",
		});
	}
	const workspaceIds = new Set(rows.map((r) => r.workspaceId));
	await Promise.all(
		[...workspaceIds].map((workspaceId) =>
			requireWorkspace(db, workspaceId, userId, "edit", capability)
		)
	);
	return rows;
}

const MAX_VERSIONS = 20;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Keeps a snapshot of the form before it changes, so edits can be undone. */
async function snapshotForm(
	db: Parameters<typeof requireForm>[0],
	row: FormRow,
	userId: string
) {
	const {
		id,
		workspaceId: _w,
		creatorId: _c,
		createdAt: _ca,
		passwordHash: _p,
		...snapshot
	} = row;
	await db.insert(formVersion).values({
		id: newId(),
		formId: id,
		userId,
		snapshot: snapshot as unknown as Record<string, unknown>,
	});
	const old = await db
		.select({ id: formVersion.id })
		.from(formVersion)
		.where(eq(formVersion.formId, id))
		.orderBy(desc(formVersion.createdAt))
		.offset(MAX_VERSIONS);
	if (old.length > 0) {
		await db.delete(formVersion).where(
			inArray(
				formVersion.id,
				old.map((v) => v.id)
			)
		);
	}
}

async function uniqueSlug(db: Db, title: string) {
	const candidates = Array.from({ length: 5 }, () => formSlug(title));
	const taken = await db
		.select({ slug: form.slug })
		.from(form)
		.where(inArray(form.slug, candidates));
	const used = new Set(taken.map((t) => t.slug));
	return (
		candidates.find((slug) => !used.has(slug)) ??
		`${slugify(title) || "form"}-${newId().toLowerCase()}`
	);
}

/**
 * Of the fields just removed from a form, the ones that already have answers
 * in some submission. Only those are kept in `removedProperties` (so their
 * answers stay visible); a field that never collected anything, e.g. one
 * renamed or deleted right after being added, leaves no empty column behind.
 */
async function withAnswers<T extends { id: string }>(
	db: Database,
	formId: string,
	fields: T[]
): Promise<T[]> {
	if (fields.length === 0) {
		return [];
	}
	const rows = await db
		.select({ id: sql<string>`k.key` })
		.from(formSubmission)
		.innerJoin(
			sql`jsonb_object_keys(${formSubmission.data}) as k(key)`,
			sql`true`
		)
		.where(
			and(
				eq(formSubmission.formId, formId),
				inArray(
					sql`k.key`,
					fields.map((f) => f.id)
				)
			)
		)
		.groupBy(sql`k.key`);
	const answered = new Set(rows.map((r) => r.id));
	return fields.filter((f) => answered.has(f.id));
}

export const formRouter = router({
	list: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				search: z.string().max(200).optional(),
				tags: z.array(z.string()).optional(),
				/** Filter to one folder; `"none"` = forms with no folder. Omit for all. */
				folderId: z.string().optional(),
			})
		)
		.query(async ({ ctx, input }) => {
			await requireWorkspace(ctx.db, input.workspaceId, ctx.session.user.id);
			const filters = [
				eq(form.workspaceId, input.workspaceId),
				isNull(form.deletedAt),
			];
			if (input.search) {
				filters.push(ilike(form.title, `%${input.search}%`));
			}
			if (input.tags && input.tags.length > 0) {
				filters.push(sql`${form.tags} ?| ${input.tags}`);
			}
			if (input.folderId === "none") {
				filters.push(isNull(form.folderId));
			} else if (input.folderId) {
				// A parent folder's view includes its subfolders' forms too.
				const ids = await folderSubtreeIds(
					ctx.db,
					input.workspaceId,
					"form",
					input.folderId
				);
				filters.push(inArray(form.folderId, ids));
			}
			const rows = await ctx.db
				.select({
					id: form.id,
					title: form.title,
					slug: form.slug,
					visibility: form.visibility,
					tags: form.tags,
					closesAt: form.closesAt,
					color: form.color,
					folderId: form.folderId,
					/** For the card's mini field-skeleton preview. */
					properties: form.properties,
					coverPicture: form.coverPicture,
					logoPicture: form.logoPicture,
					updatedAt: form.updatedAt,
					createdAt: form.createdAt,
					submissionsCount: sql<number>`(select count(*)::int from form_submission s where s.form_id = "form"."id" and s.status = 'completed')`,
					viewsCount: sql<number>`((select count(*) from form_view v where v.form_id = "form"."id") + coalesce((select sum((st.data->>'views')::int) from form_statistic st where st.form_id = "form"."id"), 0))::int`,
				})
				.from(form)
				.where(and(...filters))
				.orderBy(desc(form.updatedAt));
			return rows.map((r) => ({
				...r,
				isClosed:
					r.visibility === "closed" ||
					(r.closesAt !== null && r.closesAt < new Date()),
			}));
		}),

	tags: protectedProcedure
		.input(z.object({ workspaceId: z.string() }))
		.query(async ({ ctx, input }) => {
			await requireWorkspace(ctx.db, input.workspaceId, ctx.session.user.id);
			const rows = await ctx.db
				.select({
					tag: sql<string>`distinct jsonb_array_elements_text(${form.tags})`,
				})
				.from(form)
				.where(
					and(eq(form.workspaceId, input.workspaceId), isNull(form.deletedAt))
				);
			return rows.map((r) => r.tag).sort();
		}),

	get: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const { form: row, membership } = await requireForm(
				ctx.db,
				input.id,
				ctx.session.user.id
			);
			// Lets the editor decide whether a field id is safe to freely rename
			// (no submission has stored data under it yet).
			const submissionCountRows = await ctx.db
				.select({ submissionsCount: count() })
				.from(formSubmission)
				.where(
					and(
						eq(formSubmission.formId, row.id),
						eq(formSubmission.status, "completed")
					)
				);
			return {
				...toFormDto(row, ctx.services.config),
				role: membership.role,
				submissionsCount: submissionCountRows[0]?.submissionsCount ?? 0,
			};
		}),

	/** Finds a form by slug (used by editor URLs). */
	bySlug: protectedProcedure
		.input(z.object({ slug: z.string() }))
		.query(async ({ ctx, input }) => {
			const [row] = await ctx.db
				.select({ id: form.id })
				.from(form)
				.where(and(eq(form.slug, input.slug), isNull(form.deletedAt)));
			if (!row) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Form not found" });
			}
			const { form: full, membership } = await requireForm(
				ctx.db,
				row.id,
				ctx.session.user.id
			);
			return { ...toFormDto(full, ctx.services.config), role: membership.role };
		}),

	create: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				templateSlug: z.string().optional(),
				/** A workspace's own saved template (see the `template` router). */
				templateId: z.string().optional(),
				folderId: z.string().nullable().optional(),
				data: formUpdateSchema.optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			await requireWorkspace(
				ctx.db,
				input.workspaceId,
				ctx.session.user.id,
				"edit",
				"edit_forms"
			);
			let structure: Record<string, unknown> | null = null;
			if (input.templateSlug) {
				structure = getTemplate(input.templateSlug)?.structure ?? null;
			} else if (input.templateId) {
				const [custom] = await ctx.db
					.select()
					.from(templateTable)
					.where(eq(templateTable.id, input.templateId));
				if (
					custom &&
					(custom.workspaceId === null ||
						custom.workspaceId === input.workspaceId)
				) {
					({ structure } = custom);
				}
			}
			const settings = {
				...defaultFormSettings(),
				...structure,
				...input.data,
			};
			if (input.folderId) {
				const [folderRow] = await ctx.db
					.select()
					.from(folder)
					.where(eq(folder.id, input.folderId));
				if (!(folderRow && folderRow.workspaceId === input.workspaceId)) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Folder does not belong to this workspace",
					});
				}
			}
			const id = newId();
			const slug = await uniqueSlug(ctx.db, settings.title);
			await ctx.db.insert(form).values({
				...toFormColumns(settings),
				id,
				slug,
				title: settings.title,
				workspaceId: input.workspaceId,
				folderId: input.folderId ?? null,
				creatorId: ctx.session.user.id,
			});
			return { id, slug };
		}),

	update: protectedProcedure
		.input(z.object({ id: z.string(), data: formUpdateSchema }))
		.mutation(async ({ ctx, input }) => {
			const { form: row } = await requireForm(
				ctx.db,
				input.id,
				ctx.session.user.id,
				"edit",
				"edit_forms"
			);
			const visibilityChanges =
				input.data.visibility !== undefined &&
				input.data.visibility !== row.visibility;
			if (visibilityChanges) {
				await requireWorkspace(
					ctx.db,
					row.workspaceId,
					ctx.session.user.id,
					"edit",
					"publish_forms"
				);
			}
			await snapshotForm(ctx.db, row, ctx.session.user.id);

			const columns = toFormColumns(input.data);
			// Fields removed from the form keep their answers visible in submissions.
			if (input.data.properties) {
				const keptIds = new Set(input.data.properties.map((p) => p.id));
				const previous = row.properties as { id: string }[];
				const removedNow = previous.filter((p) => !keptIds.has(p.id));
				const removedBefore = (
					row.removedProperties as { id: string }[]
				).filter(
					(p) => !(keptIds.has(p.id) || removedNow.some((r) => r.id === p.id))
				);
				columns.removedProperties = await withAnswers(ctx.db, input.id, [
					...removedBefore,
					...removedNow,
				]);
			}
			const [updated] = await ctx.db
				.update(form)
				.set(columns)
				.where(eq(form.id, input.id))
				.returning();
			if (!updated) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Form not found" });
			}
			return toFormDto(updated, ctx.services.config);
		}),

	setPassword: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				password: z.string().min(1).max(200).nullable(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			await requireForm(
				ctx.db,
				input.id,
				ctx.session.user.id,
				"edit",
				"edit_forms"
			);
			const passwordHash = input.password
				? await Bun.password.hash(input.password)
				: null;
			await ctx.db
				.update(form)
				.set({ passwordHash })
				.where(eq(form.id, input.id));
			return { hasPassword: passwordHash !== null };
		}),

	setSlug: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				slug: z.string().min(3).max(80).regex(SLUG_PATTERN).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { form: row } = await requireForm(
				ctx.db,
				input.id,
				ctx.session.user.id,
				"edit",
				"edit_forms"
			);
			const slug = input.slug ?? (await uniqueSlug(ctx.db, row.title));
			const [taken] = await ctx.db
				.select({ id: form.id })
				.from(form)
				.where(eq(form.slug, slug));
			if (taken && taken.id !== row.id) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "That link is already in use",
				});
			}
			await ctx.db.update(form).set({ slug }).where(eq(form.id, row.id));
			return { slug };
		}),

	duplicate: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { form: row } = await requireForm(
				ctx.db,
				input.id,
				ctx.session.user.id,
				"edit",
				"edit_forms"
			);
			const id = newId();
			const title = `Copy of ${row.title}`;
			const slug = await uniqueSlug(ctx.db, title);
			const {
				createdAt: _c,
				updatedAt: _u,
				legacyOpnformId: _l,
				legacySlug: _ls,
				...rest
			} = row;
			await ctx.db.insert(form).values({
				...rest,
				id,
				slug,
				title,
				creatorId: ctx.session.user.id,
				removedProperties: [],
				autoIncrementSequence: 0,
			});
			return { id, slug };
		}),

	move: protectedProcedure
		.input(z.object({ id: z.string(), workspaceId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await requireForm(
				ctx.db,
				input.id,
				ctx.session.user.id,
				"edit",
				"edit_forms"
			);
			await requireWorkspace(
				ctx.db,
				input.workspaceId,
				ctx.session.user.id,
				"edit",
				"edit_forms"
			);
			await ctx.db
				.update(form)
				.set({ workspaceId: input.workspaceId })
				.where(eq(form.id, input.id));
			return { ok: true };
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await requireForm(
				ctx.db,
				input.id,
				ctx.session.user.id,
				"edit",
				"delete_forms"
			);
			await ctx.db
				.update(form)
				.set({ deletedAt: new Date() })
				.where(eq(form.id, input.id));
			return { ok: true };
		}),

	versions: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			await requireForm(ctx.db, input.id, ctx.session.user.id);
			const rows = await ctx.db
				.select({
					id: formVersion.id,
					createdAt: formVersion.createdAt,
					userId: formVersion.userId,
					title: sql<string>`${formVersion.snapshot}->>'title'`,
					fieldsCount: sql<number>`jsonb_array_length(coalesce(${formVersion.snapshot}->'properties', '[]'::jsonb))`,
				})
				.from(formVersion)
				.where(eq(formVersion.formId, input.id))
				.orderBy(desc(formVersion.createdAt));
			return rows;
		}),

	restoreVersion: protectedProcedure
		.input(z.object({ id: z.string(), versionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { form: row } = await requireForm(
				ctx.db,
				input.id,
				ctx.session.user.id,
				"edit",
				"edit_forms"
			);
			const [version] = await ctx.db
				.select()
				.from(formVersion)
				.where(
					and(
						eq(formVersion.id, input.versionId),
						eq(formVersion.formId, input.id)
					)
				);
			if (!version) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Version not found",
				});
			}
			await snapshotForm(ctx.db, row, ctx.session.user.id);
			const snapshot = version.snapshot as Partial<FormRow>;
			const {
				slug: _s,
				updatedAt: _u,
				deletedAt: _d,
				...restorable
			} = snapshot;
			await ctx.db
				.update(form)
				.set({
					...restorable,
					closesAt: restorable.closesAt ? new Date(restorable.closesAt) : null,
				})
				.where(eq(form.id, input.id));
			return { ok: true };
		}),

	counts: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			await requireForm(ctx.db, input.id, ctx.session.user.id);
			const [[completed], [partial]] = await Promise.all([
				ctx.db
					.select({ n: count() })
					.from(formSubmission)
					.where(
						and(
							eq(formSubmission.formId, input.id),
							eq(formSubmission.status, "completed")
						)
					),
				ctx.db
					.select({ n: count() })
					.from(formSubmission)
					.where(
						and(
							eq(formSubmission.formId, input.id),
							eq(formSubmission.status, "partial")
						)
					),
			]);
			return { completed: completed?.n ?? 0, partial: partial?.n ?? 0 };
		}),

	/* ---------------------------------------------------------------------- */
	/*                              Bulk operations                           */
	/* ---------------------------------------------------------------------- */

	/** Moves a batch of forms into a folder (or clears it with `folderId: null`). */
	moveToFolder: protectedProcedure
		.input(z.object({ ids: idsSchema, folderId: z.string().nullable() }))
		.mutation(async ({ ctx, input }) => {
			const rows = await requireFormsEditable(
				ctx.db,
				input.ids,
				ctx.session.user.id
			);
			if (input.folderId) {
				const [folderRow] = await ctx.db
					.select()
					.from(folder)
					.where(eq(folder.id, input.folderId));
				const workspaceIds = new Set(rows.map((r) => r.workspaceId));
				if (
					!(
						folderRow &&
						workspaceIds.size === 1 &&
						workspaceIds.has(folderRow.workspaceId)
					)
				) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Folder does not belong to these forms' workspace",
					});
				}
			}
			await ctx.db.transaction(async (tx) => {
				await tx
					.update(form)
					.set({ folderId: input.folderId })
					.where(inArray(form.id, input.ids));
			});
			return { ok: true, count: input.ids.length };
		}),

	/** Bulk sets visibility (publish / draft / closed) for a batch of forms. */
	setStatus: protectedProcedure
		.input(z.object({ ids: idsSchema, visibility: z.enum(VISIBILITIES) }))
		.mutation(async ({ ctx, input }) => {
			await requireFormsEditable(
				ctx.db,
				input.ids,
				ctx.session.user.id,
				"publish_forms"
			);
			await ctx.db.transaction(async (tx) => {
				await tx
					.update(form)
					.set({ visibility: input.visibility })
					.where(inArray(form.id, input.ids));
			});
			return { ok: true, count: input.ids.length };
		}),

	/** Duplicates a batch of forms in one go. */
	bulkDuplicate: protectedProcedure
		.input(z.object({ ids: idsSchema }))
		.mutation(async ({ ctx, input }) => {
			const rows = await requireFormsEditable(
				ctx.db,
				input.ids,
				ctx.session.user.id
			);
			const created = await ctx.db.transaction(async (tx) => {
				const results: { id: string; slug: string }[] = [];
				for (const row of rows) {
					const id = newId();
					const title = `Copy of ${row.title}`;
					// biome-ignore lint/performance/noAwaitInLoops: each slug must see the previous one to stay unique within this batch
					const slug = await uniqueSlug(tx, title);
					const {
						createdAt: _c,
						updatedAt: _u,
						legacyOpnformId: _l,
						legacySlug: _ls,
						...rest
					} = row;
					await tx.insert(form).values({
						...rest,
						id,
						slug,
						title,
						creatorId: ctx.session.user.id,
						removedProperties: [],
						autoIncrementSequence: 0,
					});
					results.push({ id, slug });
				}
				return results;
			});
			return { ok: true, created };
		}),

	/** Soft-deletes a batch of forms. */
	bulkDelete: protectedProcedure
		.input(z.object({ ids: idsSchema }))
		.mutation(async ({ ctx, input }) => {
			await requireFormsEditable(
				ctx.db,
				input.ids,
				ctx.session.user.id,
				"delete_forms"
			);
			await ctx.db.transaction(async (tx) => {
				await tx
					.update(form)
					.set({ deletedAt: new Date() })
					.where(inArray(form.id, input.ids));
			});
			return { ok: true, count: input.ids.length };
		}),

	/** Moves a batch of forms to another workspace the caller may edit. */
	bulkMoveToWorkspace: protectedProcedure
		.input(z.object({ ids: idsSchema, workspaceId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await requireFormsEditable(ctx.db, input.ids, ctx.session.user.id);
			await requireWorkspace(
				ctx.db,
				input.workspaceId,
				ctx.session.user.id,
				"edit",
				"edit_forms"
			);
			await ctx.db.transaction(async (tx) => {
				await tx
					.update(form)
					.set({ workspaceId: input.workspaceId, folderId: null })
					.where(inArray(form.id, input.ids));
			});
			return { ok: true, count: input.ids.length };
		}),
});
