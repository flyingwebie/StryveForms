/**
 * Email notifications are a `formIntegration` row with `integrationId:
 * "email"`. This file is the shared service layer behind:
 *  - routers/writer.ts's `notificationPreview`/`sendTest` (the web UI's
 *    "Email notifications" tab), and
 *  - services/agent/tools.ts's `previewEmailNotification`/
 *    `sendTestEmailNotification` (the MCP server + CLI).
 * Both front-ends render/send through the exact same `composeEmail` call,
 * so a preview always matches what a real send (or a test send) produces.
 */
import type { Database } from "@StryveForms/db";
import { formSubmission, workspace } from "@StryveForms/db/schema/forms";
import {
	asDarkPreviewBranding,
	renderCustomEmailPreview,
} from "@StryveForms/emails/preview";
import type { FormField } from "@StryveForms/forms/types";
import { answerFields } from "@StryveForms/forms/values";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import type { Services } from "../context";
import type { FormRow } from "../lib/serialize";
import { emailBranding } from "./instance";
import type { IntegrationRun } from "./integrations/handlers";
import { composeEmail, pdfAttachment } from "./integrations/handlers";
import type { SubmissionRow } from "./integrations/payload";
import { workspaceMailer } from "./mail";
import { sampleValueForField } from "./pdf/model";

/** Draft data for an email notification — a subset of the `formIntegration.data`
 * jsonb shape; every field is optional so a half filled-in draft can still be
 * previewed, and an agent can patch just one field at a time. Fields may be
 * `null` too: forms imported from OpnForm store unset values that way. */
export const notificationDataSchema = z
	.object({
		attach_pdf_template_id: z.string().nullish(),
		email_content: z.string().nullish(),
		include_hidden_fields_submission_data: z.boolean().nullish(),
		include_submission_data: z.boolean().nullish(),
		link_edit_submission: z.boolean().nullish(),
		reply_to: z.string().nullish(),
		send_to: z.string().nullish(),
		sender_name: z.string().nullish(),
		senderId: z.string().nullish(),
		subject: z.string().nullish(),
	})
	.passthrough();

export type NotificationData = z.infer<typeof notificationDataSchema>;

/** Picks a real submission to preview with, or falls back to sample values
 * for every field (same values the PDF "preview with sample data" uses), so
 * a brand-new form with zero submissions still shows a realistic preview. */
export async function previewSubmission(
	db: Database,
	form: FormRow
): Promise<SubmissionRow> {
	const [latest] = await db
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
	if (latest) {
		return latest;
	}
	const fields = answerFields(form.properties as FormField[]);
	const now = new Date();
	return {
		completionTime: null,
		createdAt: now,
		data: Object.fromEntries(
			fields.map((field) => [field.id, sampleValueForField(field)])
		),
		formId: form.id,
		id: "sample",
		legacyOpnformId: null,
		meta: {},
		publicId: "sample",
		status: "completed",
		updatedAt: now,
	} satisfies SubmissionRow;
}

/** Everything a preview/test send needs about the form's workspace. */
export async function loadWorkspaceContext(db: Database, form: FormRow) {
	const [ws] = await db
		.select()
		.from(workspace)
		.where(eq(workspace.id, form.workspaceId));
	return ws ?? null;
}

export interface NotificationPreviewResult {
	fromAddress?: string;
	html: string;
	preheader: string;
	recipients: string[];
	replyTo?: string;
	senderName: string;
	subject: string;
}

const PREHEADER_LENGTH = 150;

/**
 * Renders the real email template with a draft's current data — the
 * "Email notifications" tab's live preview, and the `preview_email_notification`
 * agent tool, both call this.
 */
export async function previewEmailNotification(
	db: Database,
	services: Services,
	form: FormRow,
	data: NotificationData,
	colorScheme?: "light" | "dark"
): Promise<NotificationPreviewResult> {
	const ws = await loadWorkspaceContext(db, form);
	const { senderAddress } = workspaceMailer(services, ws?.settings ?? {});
	const baseBranding = await emailBranding(db, services.config, {
		workspaceId: form.workspaceId,
	});
	const branding =
		colorScheme === "dark" ? asDarkPreviewBranding(baseBranding) : baseBranding;
	const submission = await previewSubmission(db, form);
	const composed = composeEmail({
		branding,
		config: services.config,
		data,
		form,
		senderAddress,
		submission,
		workspaceSettings: ws?.settings ?? null,
	});
	const { html, text } = await renderCustomEmailPreview(composed.react, {
		colorScheme,
	});
	const preheader =
		text
			.split("\n")
			.map((line) => line.trim())
			.find(Boolean) ?? composed.subject;
	return {
		fromAddress: composed.fromAddress,
		html,
		preheader: preheader.slice(0, PREHEADER_LENGTH),
		recipients: composed.recipients,
		replyTo: composed.replyTo,
		senderName: composed.senderName,
		subject: composed.subject,
	};
}

export interface SendTestEmailResult {
	loggedOnly: boolean;
	ok: true;
	to: string;
}

/** Sends a draft email notification to `to` (the calling user's own email in the
 * web UI; any address an agent chooses), so it can be checked in a real inbox
 * before saving. */
export async function sendTestEmailNotification(
	db: Database,
	services: Services,
	form: FormRow,
	data: NotificationData,
	to: string
): Promise<SendTestEmailResult> {
	const ws = await loadWorkspaceContext(db, form);
	const { mailer, senderAddress } = workspaceMailer(
		services,
		ws?.settings ?? {}
	);
	const branding = await emailBranding(db, services.config, {
		workspaceId: form.workspaceId,
	});
	const submission = await previewSubmission(db, form);
	const run: IntegrationRun = {
		branding,
		config: services.config,
		data,
		db,
		form,
		mailer,
		senderAddress,
		storage: services.storage,
		submission,
		workspaceSettings: ws?.settings ?? null,
	};
	const composed = composeEmail(run);
	const attachments = await pdfAttachment(run).catch(
		(error: unknown): undefined => {
			console.error("[notifications] test email PDF attach failed", error);
		}
	);
	await mailer.send({
		attachments,
		from: composed.fromAddress
			? `${composed.senderName} <${composed.fromAddress}>`
			: undefined,
		react: composed.react,
		replyTo: composed.replyTo,
		subject: `[Test] ${composed.subject}`,
		to,
	});
	return { loggedOnly: mailer.logOnly, ok: true, to };
}
