/**
 * Input schemas for the AI assistant's tools (tools.ts), pulled out into
 * their own module so each one can be unit-tested in isolation — the
 * `toolDefinition({ inputSchema })` call site doesn't need the schema
 * object to be built inline.
 */
import { z } from "zod";

import { formSpecSchema } from "./form-spec";

export const LIST_FORMS_MAX = 50;
export const SEARCH_SUBMISSIONS_MAX = 20;
export const GET_SUBMISSION_STATS_MAX_DAYS = 365;

export const listFormsInputSchema = z.object({
	limit: z.number().int().min(1).max(LIST_FORMS_MAX).default(20),
	query: z.string().max(200).optional(),
});

export const getFormInputSchema = z.object({ formId: z.string().min(1) });

/** Same shape as `create_form` — editing a form replaces its whole field list. */
export const updateFormFieldsInputSchema = z.object({
	fields: formSpecSchema.shape.fields,
	formId: z.string().min(1),
});

export const getSubmissionStatsInputSchema = z.object({
	days: z
		.number()
		.int()
		.min(1)
		.max(GET_SUBMISSION_STATS_MAX_DAYS)
		.optional()
		.describe(
			"Only count submissions from the last N days. Omit for all time."
		),
	formId: z.string().min(1),
});

export const searchSubmissionsInputSchema = z.object({
	formId: z.string().min(1),
	limit: z.number().int().min(1).max(SEARCH_SUBMISSIONS_MAX).default(10),
	query: z.string().max(200).optional(),
});

export const explainFormLogicInputSchema = z.object({
	formId: z.string().min(1),
});

/* -------------------------------------------------------------------------- */
/*                    Integrations & email notifications                      */
/* -------------------------------------------------------------------------- */
/** Same shapes as services/agent/tools.ts's MCP/CLI input schemas (minus
 * `formId`'s cross-workspace trust — the assistant always checks the form
 * is in the chat's own workspace before calling the shared service). */

export const listIntegrationsToolInputSchema = z.object({
	formId: z.string().min(1),
});

export const listIntegrationTypesToolInputSchema = z.object({});

export const createIntegrationToolInputSchema = z.object({
	data: z.record(z.string(), z.unknown()).default({}),
	formId: z.string().min(1),
	integrationId: z.string().min(1),
	logic: z.record(z.string(), z.unknown()).nullable().optional(),
	settings: z.record(z.string(), z.unknown()).default({}),
	status: z.enum(["active", "inactive"]).default("active"),
});

export const updateIntegrationToolInputSchema = z.object({
	data: z.record(z.string(), z.unknown()).optional(),
	formId: z.string().min(1),
	id: z.string().min(1),
	logic: z.record(z.string(), z.unknown()).nullable().optional(),
	settings: z.record(z.string(), z.unknown()).optional(),
	status: z.enum(["active", "inactive"]).optional(),
});

export const deleteIntegrationToolInputSchema = z.object({
	formId: z.string().min(1),
	id: z.string().min(1),
});

export const testIntegrationToolInputSchema = z.object({
	data: z.record(z.string(), z.unknown()).optional(),
	formId: z.string().min(1),
	id: z.string().min(1).optional(),
	integrationId: z.string().min(1).optional(),
	settings: z.record(z.string(), z.unknown()).optional(),
});

const notificationDataShape = z
	.object({
		attach_pdf_template_id: z.string().optional(),
		email_content: z.string().optional(),
		include_hidden_fields_submission_data: z.boolean().optional(),
		include_submission_data: z.boolean().optional(),
		link_edit_submission: z.boolean().optional(),
		reply_to: z.string().optional(),
		send_to: z.string().optional(),
		sender_name: z.string().optional(),
		senderId: z.string().nullable().optional(),
		subject: z.string().optional(),
	})
	.passthrough();

export const listEmailNotificationsToolInputSchema = z.object({
	formId: z.string().min(1),
});

export const createEmailNotificationToolInputSchema = z.object({
	data: notificationDataShape.default({}),
	formId: z.string().min(1),
	logic: z.record(z.string(), z.unknown()).nullable().optional(),
	status: z.enum(["active", "inactive"]).default("active"),
});

export const updateEmailNotificationToolInputSchema = z.object({
	data: notificationDataShape.optional(),
	formId: z.string().min(1),
	id: z.string().min(1),
	logic: z.record(z.string(), z.unknown()).nullable().optional(),
	status: z.enum(["active", "inactive"]).optional(),
});

export const deleteEmailNotificationToolInputSchema = z.object({
	formId: z.string().min(1),
	id: z.string().min(1),
});

export const previewEmailNotificationToolInputSchema = z.object({
	data: notificationDataShape,
	formId: z.string().min(1),
});

export const sendTestEmailNotificationToolInputSchema = z.object({
	data: notificationDataShape,
	formId: z.string().min(1),
	to: z
		.string()
		.email()
		.optional()
		.describe("Defaults to the signed-in user's own email address."),
});

export const listSendersToolInputSchema = z.object({});
