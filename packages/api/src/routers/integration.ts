import {
	formIntegration,
	formIntegrationEvent,
	formSubmission,
} from "@StryveForms/db/schema/forms";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { requireForm } from "../lib/access";
import { runIntegrations } from "../services/integrations/dispatch";
import { INTEGRATION_CATALOG } from "../services/integrations/handlers";
import {
	cleanIntegrationData,
	createFormIntegration,
	deleteFormIntegration,
	INTEGRATION_IDS,
	updateFormIntegration,
} from "../services/integrations/manage";
import { sendIntegrationTest } from "../services/integrations/test-send";

const integrationIds = INTEGRATION_IDS;

const integrationInput = z.object({
	integrationId: z.enum(integrationIds),
	status: z.enum(["active", "inactive"]).default("active"),
	data: z.record(z.string(), z.unknown()).default({}),
	/** Optional "only send if…" condition tree. */
	logic: z.record(z.string(), z.unknown()).nullable().default(null),
	/** "Security"/"Payload"/"Advanced" settings, kept separate from `data`. */
	settings: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Same shape as `integrationInput`, but every field is truly optional with no
 * default — `integrationInput.partial()` would re-apply each field's
 * `.default()` to an omitted key, so a status-only toggle would silently
 * reset `data` to `{}` and `status` back to "active".
 */
export const integrationPatchInput = z.object({
	data: z.record(z.string(), z.unknown()).optional(),
	integrationId: z.enum(integrationIds).optional(),
	logic: z.record(z.string(), z.unknown()).nullable().optional(),
	settings: z.record(z.string(), z.unknown()).optional(),
	status: z.enum(["active", "inactive"]).optional(),
});

export const integrationRouter = router({
	catalog: protectedProcedure.query(() => INTEGRATION_CATALOG),

	list: protectedProcedure
		.input(z.object({ formId: z.string() }))
		.query(async ({ ctx, input }) => {
			await requireForm(ctx.db, input.formId, ctx.session.user.id);
			return ctx.db
				.select()
				.from(formIntegration)
				.where(
					and(
						eq(formIntegration.formId, input.formId),
						isNull(formIntegration.deletedAt)
					)
				)
				.orderBy(formIntegration.createdAt);
		}),

	create: protectedProcedure
		.input(integrationInput.extend({ formId: z.string() }))
		.mutation(({ ctx, input }) =>
			createFormIntegration(ctx.db, input.formId, ctx.session.user.id, input)
		),

	update: protectedProcedure
		.input(integrationPatchInput.extend({ formId: z.string(), id: z.string() }))
		.mutation(({ ctx, input }) => {
			const { formId, id, ...patch } = input;
			return updateFormIntegration(
				ctx.db,
				formId,
				id,
				ctx.session.user.id,
				patch
			);
		}),

	delete: protectedProcedure
		.input(z.object({ formId: z.string(), id: z.string() }))
		.mutation(({ ctx, input }) =>
			deleteFormIntegration(ctx.db, input.formId, input.id, ctx.session.user.id)
		),

	events: protectedProcedure
		.input(z.object({ formId: z.string(), id: z.string() }))
		.query(async ({ ctx, input }) => {
			await requireForm(ctx.db, input.formId, ctx.session.user.id);
			return ctx.db
				.select()
				.from(formIntegrationEvent)
				.where(eq(formIntegrationEvent.integrationId, input.id))
				.orderBy(desc(formIntegrationEvent.createdAt))
				.limit(100);
		}),

	/** The most recent delivery (success/error + when) for each of the form's integrations. */
	lastRuns: protectedProcedure
		.input(z.object({ formId: z.string() }))
		.query(async ({ ctx, input }) => {
			await requireForm(ctx.db, input.formId, ctx.session.user.id);
			const rows = await ctx.db
				.select({
					createdAt: formIntegrationEvent.createdAt,
					integrationId: formIntegrationEvent.integrationId,
					type: formIntegrationEvent.type,
				})
				.from(formIntegrationEvent)
				.innerJoin(
					formIntegration,
					eq(formIntegration.id, formIntegrationEvent.integrationId)
				)
				.where(eq(formIntegration.formId, input.formId))
				.orderBy(desc(formIntegrationEvent.createdAt))
				.limit(200);
			const latest: Record<string, { createdAt: Date; type: string }> = {};
			for (const row of rows) {
				if (!latest[row.integrationId]) {
					latest[row.integrationId] = {
						createdAt: row.createdAt,
						type: row.type,
					};
				}
			}
			return latest;
		}),

	/** Re-sends the latest submission through the form's integrations. */
	test: protectedProcedure
		.input(z.object({ formId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { form } = await requireForm(
				ctx.db,
				input.formId,
				ctx.session.user.id,
				"edit"
			);
			const [latest] = await ctx.db
				.select()
				.from(formSubmission)
				.where(
					and(
						eq(formSubmission.formId, form.id),
						eq(formSubmission.status, "completed")
					)
				)
				.orderBy(desc(formSubmission.createdAt))
				.limit(1);
			if (!latest) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Submit the form once before testing.",
				});
			}
			await runIntegrations(ctx.db, ctx.services, form, latest);
			return { ok: true };
		}),

	/**
	 * Sends one integration a realistic sample payload (built from the form's
	 * fields, marked as a test) through its real handler — including the SSRF
	 * guard — without needing a real submission on file. Works for an
	 * unsaved draft (no `id`) or an existing integration (`id`, which also
	 * logs the attempt to its delivery log, labelled "Test").
	 */
	sendTest: protectedProcedure
		.input(
			z.object({
				data: z.record(z.string(), z.unknown()).default({}),
				formId: z.string(),
				id: z.string().optional(),
				integrationId: z.enum(integrationIds),
				settings: z.record(z.string(), z.unknown()).default({}),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { form } = await requireForm(
				ctx.db,
				input.formId,
				ctx.session.user.id,
				"edit",
				"manage_integrations"
			);
			const clean = await cleanIntegrationData(input.data);
			const result = await sendIntegrationTest(
				ctx.db,
				ctx.services,
				form,
				input.integrationId,
				clean,
				input.settings
			);
			if (input.id) {
				await ctx.db.insert(formIntegrationEvent).values({
					data: {
						test: true,
						...(result.ok
							? { response: result.response, status: result.status }
							: { message: result.error, status: result.status }),
						durationMs: result.durationMs,
					},
					integrationId: input.id,
					type: result.ok ? "success" : "error",
				});
			}
			return result;
		}),
});
