/**
 * "Send test": runs one integration's real handler against a sample
 * submission built from the form's fields, through the same SSRF guard and
 * handler code path as a real delivery — so what the user sees in the
 * result panel is what a real submission would actually do.
 */
import type { Database } from "@StryveForms/db";
import { workspace } from "@StryveForms/db/schema/forms";
import { eq } from "drizzle-orm";

import type { Services } from "../../context";
import type { FormRow } from "../../lib/serialize";
import { emailBranding } from "../instance";
import { workspaceMailer } from "../mail";
import { HANDLERS } from "./handlers";
import { buildSampleSubmission } from "./sample";

export interface IntegrationTestResult {
	/** Wall-clock time the handler took, in milliseconds. */
	durationMs: number;
	/** Set when the handler threw. */
	error?: string;
	ok: boolean;
	/** First 1000 chars of the receiver's response body, when available. */
	response?: string;
	/** HTTP status code, when the handler's transport reports one. */
	status?: number;
}

const STATUS_FROM_ERROR = /^HTTP (\d+):/;

/** Runs one integration's handler with a sample payload, never throwing. */
export async function sendIntegrationTest(
	db: Database,
	services: Services,
	form: FormRow,
	integrationId: string,
	data: Record<string, unknown>,
	settings: Record<string, unknown> = {}
): Promise<IntegrationTestResult> {
	const handler = HANDLERS[integrationId];
	if (!handler) {
		return {
			durationMs: 0,
			error: `Unknown integration "${integrationId}"`,
			ok: false,
		};
	}
	const submission = buildSampleSubmission(form);
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
	const started = Date.now();
	try {
		const result = await handler({
			branding,
			config: services.config,
			data,
			db,
			form,
			integrationId,
			mailer,
			senderAddress,
			settings,
			storage: services.storage,
			submission,
			test: true,
			workspaceSettings: ws?.settings ?? null,
		});
		const status =
			typeof result?.status === "number" ? result.status : undefined;
		const response =
			typeof result?.response === "string" ? result.response : undefined;
		return { durationMs: Date.now() - started, ok: true, response, status };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const statusMatch = STATUS_FROM_ERROR.exec(message);
		return {
			durationMs: Date.now() - started,
			error: message,
			ok: false,
			status: statusMatch ? Number(statusMatch[1]) : undefined,
		};
	}
}
