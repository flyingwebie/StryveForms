import type { Database } from "@StryveForms/db";
import { user } from "@StryveForms/db/schema/auth";
import {
	formIntegration,
	formIntegrationEvent,
	workspace,
} from "@StryveForms/db/schema/forms";
import { emails } from "@StryveForms/emails/messages";
import { type ConditionNode, conditionsMet } from "@StryveForms/forms/logic";
import { and, eq, isNull } from "drizzle-orm";

import type { Services } from "../../context";
import type { FormRow } from "../../lib/serialize";
import { emailBranding } from "../instance";
import { workspaceMailer } from "../mail";
import {
	HANDLERS,
	INTEGRATION_CATALOG,
	type IntegrationHandler,
	type IntegrationRun,
} from "./handlers";
import type { SubmissionRow } from "./payload";

/** Integration logic is either a bare condition tree (OpnForm) or `{ conditions }`. */
export function integrationConditions(logic: unknown): ConditionNode | null {
	if (!logic || typeof logic !== "object") {
		return null;
	}
	const candidate = logic as Record<string, unknown>;
	if ("operatorIdentifier" in candidate || "value" in candidate) {
		return candidate as unknown as ConditionNode;
	}
	if (candidate.conditions && typeof candidate.conditions === "object") {
		return candidate.conditions as ConditionNode;
	}
	return null;
}

function integrationName(id: string): string {
	return INTEGRATION_CATALOG.find((i) => i.id === id)?.name ?? id;
}

/**
 * Calls the handler once, and — when "Retry on failure" is on — a second
 * time after a short delay if the first attempt threw. Only the final
 * outcome (and whether a retry happened) is returned.
 */
async function callWithRetry(
	handler: IntegrationHandler,
	run: IntegrationRun,
	retryOnFailure: boolean
): Promise<{ result: Record<string, unknown> | undefined; retried: boolean }> {
	try {
		return { result: await handler(run), retried: false };
	} catch (firstError) {
		if (!retryOnFailure) {
			throw firstError;
		}
		await new Promise((resolve) => setTimeout(resolve, 2000));
		return { result: await handler(run), retried: true };
	}
}

async function notifyFailure(
	db: Database,
	services: Services,
	form: FormRow,
	integrationId: string,
	error: string
) {
	if (!form.creatorId) {
		return;
	}
	const [creator] = await db
		.select()
		.from(user)
		.where(eq(user.id, form.creatorId));
	if (!creator) {
		return;
	}
	const { config } = services;
	await services.mailer.send({
		react: emails.integrationFailed({
			branding: await emailBranding(db, config, {
				workspaceId: form.workspaceId,
			}),
			error,
			formTitle: form.title,
			formUrl: `${config.appUrl}/dashboard/forms/${form.id}/integrations`,
			integrationName: integrationName(integrationId),
		}),
		subject: `Integration issue with your form “${form.title}”`,
		to: creator.email,
	});
}

/**
 * Runs every active integration for a completed submission. Never throws:
 * each result is recorded as an integration event.
 */
export async function runIntegrations(
	db: Database,
	services: Services,
	form: FormRow,
	submission: SubmissionRow
) {
	const integrations = await db
		.select()
		.from(formIntegration)
		.where(
			and(
				eq(formIntegration.formId, form.id),
				eq(formIntegration.status, "active"),
				isNull(formIntegration.deletedAt)
			)
		);
	if (integrations.length === 0) {
		return;
	}
	const [ws] = await db
		.select()
		.from(workspace)
		.where(eq(workspace.id, form.workspaceId));
	const { mailer, senderAddress } = workspaceMailer(
		services,
		ws?.settings ?? {}
	);
	const branding = await emailBranding(db, services.config, {
		workspaceId: form.workspaceId,
	});

	await Promise.all(
		integrations.map((integration) =>
			runOneIntegration(
				db,
				services,
				form,
				submission,
				{
					branding,
					mailer,
					senderAddress,
					workspaceSettings: ws?.settings ?? null,
				},
				integration
			)
		)
	);
}

type FormIntegrationRow = typeof formIntegration.$inferSelect;

/** Runs, times out/retries, and logs a single integration against a submission. */
async function runOneIntegration(
	db: Database,
	services: Services,
	form: FormRow,
	submission: SubmissionRow,
	shared: {
		branding: Awaited<ReturnType<typeof emailBranding>>;
		mailer: ReturnType<typeof workspaceMailer>["mailer"];
		senderAddress: string | undefined;
		workspaceSettings: Record<string, unknown> | null;
	},
	integration: FormIntegrationRow
) {
	const handler = HANDLERS[integration.integrationId];
	const conditions = integrationConditions(integration.logic);
	if (!handler || (conditions && !conditionsMet(conditions, submission.data))) {
		return;
	}
	const run = {
		...shared,
		config: services.config,
		data: integration.data,
		db,
		form,
		integrationId: integration.integrationId,
		settings: integration.settings,
		storage: services.storage,
		submission,
	};
	// "Retry on failure" (an Advanced setting on webhook-like integrations):
	// one retry after a short delay before giving up and logging an error.
	const retryOnFailure = Boolean(
		(integration.settings as Record<string, unknown> | null)?.retry_on_failure
	);
	try {
		const { result, retried } = await callWithRetry(
			handler,
			run,
			retryOnFailure
		);
		await db.insert(formIntegrationEvent).values({
			data: {
				submissionId: submission.publicId,
				...(retried ? { retried: true } : {}),
				...(result ?? {}),
			},
			integrationId: integration.id,
			type: "success",
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await db.insert(formIntegrationEvent).values({
			data: { message, submissionId: submission.publicId },
			integrationId: integration.id,
			type: "error",
		});
		await notifyFailure(
			db,
			services,
			form,
			integration.integrationId,
			message
		).catch(() => undefined);
	}
}
