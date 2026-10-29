/**
 * The MCP tool set: one `McpServer` factory, reused for every request to
 * apps/server's `/api/mcp` route (createMcpHandler calls the factory fresh
 * per request — MCP 2026-07-28 is a stateless protocol). Every tool here is
 * a thin wrapper around services/agent/tools.ts, the same functions the
 * `instance.agent.*` tRPC procedures call for the CLI — one service layer,
 * two front-ends.
 *
 * Auth: apps/server resolves the caller (OAuth access token or personal API
 * token) and attaches it as `AuthInfo.extra` before calling
 * `mcpServerHandler.fetch(request, { authInfo })` — see that file for why.
 * Every handler below reads it back through `ctx.http?.authInfo`.
 */

import type { Database } from "@StryveForms/db";
import {
	type CallToolResult,
	McpServer,
	type ServerContext,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Services } from "../../context";
import { getInstanceSettings } from "../instance";
import { resolveAgentSettings } from "./settings";
import type { TokenScope } from "./tokens";
import {
	type AgentContext,
	createEmailNotification,
	createEmailNotificationInput,
	createForm,
	createFormInput,
	createIntegration,
	createIntegrationInput,
	deleteEmailNotification,
	deleteEmailNotificationInput,
	deleteIntegration,
	deleteIntegrationInput,
	exportSubmissionsCsvLink,
	exportSubmissionsCsvLinkInput,
	getForm,
	getFormInput,
	getSubmission,
	getSubmissionInput,
	getSubmissionStats,
	getSubmissionStatsInput,
	listEmailNotifications,
	listEmailNotificationsInput,
	listForms,
	listFormsInput,
	listIntegrations,
	listIntegrationsInput,
	listIntegrationTypes,
	listIntegrationTypesInput,
	listSenders,
	listSendersInput,
	listSubmissions,
	listSubmissionsInput,
	listWorkspaces,
	previewEmailNotification,
	previewEmailNotificationInput,
	sendTestEmailNotificationInput,
	sendTestEmailNotificationTool,
	setFormVisibility,
	setFormVisibilityInput,
	testIntegration,
	testIntegrationInput,
	updateEmailNotification,
	updateEmailNotificationInput,
	updateFormFields,
	updateFormFieldsInput,
	updateFormSettings,
	updateFormSettingsInput,
	updateIntegration,
	updateIntegrationInput,
} from "./tools";

/** What apps/server stamps onto `AuthInfo` once it has identified the caller. */
export interface AgentAuthInfo {
	clientId: string;
	extra: { scope: TokenScope; userId: string };
	resource?: URL;
	scopes: string[];
	token: string;
}

class McpAuthError extends Error {}

function authFromCtx(ctx: ServerContext): AgentAuthInfo {
	const authInfo = ctx.http?.authInfo as AgentAuthInfo | undefined;
	if (!authInfo?.extra?.userId) {
		throw new McpAuthError("Not authenticated.");
	}
	return authInfo;
}

function errorResult(message: string): CallToolResult {
	return {
		content: [{ text: message, type: "text" }],
		isError: true,
	};
}

function okResult(data: unknown): CallToolResult {
	return {
		content: [{ text: JSON.stringify(data, null, 2), type: "text" }],
		structuredContent: data as Record<string, unknown>,
	};
}

export interface McpServerFactoryOptions {
	db: Database;
	services: Services;
}

/** `[Write]` prefix on the description makes the write/read split obvious to a model choosing a tool. */
function describe(write: boolean, description: string): string {
	return write ? `[Write] ${description}` : description;
}

