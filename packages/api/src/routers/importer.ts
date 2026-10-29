import { importJob } from "@StryveForms/db/schema/forms";
import { JotformError } from "@StryveForms/jotform-import/client";
import { OpnformError } from "@StryveForms/opnform-import/client";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { cancelImport } from "../services/import/jobs";
import {
	connectJotform,
	getJotformConnection,
	previewJotformImport,
	startJotformImport,
} from "../services/import/jotform";
import {
	connectOpnform,
	getConnection,
	listSourceForms,
	previewOpnformImport,
	startImport,
} from "../services/import/opnform";
import {
	cancelPreviewTask,
	getPreviewTask,
	startPreviewTask,
} from "../services/import/preview";

function requireOpnform(connectionId: string, userId: string) {
	const connection = getConnection(connectionId, userId);
	if (!connection) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "The OpnForm connection expired. Connect again.",
		});
	}
	return connection;
}

function requireJotform(connectionId: string, userId: string) {
	const connection = getJotformConnection(connectionId, userId);
	if (!connection) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "The JotForm connection expired. Connect again.",
		});
	}
	return connection;
}

function toTrpcError(error: unknown): TRPCError {
	if (error instanceof TRPCError) {
		return error;
	}
	if (error instanceof OpnformError || error instanceof JotformError) {
		let code: TRPCError["code"] = "BAD_REQUEST";
		if (error.status === 401 || error.status === 403) {
			code = "UNAUTHORIZED";
		} else if (error.status === 429) {
			code = "TOO_MANY_REQUESTS";
		}
		return new TRPCError({ cause: error, code, message: error.message });
	}
	return new TRPCError({
		cause: error,
		code: "BAD_REQUEST",
		message: (error as Error).message,
	});
}

async function guard<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (error) {
		throw toTrpcError(error);
	}
}

function toJobDto(row: typeof importJob.$inferSelect) {
	return {
		createdAt: row.createdAt.toISOString(),
		error: row.error,
		finishedAt: row.finishedAt?.toISOString() ?? null,
		id: row.id,
		log: row.log as {
			at: string;
			level: "info" | "warn" | "error";
			message: string;
		}[],
		progress: row.progress,
		source: row.source,
		sourceUrl: row.sourceUrl,
		startedAt: row.startedAt?.toISOString() ?? null,
		status: row.status,
	};
}

/* --------------------------------- OpnForm ------------------------------- */

const opnformSelections = z
	.array(
		z.object({
			formIds: z.array(z.number().int()).min(1),
			sourceWorkspaceId: z.number().int(),
			targetWorkspaceId: z.union([z.string().min(1), z.literal("new")]),
		})
	)
	.min(1);

const opnformOptions = z.object({
	files: z.boolean().default(true),
	integrations: z.boolean().default(true),
	keepSlugs: z.boolean().default(true),
	submissions: z.boolean().default(true),
});

const opnformRouter = router({
	connect: protectedProcedure
		.input(
			z.object({
				baseUrl: z.string().url(),
				token: z.string().min(10).max(500),
			})
		)
		.mutation(({ ctx, input }) =>
			guard(async () => {
				const result = await connectOpnform(
					ctx.services,
					ctx.session.user.id,
					input.baseUrl,
					input.token.trim()
				);
				return {
					baseUrl: result.baseUrl,
					connectionId: result.connectionId,
					workspaces: result.workspaces.map((w) => ({
						icon: w.icon,
						id: w.id,
						name: w.name,
					})),
				};
			})
		),

	forms: protectedProcedure
		.input(
			z.object({ connectionId: z.string(), workspaceId: z.number().int() })
		)
		.query(({ ctx, input }) =>
			guard(() =>
				listSourceForms(
					ctx.db,
					ctx.services,
					requireOpnform(input.connectionId, ctx.session.user.id),
					input.workspaceId
				)
			)
		),

	/** Starts analysing what `start` will do. Poll `previewStatus`. Read-only. */
	preview: protectedProcedure
		.input(
			z.object({
				connectionId: z.string(),
				options: opnformOptions,
				selections: opnformSelections,
			})
		)
		.mutation(({ ctx, input }) => {
			const connection = requireOpnform(
				input.connectionId,
				ctx.session.user.id
			);
			const total = input.selections.reduce((n, s) => n + s.formIds.length, 0);
			const taskId = startPreviewTask(ctx.session.user.id, total, (reporter) =>
				previewOpnformImport(
					ctx.db,
					ctx.services,
					connection,
					input.selections,
					input.options,
					reporter
				)
			);
			return { taskId };
		}),

	start: protectedProcedure
		.input(
			z.object({
				connectionId: z.string(),
				options: opnformOptions,
				selections: opnformSelections,
			})
		)
		.mutation(({ ctx, input }) =>
			guard(() =>
				startImport(
					ctx.db,
					ctx.services,
					requireOpnform(input.connectionId, ctx.session.user.id),
					input.selections,
					input.options
				)
			)
		),
});

