/**
 * Workspace export / import and shared backup-job queries.
 * Owner: engineer P (backup core). See /tmp/sf-scripts/BACKUP_DESIGN.md and
 * packages/api/src/services/backup/CONTRACT.md.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { requireWorkspace } from "../lib/access";
import {
	cancelBackupJob,
	getBackupJob,
	inspectWorkspaceArchive,
	listBackupJobs,
	MIN_PASSPHRASE_LENGTH,
	startWorkspaceExport,
	startWorkspaceImport,
} from "../services/backup";

const passphraseSchema = z
	.string()
	.min(
		MIN_PASSPHRASE_LENGTH,
		`Use a passphrase of at least ${MIN_PASSPHRASE_LENGTH} characters.`
	);

/** Loads a job and checks the caller owns it (workspace export/import jobs are personal, unlike instance jobs). */
async function requireOwnJob(
	db: Parameters<typeof getBackupJob>[0],
	jobId: string,
	userId: string
) {
	const job = await getBackupJob(db, jobId);
	if (!job || job.userId !== userId) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
	}
	return job;
}

export const backupRouter = router({
	cancel: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await requireOwnJob(ctx.db, input.id, ctx.session.user.id);
			return { cancelled: await cancelBackupJob(ctx.db, input.id) };
		}),

	/** Exports a workspace. The caller must be allowed to "Export workspace" there (Roles & permissions). */
	exportWorkspace: protectedProcedure
		.input(
			z.object({
				includeUploads: z.boolean().default(true),
				passphrase: passphraseSchema.optional(),
				workspaceId: z.string(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			await requireWorkspace(
				ctx.db,
				input.workspaceId,
				ctx.session.user.id,
				"manage",
				"export_workspace"
			);
			return startWorkspaceExport(ctx.db, ctx.services, {
				includeUploads: input.includeUploads,
				passphrase: input.passphrase,
				trigger: "manual",
				userId: ctx.session.user.id,
				workspaceId: input.workspaceId,
			});
		}),

	/** Reads a previously uploaded `.stryve.zip` and returns the import preview (counts, members, warnings…). */
	inspectImport: protectedProcedure
		.input(
			z.object({ passphrase: z.string().optional(), uploadKey: z.string() })
		)
		.mutation(({ ctx, input }) =>
			inspectWorkspaceArchive(ctx.db, ctx.services, {
				passphrase: input.passphrase,
				uploadKey: input.uploadKey,
				userId: ctx.session.user.id,
			})
		),

	/** The caller's own job (any kind). */
	job: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) =>
			requireOwnJob(ctx.db, input.id, ctx.session.user.id)
		),

	/** The caller's own export/import jobs, optionally scoped to one workspace. */
	jobs: protectedProcedure
		.input(z.object({ workspaceId: z.string().optional() }).optional())
		.query(({ ctx, input }) =>
			listBackupJobs(ctx.db, {
				userId: ctx.session.user.id,
				workspaceId: input?.workspaceId,
			})
		),

	/**
	 * Starts importing a previously uploaded `.stryve.zip` as a brand new
	 * workspace the caller owns. Anyone who can create a workspace may import
	 * one (same rule as `workspace.create` — just being signed in).
	 */
	startImport: protectedProcedure
		.input(
			z.object({
				members: z
					.array(
						z.object({
							email: z.string().email(),
							role: z.enum(["admin", "user", "readonly"]),
						})
					)
					.default([]),
				passphrase: z.string().optional(),
				sendInvites: z.boolean().default(false),
				uploadKey: z.string(),
			})
		)
		.mutation(({ ctx, input }) =>
			startWorkspaceImport(ctx.db, ctx.services, {
				members: input.members,
				passphrase: input.passphrase,
				sendInvites: input.sendInvites,
				uploadKey: input.uploadKey,
				userId: ctx.session.user.id,
			})
		),
});