export function buildMcpServerFactory(options: McpServerFactoryOptions) {
	return async () => {
		// Re-read on every request (not baked in once) so the admin's
		// "allow write tools" toggle takes effect immediately, with no
		// restart — getInstanceSettings is already cached for ~30s.
		const instanceSettings = await getInstanceSettings(options.db);
		const { allowWriteTools } = resolveAgentSettings(
			instanceSettings.agentSettings
		);
		const server = new McpServer({ name: "stryveforms", version: "1.0.0" });

		function registerRead<Input extends z.ZodTypeAny>(
			name: string,
			description: string,
			inputSchema: Input,
			run: (ctx: AgentContext, input: z.infer<Input>) => Promise<unknown>
		) {
			const handler = async (
				rawArgs: unknown,
				serverCtx: ServerContext
			): Promise<CallToolResult> => {
				try {
					const auth = authFromCtx(serverCtx);
					const agentCtx: AgentContext = {
						db: options.db,
						services: options.services,
						userId: auth.extra.userId,
					};
					return okResult(await run(agentCtx, rawArgs as z.infer<Input>));
				} catch (error) {
					return errorResult(
						error instanceof Error ? error.message : "Tool call failed"
					);
				}
			};
			server.registerTool(
				name,
				{ annotations: { readOnlyHint: true }, description, inputSchema },
				// biome-ignore lint/suspicious/noExplicitAny: the SDK's overloads can't express "any zod object schema in, CallToolResult out" generically; the handler itself is fully typed.
				handler as any
			);
		}

		function registerWrite<Input extends z.ZodTypeAny>(
			name: string,
			description: string,
			inputSchema: Input,
			run: (ctx: AgentContext, input: z.infer<Input>) => Promise<unknown>
		) {
			const handler = async (
				rawArgs: unknown,
				serverCtx: ServerContext
			): Promise<CallToolResult> => {
				try {
					const auth = authFromCtx(serverCtx);
					if (!allowWriteTools) {
						return errorResult(
							"Write tools are turned off for this instance. Ask an administrator to enable them in Admin → AI agents & MCP."
						);
					}
					if (auth.extra.scope !== "write") {
						return errorResult(
							"This token is read-only. Create or use a token/connection with write access to call this tool."
						);
					}
					const agentCtx: AgentContext = {
						db: options.db,
						services: options.services,
						userId: auth.extra.userId,
					};
					return okResult(await run(agentCtx, rawArgs as z.infer<Input>));
				} catch (error) {
					return errorResult(
						error instanceof Error ? error.message : "Tool call failed"
					);
				}
			};
			server.registerTool(
				name,
				{
					annotations: { readOnlyHint: false },
					description: describe(true, description),
					inputSchema,
				},
				// biome-ignore lint/suspicious/noExplicitAny: the SDK's overloads can't express "any zod object schema in, CallToolResult out" generically; the handler itself is fully typed.
				handler as any
			);
		}

		registerRead(
			"list_workspaces",
			"List the workspaces the authenticated user belongs to, with their role in each. Call this first to get a workspaceId.",
			z.object({}),
			(ctx) => listWorkspaces(ctx)
		);

		registerRead(
			"list_forms",
			"List forms in a workspace, optionally filtered by a title search.",
			listFormsInput,
			(ctx, input) => listForms(ctx, input)
		);

		registerRead(
			"get_form",
			"Get one form's fields, settings and share URL by id.",
			getFormInput,
			(ctx, input) => getForm(ctx, input)
		);

		registerWrite(
			"create_form",
			"Create a new draft form from a title and a list of fields. Pick blockId from: text, rich_text, email, phone_number, url, number, date, select, radio, multi_select, checkbox, toggle_switch, rating, scale, slider, matrix, files, signature, nf-page-break, nf-divider, nf-text. The form starts as a draft — call set_form_visibility to publish it.",
			createFormInput,
			(ctx, input) => createForm(ctx, input)
		);

		registerWrite(
			"update_form_fields",
			"Replace a form's field list (add, remove, reorder or edit fields) by giving the full new field list. Call get_form first to see the current fields and keep any you aren't changing.",
			updateFormFieldsInput,
			(ctx, input) => updateFormFields(ctx, input)
		);

		registerWrite(
			"update_form_settings",
			"Update a form's title, submit button text, close date, max submissions, redirect URL or captcha setting.",
			updateFormSettingsInput,
			(ctx, input) => updateFormSettings(ctx, input)
		);

		registerWrite(
			"set_form_visibility",
			'Publish ("public"), close ("closed"), or revert to draft ("draft") a form.',
			setFormVisibilityInput,
			(ctx, input) => setFormVisibility(ctx, input)
		);

		registerRead(
			"list_submissions",
			"List a form's submissions, paginated, with filters for status, free-text search and a date range.",
			listSubmissionsInput,
			(ctx, input) => listSubmissions(ctx, input)
		);

		registerRead(
			"get_submission",
			"Get one submission's full answers by id.",
			getSubmissionInput,
			(ctx, input) => getSubmission(ctx, input)
		);

		registerRead(
			"get_submission_stats",
			"Get a form's submission summary: views, completion rate, average completion time, and a per-question breakdown. Optionally limit to the last N days.",
			getSubmissionStatsInput,
			(ctx, input) => getSubmissionStats(ctx, input)
		);

		registerRead(
			"export_submissions_csv_link",
			"Get a short-lived (10 minute) signed download link for a form's submissions as CSV, matching the given filters.",
			exportSubmissionsCsvLinkInput,
			(ctx, input) => exportSubmissionsCsvLink(ctx, input)
		);

		registerRead(
			"list_integrations",
			"List a form's connected integrations (email, Slack, webhooks…) and whether each is active. Never returns secrets or payload contents.",
			listIntegrationsInput,
			(ctx, input) => listIntegrations(ctx, input)
		);

		registerRead(
			"list_integration_types",
			"Every integration type this instance can configure, with its data/settings field names, types and descriptions. Call this before create_integration so you know exactly what to send.",
			listIntegrationTypesInput,
			(ctx) => listIntegrationTypes(ctx)
		);

		registerWrite(
			"create_integration",
			"Create a new integration (webhook, Slack, Discord, Telegram, n8n, Zapier, Make, Pabbly, Activepieces, or Albato) on a form. Call list_integration_types first. URLs are checked against an SSRF guard — a URL on a private network is rejected.",
			createIntegrationInput,
			(ctx, input) => createIntegration(ctx, input)
		);

		registerWrite(
			"update_integration",
			"Patch an existing integration. A given `data`/`settings` is merged into the saved values — send only the keys you're changing, the rest stay as they were.",
			updateIntegrationInput,
			(ctx, input) => updateIntegration(ctx, input)
		);

		registerWrite(
			"delete_integration",
			"Delete an integration from a form.",
			deleteIntegrationInput,
			(ctx, input) => deleteIntegration(ctx, input)
		);

		registerWrite(
			"test_integration",
			"Send one integration a realistic sample payload through its real handler (including the SSRF guard), without needing a real submission on file. Pass an existing `id` to test its saved config, or `integrationId` + data/settings to test one that isn't saved yet. Returns whether it succeeded, the HTTP status, and a truncated response body.",
			testIntegrationInput,
			(ctx, input) => testIntegration(ctx, input)
		);

		registerRead(
			"list_email_notifications",
			"List a form's email notifications, with full configuration (recipients, subject, body, sender, attachment, condition) — unlike list_integrations, which never returns data for any type.",
			listEmailNotificationsInput,
			(ctx, input) => listEmailNotifications(ctx, input)
		);

		registerWrite(
			"create_email_notification",
			'Create a new email notification on a form. See list_integration_types\'s "email" entry for the data fields (send_to, subject, email_content, sender_name, reply_to, senderId, attach_pdf_template_id, include_submission_data…).',
			createEmailNotificationInput,
			(ctx, input) => createEmailNotification(ctx, input)
		);

		registerWrite(
			"update_email_notification",
			"Patch an existing email notification. A given `data` is merged into the saved values — send only the keys you're changing.",
			updateEmailNotificationInput,
			(ctx, input) => updateEmailNotification(ctx, input)
		);

		registerWrite(
			"delete_email_notification",
			"Delete an email notification from a form.",
			deleteEmailNotificationInput,
			(ctx, input) => deleteEmailNotification(ctx, input)
		);

		registerRead(
			"preview_email_notification",
			"Render a draft (or saved) email notification against the form's latest submission (or sample data) — the same render the web UI's live preview shows. Returns the subject, resolved from/reply-to, recipients, a plain-text excerpt, and the full rendered HTML.",
			previewEmailNotificationInput,
			(ctx, input) => previewEmailNotification(ctx, input)
		);

		registerWrite(
			"send_test_email_notification",
			"Send a draft (or saved) email notification as a real test send, so it can be checked in an actual inbox. Defaults to the calling user's own email; pass `to` to send it elsewhere.",
			sendTestEmailNotificationInput,
			(ctx, input) => sendTestEmailNotificationTool(ctx, input)
		);

		registerRead(
			"list_senders",
			"List a workspace's configured \"From\" sender identities (Settings → Email sending) — pick a senderId from here for create_email_notification/update_email_notification's data.senderId.",
			listSendersInput,
			(ctx, input) => listSenders(ctx, input)
		);

		return server;
	};
}