/* --------------------------------- JotForm ------------------------------- */

const jotformSelection = z.object({
	connectionId: z.string(),
	formIds: z.array(z.string().min(1).max(40)).min(1).max(500),
	options: z.object({
		files: z.boolean().default(true),
		integrations: z.boolean().default(true),
		submissions: z.boolean().default(true),
	}),
	targetWorkspaceId: z.union([z.string().min(1), z.literal("new")]),
});

const jotformRouter = router({
	connect: protectedProcedure
		.input(
			z.object({
				apiKey: z.string().trim().min(16).max(200),
				endpoint: z.union([
					z.enum(["auto", "us", "eu", "hipaa"]),
					z.object({ url: z.string().url() }),
				]),
			})
		)
		.mutation(({ ctx, input }) =>
			guard(() =>
				connectJotform(ctx.db, ctx.session.user.id, {
					apiKey: input.apiKey,
					endpoint: input.endpoint,
				})
			)
		),

	/** Starts analysing what `start` will do. Poll `previewStatus`. Read-only. */
	preview: protectedProcedure
		.input(jotformSelection)
		.mutation(({ ctx, input }) => {
			const connection = requireJotform(
				input.connectionId,
				ctx.session.user.id
			);
			const taskId = startPreviewTask(
				ctx.session.user.id,
				input.formIds.length,
				(reporter) => previewJotformImport(ctx.db, connection, input, reporter)
			);
			return { taskId };
		}),

	start: protectedProcedure
		.input(jotformSelection)
		.mutation(({ ctx, input }) =>
			guard(() =>
				startJotformImport(
					ctx.db,
					ctx.services,
					requireJotform(input.connectionId, ctx.session.user.id),
					input
				)
			)
		),
});

/* ---------------------------------- Jobs --------------------------------- */

export const importerRouter = router({
	jotform: jotformRouter,
	opnform: opnformRouter,

	/** Progress, log and (once done) the result of an import analysis. */
	previewStatus: protectedProcedure
		.input(z.object({ taskId: z.string() }))
		.query(({ ctx, input }) => {
			const task = getPreviewTask(input.taskId, ctx.session.user.id);
			if (!task) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "This analysis expired. Review the import again.",
				});
			}
			return task;
		}),

	cancelPreview: protectedProcedure
		.input(z.object({ taskId: z.string() }))
		.mutation(({ ctx, input }) => ({
			cancelled: cancelPreviewTask(input.taskId, ctx.session.user.id),
		})),

	job: protectedProcedure
		.input(z.object({ jobId: z.string() }))
		.query(async ({ ctx, input }) => {
			const [row] = await ctx.db
				.select()
				.from(importJob)
				.where(
					and(
						eq(importJob.id, input.jobId),
						eq(importJob.userId, ctx.session.user.id)
					)
				);
			if (!row) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Import not found" });
			}
			return toJobDto(row);
		}),

	jobs: protectedProcedure.query(async ({ ctx }) => {
		const rows = await ctx.db
			.select()
			.from(importJob)
			.where(eq(importJob.userId, ctx.session.user.id))
			.orderBy(desc(importJob.createdAt))
			.limit(20);
		return rows.map(toJobDto);
	}),

	cancel: protectedProcedure
		.input(z.object({ jobId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const [row] = await ctx.db
				.select({ id: importJob.id })
				.from(importJob)
				.where(
					and(
						eq(importJob.id, input.jobId),
						eq(importJob.userId, ctx.session.user.id)
					)
				);
			if (!row) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Import not found" });
			}
			cancelImport(input.jobId);
			return { ok: true };
		}),
});
