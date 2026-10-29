/**
 * Server tools the AI assistant can call. Each tool is scoped to one
 * workspace (and, through `requireForm`/`requireWorkspace`, to the calling
 * user's permissions in it) so the model can never read or change another
 * workspace's data. Inputs are validated with zod and capped in size before
 * anything touches the database.
 */
import type { Database } from "@StryveForms/db";
import {
	form,
	formSubmission,
	formVersion,
	workspace,
} from "@StryveForms/db/schema/forms";
import { defaultFormSettings } from "@StryveForms/forms/settings";
import { type FormField, fieldOptions } from "@StryveForms/forms/types";
import { toolDefinition } from "@tanstack/ai";
import { and, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";

import type { Services } from "../../context";
import { requireForm, requireWorkspace } from "../../lib/access";
import { formSlug, newId, slugify } from "../../lib/ids";
import { toFormColumns } from "../../lib/serialize";
import { submissionFilters, toSubmissionDto } from "../../routers/submission";
import {
	type AgentContext,
	createEmailNotification,
	createIntegration,
	deleteEmailNotification,
	deleteIntegration,
	integrationTypeCatalog,
	listEmailNotifications,
	listIntegrations,
	previewEmailNotification,
	sendTestEmailNotificationTool as sendTestEmailNotificationService,
	testIntegration,
	updateEmailNotification,
	updateIntegration,
} from "../agent/tools";
import { listSenders as listWorkspaceSenders } from "../senders";
import { buildFormOverview, buildFormSummary } from "../stats";
import { buildFields, formSpecSchema } from "./form-spec";
import {
	createEmailNotificationToolInputSchema,
	createIntegrationToolInputSchema,
	deleteEmailNotificationToolInputSchema,
	deleteIntegrationToolInputSchema,
	explainFormLogicInputSchema,
	getFormInputSchema,
	getSubmissionStatsInputSchema,
	listEmailNotificationsToolInputSchema,
	listFormsInputSchema,
	listIntegrationsToolInputSchema,
	listIntegrationTypesToolInputSchema,
	listSendersToolInputSchema,
	previewEmailNotificationToolInputSchema,
	searchSubmissionsInputSchema,
	sendTestEmailNotificationToolInputSchema,
	testIntegrationToolInputSchema,
	updateEmailNotificationToolInputSchema,
	updateFormFieldsInputSchema,
	updateIntegrationToolInputSchema,
} from "./tool-schemas";

const TEXT_VALUE_CAP = 300;

export interface AiToolContext {
	db: Database;
	/** The form the chat is pinned to, if the user attached one. Tools may still address any form in the workspace by id. */
	formId: string | null;
	services: Services;
	userId: string;
	workspaceId: string;
}

/** Shapes an `AiToolContext` into the `AgentContext` the shared
 * services/agent/tools.ts functions expect — same service layer as the MCP
 * server and CLI, reused here so the in-app assistant gets create/edit/test
 * on integrations and email notifications with identical validation and
 * permission checks (requireForm's "manage_integrations" capability). */
function agentCtxOf(ctx: AiToolContext): AgentContext {
	return { db: ctx.db, services: ctx.services, userId: ctx.userId };
}

/** Keeps a before-edit snapshot, same as the form editor's undo history. */
async function snapshotFormVersion(
	db: Database,
	row: typeof form.$inferSelect,
	userId: string
) {
	const {
		id,
		workspaceId: _w,
		creatorId: _c,
		createdAt: _ca,
		passwordHash: _p,
		...snapshot
	} = row as typeof form.$inferSelect & { passwordHash?: string | null };
	await db.insert(formVersion).values({
		formId: id,
		id: newId(),
		snapshot: snapshot as unknown as Record<string, unknown>,
		userId,
	});
}

/** Same scheme as the form editor's `create`: try a few random-suffixed slugs, fall back to an id-suffixed one. */
async function uniqueFormSlug(db: Database, title: string): Promise<string> {
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

/** Trims a jsonb answer value so a search result can't balloon the tool output. */
function truncateValue(value: unknown): unknown {
	if (typeof value === "string") {
		return value.length > TEXT_VALUE_CAP
			? `${value.slice(0, TEXT_VALUE_CAP)}…`
			: value;
	}
	if (Array.isArray(value)) {
		return value.slice(0, 10).map(truncateValue);
	}
	return value;
}

async function requireFormInWorkspace(
	ctx: AiToolContext,
	formId: string,
	permission: "view" | "edit" = "view"
) {
	const { form: row, membership } = await requireForm(
		ctx.db,
		formId,
		ctx.userId,
		permission
	);
	if (row.workspaceId !== ctx.workspaceId) {
		throw new Error("This form isn't in the active workspace.");
	}
	return { form: row, membership };
}

/** Builds the agent's tool set, bound to the workspace/user making this chat request. */
export function buildAgentTools(ctx: AiToolContext) {
	const listForms = toolDefinition({
		description:
			"List forms in the current workspace, optionally filtered by a title search. Use this to find a form's id before calling get_form or other form tools.",
		inputSchema: listFormsInputSchema,
		name: "list_forms",
	}).server(async ({ limit, query }) => {
		const filters = [
			eq(form.workspaceId, ctx.workspaceId),
			isNull(form.deletedAt),
		];
		if (query) {
			filters.push(ilike(form.title, `%${query}%`));
		}
		const rows = await ctx.db
			.select({
				id: form.id,
				slug: form.slug,
				submissionsCount: sql<number>`(select count(*)::int from form_submission s where s.form_id = "form"."id" and s.status = 'completed')`,
				title: form.title,
				updatedAt: form.updatedAt,
				visibility: form.visibility,
			})
			.from(form)
			.where(and(...filters))
			.orderBy(desc(form.updatedAt))
			.limit(limit ?? 20);
		return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
	});

	const getForm = toolDefinition({
		description:
			"Get one form's fields and settings summary by id. Use this before explaining or editing a form.",
		inputSchema: getFormInputSchema,
		name: "get_form",
	}).server(async ({ formId }) => {
		const { form: row } = await requireFormInWorkspace(ctx, formId, "view");
		const properties = row.properties as FormField[];
		return {
			fields: properties.map((field) => ({
				id: field.id,
				name: field.name,
				options: fieldOptions(field).map((o) => o.name),
				required: Boolean(field.required),
				type: field.type,
				width: field.width ?? "full",
			})),
			id: row.id,
			settings: {
				closesAt: row.closesAt?.toISOString() ?? null,
				maxSubmissionsCount: row.maxSubmissionsCount,
				submitButtonText: row.submitButtonText,
				useCaptcha: row.useCaptcha,
			},
			slug: row.slug,
			title: row.title,
			visibility: row.visibility,
		};
	});

	const createForm = toolDefinition({
		description:
			"Create a new draft form from a title and a list of fields. Pick blockId from: text, rich_text, email, phone_number, url, number, date, select, radio, multi_select, checkbox, toggle_switch, rating, scale, slider, matrix, files, signature, nf-page-break, nf-divider, nf-text. The form is created as a draft (not public) and follows the workspace brand automatically.",
		inputSchema: formSpecSchema,
		name: "create_form",
	}).server(async ({ fields, title }) => {
		await requireWorkspace(ctx.db, ctx.workspaceId, ctx.userId, "edit");
		const properties = buildFields(fields);
		const settings = {
			...defaultFormSettings(),
			properties,
			title,
			visibility: "draft" as const,
		};
		const id = newId();
		const slug = await uniqueFormSlug(ctx.db, title);
		await ctx.db.insert(form).values({
			...toFormColumns(settings),
			creatorId: ctx.userId,
			id,
			slug,
			title,
			workspaceId: ctx.workspaceId,
		});
		return {
			editorUrl: `/editor/${id}`,
			fieldsCount: properties.length,
			id,
			slug,
			title,
		};
	});

	const updateFormFields = toolDefinition({
		description:
			"Replace a form's field list (add, remove, reorder, or edit fields) by giving the full new field list. Call get_form first to see the current fields and keep any you're not changing. A version snapshot is kept so the change can be undone from the editor's history.",
		inputSchema: updateFormFieldsInputSchema,
		name: "update_form_fields",
	}).server(async ({ fields, formId }) => {
		const { form: row } = await requireFormInWorkspace(ctx, formId, "edit");
		await snapshotFormVersion(ctx.db, row, ctx.userId);
		const properties = buildFields(fields);
		const previous = row.properties as { id: string }[];
		const keptIds = new Set(properties.map((p) => p.id));
		const removedNow = previous.filter((p) => !keptIds.has(p.id));
		await ctx.db
			.update(form)
			.set({
				properties,
				removedProperties: [
					...(row.removedProperties as { id: string }[]),
					...removedNow,
				],
			})
			.where(eq(form.id, formId));
		return { fieldsCount: properties.length, formId };
	});

	const getSubmissionStats = toolDefinition({
		description:
			"Get the same submission summary the Summary page shows for a form: views, completion rate, average completion time, and a per-question breakdown (choice counts, averages for rating/scale/number fields, recent answers for text fields). Optionally limit to the last N days.",
		inputSchema: getSubmissionStatsInputSchema,
		name: "get_submission_stats",
	}).server(async ({ days, formId }) => {
		const { form: row } = await requireFormInWorkspace(ctx, formId, "view");
		const from = days
			? new Date(Date.now() - (days - 1) * 86_400_000).toISOString()
			: undefined;
		const [overview, summary] = await Promise.all([
			buildFormOverview(ctx.db, formId),
			buildFormSummary(ctx.db, row, { from }),
		]);
		return { ...overview, ...summary };
	});

	const searchSubmissions = toolDefinition({
		description:
			"Search a form's recent submissions by free text. Returns at most 20 rows, each with answers trimmed to a readable length — use this to answer questions about what respondents said, not to export data.",
		inputSchema: searchSubmissionsInputSchema,
		name: "search_submissions",
	}).server(async ({ formId, limit, query }) => {
		const { form: row } = await requireFormInWorkspace(ctx, formId, "view");
		const where = submissionFilters({
			formId,
			search: query,
			status: "all",
		});
		const rows = await ctx.db
			.select()
			.from(formSubmission)
			.where(where)
			.orderBy(desc(formSubmission.createdAt))
			.limit(limit ?? 10);
		return rows.map((r) => {
			const dto = toSubmissionDto(row, r, ctx.services.config);
			return {
				...dto,
				data: Object.fromEntries(
					Object.entries(dto.data).map(([k, v]) => [k, truncateValue(v)])
				),
			};
		});
	});

	const explainFormLogic = toolDefinition({
		description:
			"Summarize a form's conditional logic in plain language: which fields are shown, hidden, required, or disabled depending on other answers.",
		inputSchema: explainFormLogicInputSchema,
		name: "explain_form_logic",
	}).server(async ({ formId }) => {
		const { form: row } = await requireFormInWorkspace(ctx, formId, "view");
		const properties = row.properties as FormField[];
		const rules = properties
			.filter((field) => field.logic?.conditions)
			.map((field) => ({
				actions: field.logic?.actions ?? [],
				fieldId: field.id,
				fieldName: field.name,
			}));
		return {
			hasLogic: rules.length > 0,
			rules,
		};
	});

	/* ---------------------------------------------------------------------- */
	/*                   Integrations & email notifications                   */
	/* ---------------------------------------------------------------------- */
	/**
	 * Every tool below delegates to the exact same functions behind the MCP
	 * server and CLI (services/agent/tools.ts) — one service layer, three
	 * front-ends. `requireFormInWorkspace` is called first so a formId the
	 * model supplies can't reach outside the chat's own pinned workspace;
	 * the delegated function then does its own permission + capability check
	 * (requireForm's "manage_integrations", same as the Integrations tab UI).
	 */

	const listIntegrationsTool = toolDefinition({
		description:
			"List a form's connected integrations (email, Slack, webhooks, automations…) and whether each is active. Never returns secrets or payload contents — for an email notification's full content, use list_email_notifications.",
		inputSchema: listIntegrationsToolInputSchema,
		name: "list_integrations",
	}).server(async ({ formId }) => {
		await requireFormInWorkspace(ctx, formId, "view");
		return listIntegrations(agentCtxOf(ctx), { formId });
	});

	const listIntegrationTypesTool = toolDefinition({
		description:
			"Every integration type this instance can configure (webhook, Slack, Discord, Telegram, n8n, Zapier, Make, Pabbly, Activepieces, Albato, email), with its data/settings field names, types and descriptions. Call this before create_integration so you know exactly what to send.",
		inputSchema: listIntegrationTypesToolInputSchema,
		name: "list_integration_types",
	}).server(() => integrationTypeCatalog());

	const createIntegrationTool = toolDefinition({
		description:
			"Create a new integration (webhook, Slack, Discord, Telegram, or an automation platform) on a form. Call list_integration_types first. URLs are checked against an SSRF guard. Confirm with the user before creating one, since it starts delivering live data on the next submission.",
		inputSchema: createIntegrationToolInputSchema,
		name: "create_integration",
	}).server(
		async ({ formId, data, integrationId, logic, settings, status }) => {
			await requireFormInWorkspace(ctx, formId, "edit");
			return createIntegration(agentCtxOf(ctx), {
				data: data ?? {},
				formId,
				integrationId: integrationId as never,
				logic,
				settings: settings ?? {},
				status: status ?? "active",
			});
		}
	);

	const updateIntegrationTool = toolDefinition({
		description:
			"Patch an existing integration. A given data/settings is merged into the saved values — send only the keys you're changing.",
		inputSchema: updateIntegrationToolInputSchema,
		name: "update_integration",
	}).server(async ({ formId, ...input }) => {
		await requireFormInWorkspace(ctx, formId, "edit");
		return updateIntegration(agentCtxOf(ctx), { formId, ...input });
	});

	const deleteIntegrationTool = toolDefinition({
		description:
			"Delete an integration from a form. This can't be undone — confirm with the user first.",
		inputSchema: deleteIntegrationToolInputSchema,
		name: "delete_integration",
	}).server(async ({ formId, id }) => {
		await requireFormInWorkspace(ctx, formId, "edit");
		return deleteIntegration(agentCtxOf(ctx), { formId, id });
	});

	const testIntegrationTool = toolDefinition({
		description:
			"Send one integration a realistic sample payload through its real handler, without needing a real submission on file. Pass an existing `id` to test its saved config, or `integrationId` + data/settings to test one that isn't saved yet.",
		inputSchema: testIntegrationToolInputSchema,
		name: "test_integration",
	}).server(async ({ formId, data, id, integrationId, settings }) => {
		await requireFormInWorkspace(ctx, formId, "edit");
		return testIntegration(agentCtxOf(ctx), {
			data,
			formId,
			id,
			integrationId: integrationId as never,
			settings,
		});
	});

	const listEmailNotificationsTool = toolDefinition({
		description:
			"List a form's email notifications, with full configuration (recipients, subject, body, sender, attachment, condition).",
		inputSchema: listEmailNotificationsToolInputSchema,
		name: "list_email_notifications",
	}).server(async ({ formId }) => {
		await requireFormInWorkspace(ctx, formId, "view");
		return listEmailNotifications(agentCtxOf(ctx), { formId });
	});

	const createEmailNotificationTool = toolDefinition({
		description:
			'Create a new email notification on a form — e.g. a confirmation email to the respondent. To send it to whatever address the respondent typed into an email field, set data.send_to to that field\'s mention placeholder: `<span mention="true" mention-field-id="FIELD_ID" mention-field-name="FIELD_NAME">FIELD_NAME</span>` (call get_form first to get the field id). Confirm with the user before creating one.',
		inputSchema: createEmailNotificationToolInputSchema,
		name: "create_email_notification",
	}).server(async ({ formId, data, logic, status }) => {
		await requireFormInWorkspace(ctx, formId, "edit");
		return createEmailNotification(agentCtxOf(ctx), {
			data: data ?? {},
			formId,
			logic,
			status: status ?? "active",
		});
	});

	const updateEmailNotificationTool = toolDefinition({
		description:
			"Patch an existing email notification. A given `data` is merged into the saved values — send only the keys you're changing.",
		inputSchema: updateEmailNotificationToolInputSchema,
		name: "update_email_notification",
	}).server(async ({ formId, ...input }) => {
		await requireFormInWorkspace(ctx, formId, "edit");
		return updateEmailNotification(agentCtxOf(ctx), { formId, ...input });
	});

	const deleteEmailNotificationTool = toolDefinition({
		description:
			"Delete an email notification from a form. This can't be undone — confirm with the user first.",
		inputSchema: deleteEmailNotificationToolInputSchema,
		name: "delete_email_notification",
	}).server(async ({ formId, id }) => {
		await requireFormInWorkspace(ctx, formId, "edit");
		return deleteEmailNotification(agentCtxOf(ctx), { formId, id });
	});

	const previewEmailNotificationTool = toolDefinition({
		description:
			"Render a draft (or saved) email notification against the form's latest submission (or sample data) — the same render the Notifications tab's live preview shows. Returns the subject, resolved from/reply-to, recipients, a plain-text excerpt, and the full HTML. Use this to show the user what an email will look like before creating/saving it.",
		inputSchema: previewEmailNotificationToolInputSchema,
		name: "preview_email_notification",
	}).server(async ({ formId, data }) => {
		await requireFormInWorkspace(ctx, formId, "view");
		return previewEmailNotification(agentCtxOf(ctx), { data, formId });
	});

	const sendTestEmailNotificationTool = toolDefinition({
		description:
			"Send a draft (or saved) email notification as a real test send, so it can be checked in an actual inbox. Defaults to the signed-in user's own email. Confirm with the user before sending, since it delivers a real email.",
		inputSchema: sendTestEmailNotificationToolInputSchema,
		name: "send_test_email_notification",
	}).server(async ({ formId, data, to }) => {
		await requireFormInWorkspace(ctx, formId, "edit");
		return sendTestEmailNotificationService(agentCtxOf(ctx), {
			data,
			formId,
			to,
		});
	});

	const listSendersTool = toolDefinition({
		description:
			"List the current workspace's configured \"From\" sender identities (Settings → Email sending) — pick a senderId from here for create_email_notification/update_email_notification's data.senderId.",
		inputSchema: listSendersToolInputSchema,
		name: "list_senders",
	}).server(async () => {
		await requireWorkspace(ctx.db, ctx.workspaceId, ctx.userId, "view");
		const [row] = await ctx.db
			.select({ settings: workspace.settings })
			.from(workspace)
			.where(eq(workspace.id, ctx.workspaceId))
			.limit(1);
		return listWorkspaceSenders(row?.settings ?? null);
	});

	return [
		listForms,
		getForm,
		createForm,
		updateFormFields,
		getSubmissionStats,
		searchSubmissions,
		explainFormLogic,
		listIntegrationsTool,
		listIntegrationTypesTool,
		createIntegrationTool,
		updateIntegrationTool,
		deleteIntegrationTool,
		testIntegrationTool,
		listEmailNotificationsTool,
		createEmailNotificationTool,
		updateEmailNotificationTool,
		deleteEmailNotificationTool,
		previewEmailNotificationTool,
		sendTestEmailNotificationTool,
		listSendersTool,
	];
}
