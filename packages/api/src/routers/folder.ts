import { folder, form, template } from "@StryveForms/db/schema/forms";
import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray, isNull, max } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { requireWorkspace } from "../lib/access";
import { newId } from "../lib/ids";

const kindSchema = z.enum(["form", "template"]);

/** Loads a folder and checks the caller may act on its workspace. */
async function requireFolder(
	db: Parameters<typeof requireWorkspace>[0],
	folderId: string,
	userId: string,
	permission: "view" | "edit" | "manage" = "view"
) {
	const [row] = await db.select().from(folder).where(eq(folder.id, folderId));
	if (!row) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found" });
	}
	await requireWorkspace(db, row.workspaceId, userId, permission);
	return row;
}

/**
 * Would re-parenting `folderId` under `newParentId` create a cycle (i.e. is
 * `newParentId` the folder itself or one of its own descendants)?
 */
async function wouldCreateCycle(
	db: Parameters<typeof requireWorkspace>[0],
	workspaceId: string,
	kind: "form" | "template",
	folderId: string,
	newParentId: string
): Promise<boolean> {
	if (newParentId === folderId) {
		return true;
	}
	const rows = await db
		.select({ id: folder.id, parentId: folder.parentId })
		.from(folder)
		.where(and(eq(folder.workspaceId, workspaceId), eq(folder.kind, kind)));
	const parentById = new Map(rows.map((r) => [r.id, r.parentId]));
	let current: string | null = newParentId;
	const seen = new Set<string>();
	while (current) {
		if (current === folderId) {
			return true;
		}
		if (seen.has(current)) {
			return false;
		}
		seen.add(current);
		current = parentById.get(current) ?? null;
	}
	return false;
}

export const folderRouter = router({
	/** Folders for a workspace's Forms or Templates sidebar, with item counts. */
	list: protectedProcedure
		.input(z.object({ workspaceId: z.string(), kind: kindSchema }))
		.query(async ({ ctx, input }) => {
			await requireWorkspace(ctx.db, input.workspaceId, ctx.session.user.id);
			const rows = await ctx.db
				.select()
				.from(folder)
				.where(
					and(
						eq(folder.workspaceId, input.workspaceId),
						eq(folder.kind, input.kind)
					)
				)
				.orderBy(folder.position);
			if (rows.length === 0) {
				return [];
			}
			const ids = rows.map((r) => r.id);
			const counts =
				input.kind === "form"
					? await ctx.db
							.select({ folderId: form.folderId, n: count() })
							.from(form)
							.where(and(inArray(form.folderId, ids), isNull(form.deletedAt)))
							.groupBy(form.folderId)
					: await ctx.db
							.select({ folderId: template.folderId, n: count() })
							.from(template)
							.where(inArray(template.folderId, ids))
							.groupBy(template.folderId);
			const countsById = new Map(counts.map((c) => [c.folderId, c.n]));
			return rows.map((row) => ({
				...row,
				count: countsById.get(row.id) ?? 0,
			}));
		}),

	create: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				kind: kindSchema,
				name: z.string().min(1).max(100),
				color: z.string().max(20).nullable().optional(),
				icon: z.string().max(40).nullable().optional(), // plain emoji or "lucide:<icon-name>"
				parentId: z.string().nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			await requireWorkspace(
				ctx.db,
				input.workspaceId,
				ctx.session.user.id,
				"edit",
				"manage_folders"
			);
			if (input.parentId) {
				const [parentRow] = await ctx.db
					.select()
					.from(folder)
					.where(eq(folder.id, input.parentId));
				if (
					!(
						parentRow &&
						parentRow.workspaceId === input.workspaceId &&
						parentRow.kind === input.kind
					)
				) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "That parent folder doesn't exist here",
					});
				}
			}
			const [top] = await ctx.db
				.select({ max: max(folder.position) })
				.from(folder)
				.where(
					and(
						eq(folder.workspaceId, input.workspaceId),
						eq(folder.kind, input.kind)
					)
				);
			const id = newId();
			await ctx.db.insert(folder).values({
				id,
				workspaceId: input.workspaceId,
				kind: input.kind,
				name: input.name,
				color: input.color ?? null,
				icon: input.icon ?? null,
				parentId: input.parentId ?? null,
				position: (top?.max ?? 0) + 1,
			});
			return { id };
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).max(100).optional(),
				color: z.string().max(20).nullable().optional(),
				icon: z.string().max(40).nullable().optional(), // plain emoji or "lucide:<icon-name>"
				parentId: z.string().nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const row = await requireFolder(
				ctx.db,
				input.id,
				ctx.session.user.id,
				"edit"
			);
			if (input.parentId) {
				const [parentRow] = await ctx.db
					.select()
					.from(folder)
					.where(eq(folder.id, input.parentId));
				if (
					!(
						parentRow &&
						parentRow.workspaceId === row.workspaceId &&
						parentRow.kind === row.kind
					)
				) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "That parent folder doesn't exist here",
					});
				}
				if (
					await wouldCreateCycle(
						ctx.db,
						row.workspaceId,
						row.kind,
						row.id,
						input.parentId
					)
				) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"A folder can't be nested inside itself or its own subfolder",
					});
				}
			}
			const { id: _id, ...rest } = input;
			await ctx.db.update(folder).set(rest).where(eq(folder.id, input.id));
			return { ok: true };
		}),

	/** Deletes a folder. Its forms/templates and any sub-folders become unfiled. */
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const row = await requireFolder(
				ctx.db,
				input.id,
				ctx.session.user.id,
				"edit"
			);
			await ctx.db.transaction(async (tx) => {
				if (row.kind === "form") {
					await tx
						.update(form)
						.set({ folderId: null })
						.where(eq(form.folderId, input.id));
				} else {
					await tx
						.update(template)
						.set({ folderId: null })
						.where(eq(template.folderId, input.id));
				}
				await tx
					.update(folder)
					.set({ parentId: null })
					.where(eq(folder.parentId, input.id));
				await tx.delete(folder).where(eq(folder.id, input.id));
			});
			return { ok: true };
		}),

	/** Persists a new sidebar order for a set of sibling folders. */
	reorder: protectedProcedure
		.input(z.object({ ids: z.array(z.string()).min(1).max(200) }))
		.mutation(async ({ ctx, input }) => {
			const rows = await ctx.db
				.select({ id: folder.id, workspaceId: folder.workspaceId })
				.from(folder)
				.where(inArray(folder.id, input.ids));
			const workspaceIds = new Set(rows.map((r) => r.workspaceId));
			if (workspaceIds.size !== 1) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "All folders must belong to the same workspace",
				});
			}
			const [workspaceId] = [...workspaceIds];
			if (workspaceId) {
				await requireWorkspace(
					ctx.db,
					workspaceId,
					ctx.session.user.id,
					"edit"
				);
			}
			await ctx.db.transaction(async (tx) => {
				await Promise.all(
					input.ids.map((id, index) =>
						tx.update(folder).set({ position: index }).where(eq(folder.id, id))
					)
				);
			});
			return { ok: true };
		}),
});
