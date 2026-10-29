/**
 * The "one service layer" behind every agent surface: the MCP server
 * (apps/server's /api/mcp route) and the CLI (via the `instance.agent.*`
 * tRPC procedures in routers/instance.ts) both call these same functions.
 * Each one is scoped to the calling user's own permissions via
 * requireForm/requireWorkspace (packages/api/src/lib/access.ts) — an agent
 * can never read or change a workspace the user isn't a member of.
 *
 * Form-editing tools intentionally reuse the AI assistant's simplified field
 * spec (packages/api/src/services/ai/form-spec.ts) rather than the editor's
 * full `formUpdateSchema`: it's a much smaller, agent-friendly surface
 * (blockId + name + a few common options) that already has the right
 * defaults baked in via the block catalogue.
 */
import type { Database } from "@StryveForms/db";
import { user as userTable } from "@StryveForms/db/schema/auth";
import {
	form,
	formIntegration,
	formSubmission,
	formVersion,
	workspace,
	workspaceMember,
} from "@StryveForms/db/schema/forms";
import { defaultFormSettings, VISIBILITIES } from "@StryveForms/forms/settings";
import { type FormField, fieldOptions } from "@StryveForms/forms/types";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import type { Services } from "../../context";
import type { Capability } from "../../lib/access";
import { requireForm, requireWorkspace } from "../../lib/access";
import { shareUrl } from "../../lib/files";
import { formSlug, newId, slugify } from "../../lib/ids";
import { toFormColumns } from "../../lib/serialize";
import { signPath } from "../../lib/signing";
import {
	submissionFilters,
	submissionOrderBy,
} from "../../lib/submission-filters";
import { toSubmissionDto } from "../../routers/submission";
import { buildFields, formSpecSchema } from "../ai/form-spec";
import { INTEGRATION_CATALOG } from "../integrations/handlers";
import {
	cleanIntegrationData,
	createFormIntegration,
	deleteFormIntegration,
	getFormIntegrationRow,
	INTEGRATION_IDS,
	updateFormIntegration,
} from "../integrations/manage";
import { sendIntegrationTest } from "../integrations/test-send";
import {
	notificationDataSchema,
	previewEmailNotification as previewEmailNotificationService,
	sendTestEmailNotification as sendTestEmailNotificationService,
} from "../notifications";
import { listSenders as listWorkspaceSenders } from "../senders";
import { buildFormOverview, buildFormSummary } from "../stats";

export interface AgentContext {
	db: Database;
	services: Services;
	userId: string;
}

function requireFormForAgent(
	ctx: AgentContext,
	formId: string,
	permission: "view" | "edit" = "view",
	capability?: Capability
) {
	return requireForm(ctx.db, formId, ctx.userId, permission, capability);
}

/* -------------------------------------------------------------------------- */
/*                                 Workspaces                                 */
/* -------------------------------------------------------------------------- */

export async function listWorkspaces(ctx: AgentContext) {
	const rows = await ctx.db
		.select({
			icon: workspace.icon,
			id: workspace.id,
			name: workspace.name,
			role: workspaceMember.role,
		})
		.from(workspaceMember)
		.innerJoin(workspace, eq(workspace.id, workspaceMember.workspaceId))
		.where(eq(workspaceMember.userId, ctx.userId))
		.orderBy(workspace.name);
	return rows;
}

/* -------------------------------------------------------------------------- */
/*                                    Forms                                   */
/* -------------------------------------------------------------------------- */

export const listFormsInput = z.object({
	limit: z.number().int().min(1).max(100).default(20),
	query: z.string().max(200).optional(),
	workspaceId: z.string().min(1),
});

export async function listForms(
	ctx: AgentContext,
	input: z.infer<typeof listFormsInput>
) {
	await requireWorkspace(ctx.db, input.workspaceId, ctx.userId);
	const filters = [
		eq(form.workspaceId, input.workspaceId),
		isNull(form.deletedAt),
	];
	if (input.query) {
		filters.push(ilike(form.title, `%${input.query}%`));
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
		.limit(input.limit);
	return rows.map((r) => ({
		...r,
		shareUrl: shareUrl(ctx.services.config, r.slug),
		updatedAt: r.updatedAt.toISOString(),
	}));
}

export const getFormInput = z.object({ formId: z.string().min(1) });

export async function getForm(
	ctx: AgentContext,
	input: z.infer<typeof getFormInput>
) {
	const { form: row } = await requireFormForAgent(ctx, input.formId, "view");
	const properties = row.properties as FormField[];
	return {
		closesAt: row.closesAt?.toISOString() ?? null,
		fields: properties.map((field) => ({
			help: field.help ?? null,
			id: field.id,
			name: field.name,
			options: fieldOptions(field).map((o) => o.name),
			required: Boolean(field.required),
			type: field.type,
			width: field.width ?? "full",
		})),
		id: row.id,
		maxSubmissionsCount: row.maxSubmissionsCount,
		shareUrl: shareUrl(ctx.services.config, row.slug, row.customDomain),
		slug: row.slug,
		submitButtonText: row.submitButtonText,
		title: row.title,
		useCaptcha: row.useCaptcha,
		visibility: row.visibility,
		workspaceId: row.workspaceId,
	};
}

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

export const createFormInput = formSpecSchema.extend({
	workspaceId: z.string().min(1),
});

export async function createForm(
	ctx: AgentContext,
	input: z.infer<typeof createFormInput>
) {
	await requireWorkspace(ctx.db, input.workspaceId, ctx.userId, "edit");
	const properties = buildFields(input.fields);
	const settings = {
		...defaultFormSettings(),
		properties,
		title: input.title,
		// Agent-created forms always start as drafts — the agent (or the
		// human it's acting for) must explicitly publish via set_form_visibility.
		visibility: "draft" as const,
	};
	const id = newId();
	const slug = await uniqueFormSlug(ctx.db, input.title);
	await ctx.db.insert(form).values({
		...toFormColumns(settings),
		creatorId: ctx.userId,
		id,
		slug,
		title: input.title,
		workspaceId: input.workspaceId,
	});
	return {
		editorUrl: `${ctx.services.config.appUrl}/editor/${id}`,
		fieldsCount: properties.length,
		id,
		shareUrl: shareUrl(ctx.services.config, slug),
		slug,
		title: input.title,
	};
}

/** Keeps a before-edit snapshot, same as the editor's undo history. */
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

export const updateFormFieldsInput = z.object({
	fields: formSpecSchema.shape.fields,
	formId: z.string().min(1),
});

export async function updateFormFields(
	ctx: AgentContext,
	input: z.infer<typeof updateFormFieldsInput>
) {
	const { form: row } = await requireFormForAgent(ctx, input.formId, "edit");
	await snapshotFormVersion(ctx.db, row, ctx.userId);
	const properties = buildFields(input.fields);
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
		.where(eq(form.id, input.formId));
	return { fieldsCount: properties.length, formId: input.formId };
}

export const updateFormSettingsInput = z.object({
	closesAt: z.string().datetime().nullable().optional(),
	formId: z.string().min(1),
	maxSubmissionsCount: z.number().int().positive().nullable().optional(),
	redirectUrl: z.string().url().nullable().optional(),
	submitButtonText: z.string().max(200).nullable().optional(),
	title: z.string().min(1).max(255).optional(),
	useCaptcha: z.boolean().optional(),
});

/** A small, safe settings surface — not the full editor schema — so an agent can't corrupt design/brand fields it doesn't understand. */
export async function updateFormSettings(
	ctx: AgentContext,
	input: z.infer<typeof updateFormSettingsInput>
) {
	const { form: row } = await requireFormForAgent(ctx, input.formId, "edit");
	await snapshotFormVersion(ctx.db, row, ctx.userId);
	const { formId, closesAt, ...rest } = input;
	await ctx.db
		.update(form)
		.set({
			...rest,
			...(closesAt === undefined
				? {}
				: { closesAt: closesAt ? new Date(closesAt) : null }),
		})
		.where(eq(form.id, formId));
	return { formId };
}

export const setFormVisibilityInput = z.object({
	formId: z.string().min(1),
	visibility: z.enum(VISIBILITIES),
});

/** Publish ("public"), close, or revert to draft. */
export async function setFormVisibility(
	ctx: AgentContext,
	input: z.infer<typeof setFormVisibilityInput>
) {
	await requireFormForAgent(ctx, input.formId, "edit");
	await ctx.db
		.update(form)
		.set({ visibility: input.visibility })
		.where(eq(form.id, input.formId));
	return { formId: input.formId, visibility: input.visibility };
}

/* -------------------------------------------------------------------------- */
/*                                 Submissions                                */
/* -------------------------------------------------------------------------- */

export const listSubmissionsInput = z.object({
	formId: z.string().min(1),
	from: z.string().datetime().optional(),
	page: z.number().int().min(1).default(1),
	perPage: z.number().int().min(1).max(100).default(20),
	search: z.string().max(200).optional(),
	sortBy: z.string().max(255).default("createdAt"),
	sortDir: z.enum(["asc", "desc"]).default("desc"),
	status: z.enum(["all", "completed", "partial"]).default("all"),
	to: z.string().datetime().optional(),
});

export async function listSubmissions(
	ctx: AgentContext,
	input: z.infer<typeof listSubmissionsInput>
) {
	const { form: row } = await requireFormForAgent(ctx, input.formId, "view");
	const where = submissionFilters(input);
	const [rows, [total]] = await Promise.all([
		ctx.db
			.select()
			.from(formSubmission)
			.where(where)
			.orderBy(submissionOrderBy(input.sortBy, input.sortDir))
			.limit(input.perPage)
			.offset((input.page - 1) * input.perPage),
		ctx.db
			.select({ n: sql<number>`count(*)::int` })
			.from(formSubmission)
			.where(where),
	]);
	return {
		items: rows.map((r) => toSubmissionDto(row, r, ctx.services.config)),
		page: input.page,
		perPage: input.perPage,
		total: total?.n ?? 0,
	};
}

export const getSubmissionInput = z.object({
	formId: z.string().min(1),
	id: z.string().min(1),
});

export async function getSubmission(
	ctx: AgentContext,
	input: z.infer<typeof getSubmissionInput>
) {
	const { form: row } = await requireFormForAgent(ctx, input.formId, "view");
	const [submission] = await ctx.db
		.select()
		.from(formSubmission)
		.where(
			and(
				eq(formSubmission.formId, input.formId),
				eq(formSubmission.id, input.id)
			)
		);
	if (!submission) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
	}
	return toSubmissionDto(row, submission, ctx.services.config);
}

export const getSubmissionStatsInput = z.object({
	days: z
		.number()
		.int()
		.min(1)
		.max(365)
		.optional()
		.describe(
			"Only count submissions from the last N days. Omit for all time."
		),
	formId: z.string().min(1),
});

export async function getSubmissionStats(
	ctx: AgentContext,
	input: z.infer<typeof getSubmissionStatsInput>
) {
	const { form: row } = await requireFormForAgent(ctx, input.formId, "view");
	const from = input.days
		? new Date(Date.now() - (input.days - 1) * 86_400_000).toISOString()
		: undefined;
	const [overview, summary] = await Promise.all([
		buildFormOverview(ctx.db, input.formId),
		buildFormSummary(ctx.db, row, { from }),
	]);
	return { ...overview, ...summary };
}

export const exportSubmissionsCsvLinkInput = z.object({
	formId: z.string().min(1),
	from: z.string().datetime().optional(),
	search: z.string().max(200).optional(),
	status: z.enum(["all", "completed", "partial"]).default("all"),
	to: z.string().datetime().optional(),
});

const EXPORT_LINK_TTL_SECONDS = 10 * 60;

/**
 * A short-lived signed link to a CSV export — no session/token needed to
 * fetch it, same pattern as a respondent's uploaded-file link
 * (lib/files.ts). Lets an agent hand the URL to whatever actually needs the
 * file (itself, a chat attachment, a human) without round-tripping bytes
 * through the tool-call response.
 */
export async function exportSubmissionsCsvLink(
	ctx: AgentContext,
	input: z.infer<typeof exportSubmissionsCsvLinkInput>
) {
	await requireFormForAgent(ctx, input.formId, "view");
	const params = new URLSearchParams();
	params.set("status", input.status);
	if (input.search) {
		params.set("search", input.search);
	}
	if (input.from) {
		params.set("from", input.from);
	}
	if (input.to) {
		params.set("to", input.to);
	}
	const path = `/api/forms/${input.formId}/export-signed.csv`;
	const signed = signPath(
		ctx.services.config.signingSecret,
		path,
		EXPORT_LINK_TTL_SECONDS
	);
	return {
		expiresInSeconds: EXPORT_LINK_TTL_SECONDS,
		url: `${ctx.services.config.serverUrl}${signed}&${params.toString()}`,
	};
}

/* -------------------------------------------------------------------------- */
/*                                 Integrations                                */
/* -------------------------------------------------------------------------- */

export const listIntegrationsInput = z.object({ formId: z.string().min(1) });

const CATALOG_NAMES = new Map<string, string>(
	INTEGRATION_CATALOG.map((i) => [i.id, i.name])
);

/** Read-only: which integrations a form has, and whether each is active — never secrets/payloads. */
export async function listIntegrations(
	ctx: AgentContext,
	input: z.infer<typeof listIntegrationsInput>
) {
	await requireFormForAgent(ctx, input.formId, "view");
	const rows = await ctx.db
		.select({
			createdAt: formIntegration.createdAt,
			id: formIntegration.id,
			integrationId: formIntegration.integrationId,
			status: formIntegration.status,
		})
		.from(formIntegration)
		.where(
			and(
				eq(formIntegration.formId, input.formId),
				isNull(formIntegration.deletedAt)
			)
		)
		.orderBy(desc(formIntegration.createdAt));
	return rows.map((r) => ({
		...r,
		name: CATALOG_NAMES.get(r.integrationId) ?? r.integrationId,
	}));
}

export const listIntegrationTypesInput = z.object({});

interface IntegrationFieldDoc {
	description: string;
	key: string;
	type: string;
}

interface IntegrationTypeDoc {
	dataFields: IntegrationFieldDoc[];
	id: string;
	name: string;
	section: string;
	settingsFields: IntegrationFieldDoc[];
}

/** Security/Payload/Advanced settings shared by the seven "plain JSON POST" integrations. */
const WEBHOOK_LIKE_SETTINGS: IntegrationFieldDoc[] = [
	{
		description:
			'How the receiver authenticates the request: "none", "bearer" (needs auth_token), "basic" (needs auth_username/auth_password), or "api_key" (needs auth_header_name/auth_header_value).',
		key: "auth_type",
		type: '"none" | "bearer" | "basic" | "api_key"',
	},
	{
		description: 'Bearer token, when auth_type is "bearer".',
		key: "auth_token",
		type: "string",
	},
	{
		description: 'Username, when auth_type is "basic".',
		key: "auth_username",
		type: "string",
	},
	{
		description: 'Password, when auth_type is "basic".',
		key: "auth_password",
		type: "string",
	},
	{
		description:
			'Custom header name, when auth_type is "api_key" (e.g. "X-API-Key").',
		key: "auth_header_name",
		type: "string",
	},
	{
		description: 'Custom header value, when auth_type is "api_key".',
		key: "auth_header_value",
		type: "string",
	},
	{
		description:
			"Header name the HMAC signature (from data.webhook_secret) is sent in.",
		key: "hmac_header_name",
		type: "string",
	},
	{
		description: "HMAC algorithm.",
		key: "hmac_algorithm",
		type: '"sha1" | "sha256"',
	},
	{
		description:
			"Add an X-Webhook-Timestamp header and fold the timestamp into the signed payload.",
		key: "hmac_include_timestamp",
		type: "boolean",
	},
	{
		description:
			'Request body shape: "classic" (OpnForm-compatible, default for plain webhook), "nested" ({ data: { id: { name, type, value } } }, default for the others), or "flat" ({ data: { id: value } }, easiest for no-code tools).',
		key: "payload_style",
		type: '"classic" | "nested" | "flat"',
	},
	{
		description:
			"Include metadata (UTM/referrer attribution) in the body when available. Defaults to true.",
		key: "include_metadata",
		type: "boolean",
	},
	{
		description: "Request timeout, 1-60. Defaults to 10.",
		key: "timeout_seconds",
		type: "number",
	},
	{
		description: "Retry once after a short delay if the first attempt fails.",
		key: "retry_on_failure",
		type: "boolean",
	},
];

const WEBHOOK_LIKE_DATA = (
	urlKey: string,
	urlDescription: string
): IntegrationFieldDoc[] => [
	{ description: urlDescription, key: urlKey, type: "string (required)" },
	{
		description:
			"Signing secret. When set, requests carry an HMAC signature header (see settings.hmac_*).",
		key: "webhook_secret",
		type: "string (optional)",
	},
	{
		description:
			'Extra request headers, one per line as "Name: value". A few header names (Authorization, Content-Type, Host, Cookie…) are always stripped.',
		key: "webhook_headers",
		type: "string (optional)",
	},
];

const CHAT_LINK_FIELDS: IntegrationFieldDoc[] = [
	{
		description:
			"Include the submission's answers in the message. Defaults to true.",
		key: "include_submission_data",
		type: "boolean",
	},
	{
		description: "Include a link to open the public form. Defaults to true.",
		key: "link_open_form",
		type: "boolean",
	},
	{
		description:
			"Include a link to the form's dashboard/submissions page. Defaults to true.",
		key: "link_edit_form",
		type: "boolean",
	},
	{
		description:
			"Include a link to edit this submission (only if the form allows editable submissions). Defaults to true.",
		key: "link_edit_submission",
		type: "boolean",
	},
];

/**
 * Per-type `data`/`settings` field docs, so an agent calling `create_integration`
 * or `update_integration` knows exactly what to send without guessing. Mirrors
 * the web UI's dialog fields (apps/web/src/components/app/integrations/*).
 */
export function integrationTypeCatalog(): IntegrationTypeDoc[] {
	const webhookLike = (id: string, name: string): IntegrationTypeDoc => ({
		dataFields: WEBHOOK_LIKE_DATA(
			"webhook_url",
			"The URL this form POSTs a JSON payload to on every submission."
		),
		id,
		name,
		section: "Automation",
		settingsFields: WEBHOOK_LIKE_SETTINGS,
	});
	return [
		{
			dataFields: [
				{
					description:
						"Recipient email address(es) — one per line, or comma-separated. Supports @-mention placeholders for a form field's answer.",
					key: "send_to",
					type: "string (required)",
				},
				{
					description:
						"Display name shown as the sender. Falls back to the workspace sender/app name.",
					key: "sender_name",
					type: "string (optional)",
				},
				{
					description:
						"Reply-to address. Falls back to the resolved sender's reply-to.",
					key: "reply_to",
					type: "string (optional)",
				},
				{
					description:
						'Email subject. Supports @-mentions. Defaults to "New submission: <form title>".',
					key: "subject",
					type: "string (optional)",
				},
				{
					description:
						'HTML email body. Supports @-mention placeholders like <span mention="true" mention-field-id="...">Name</span> — copy these through exactly, never alter them.',
					key: "email_content",
					type: "string (HTML, optional)",
				},
				{
					description:
						"Include a table of the submission's answers below the body. Defaults to true.",
					key: "include_submission_data",
					type: "boolean",
				},
				{
					description:
						"Also include hidden fields in that table. Defaults to false.",
					key: "include_hidden_fields_submission_data",
					type: "boolean",
				},
				{
					description:
						"Include a link to edit this submission (only if the form allows editable submissions).",
					key: "link_edit_submission",
					type: "boolean",
				},
				{
					description:
						"Attach a PDF rendered from this template id, if the form has one.",
					key: "attach_pdf_template_id",
					type: "string (optional)",
				},
				{
					description:
						"Pick one of the workspace's configured senders (Settings → Email sending) by id. Omit to use the workspace default.",
					key: "senderId",
					type: "string | null (optional)",
				},
			],
			id: "email",
			name: "Email notification",
			section: "Notifications",
			settingsFields: [],
		},
		{
			dataFields: [
				{
					description:
						'Incoming webhook URL from Slack. Must start with "https://hooks.slack.com/".',
					key: "slack_webhook_url",
					type: "string (required)",
				},
				{
					description:
						'Message text. Supports @-mention placeholders. Defaults to "New form submission".',
					key: "message",
					type: "string (optional)",
				},
				...CHAT_LINK_FIELDS,
			],
			id: "slack",
			name: "Slack",
			section: "Notifications",
			settingsFields: [
				{
					description:
						'"blocks" (rich Block Kit sections) or "simple" (plain text). Defaults to "blocks".',
					key: "format",
					type: '"blocks" | "simple"',
				},
			],
		},
		{
			dataFields: [
				{
					description:
						'Webhook URL from a Discord channel. Must start with "https://discord.com/api/webhooks".',
					key: "discord_webhook_url",
					type: "string (required)",
				},
				{
					description: "Message text. Supports @-mention placeholders.",
					key: "message",
					type: "string (optional)",
				},
				...CHAT_LINK_FIELDS,
			],
			id: "discord",
			name: "Discord",
			section: "Notifications",
			settingsFields: [
				{
					description:
						'"embed" (rich) or "simple" (plain text). Defaults to "embed".',
					key: "format",
					type: '"embed" | "simple"',
				},
				{
					description:
						"Override the bot's display name. Defaults to this app's name.",
					key: "username",
					type: "string (optional)",
				},
				{
					description: "Override the bot's avatar image URL.",
					key: "avatar_url",
					type: "string (optional)",
				},
				{
					description:
						"Post into a specific thread id instead of the channel's default location.",
					key: "thread_id",
					type: "string (optional)",
				},
			],
		},
		{
			dataFields: [
				{
					description: "Telegram chat id to send to.",
					key: "chat_id",
					type: "string (required)",
				},
				{
					description: "Message text. Supports @-mention placeholders.",
					key: "message",
					type: "string (optional)",
				},
			],
			id: "telegram",
			name: "Telegram",
			section: "Notifications",
			settingsFields: [
				{
					description:
						'Text formatting: "MarkdownV2", "HTML", or "None". Defaults to "MarkdownV2".',
					key: "parse_mode",
					type: '"MarkdownV2" | "HTML" | "None"',
				},
				{
					description: "Deliver without a notification sound.",
					key: "silent",
					type: "boolean",
				},
			],
		},
		{
			dataFields: WEBHOOK_LIKE_DATA(
				"webhook_url",
				"The URL this form POSTs a JSON payload to on every submission."
			),
			id: "webhook",
			name: "Webhook",
			section: "Automation",
			settingsFields: WEBHOOK_LIKE_SETTINGS,
		},
		webhookLike("n8n", "n8n"),
		webhookLike("zapier", "Zapier"),
		webhookLike("make", "Make"),
		webhookLike("pabbly", "Pabbly Connect"),
		webhookLike("activepieces", "Activepieces"),
		webhookLike("albato", "Albato"),
	];
}

/**
 * Read-only: every integration type this instance can configure, with its
 * `data`/`settings` field names, types and descriptions — call this before
 * `create_integration` so you know exactly what to send. For the "email"
 * type specifically, prefer the dedicated `create_email_notification` /
 * `update_email_notification` / `preview_email_notification` tools below —
 * same underlying record, but with preview/test-to-self built in.
 */
// biome-ignore lint/suspicious/useAwait: kept async so it matches every other agent tool's Promise-returning signature, for the MCP server's generic registerRead/registerWrite wrappers.
export async function listIntegrationTypes(_ctx: AgentContext) {
	return integrationTypeCatalog();
}

export const createIntegrationInput = z.object({
	data: z.record(z.string(), z.unknown()).default({}),
	formId: z.string().min(1),
	integrationId: z.enum(INTEGRATION_IDS),
	logic: z.record(z.string(), z.unknown()).nullable().optional(),
	settings: z.record(z.string(), z.unknown()).default({}),
	status: z.enum(["active", "inactive"]).default("active"),
});

/** Create a new integration (webhook, Slack, Discord, Telegram, or an automation platform). Call `list_integration_types` first to see what `data`/`settings` each type expects. URLs are checked against the SSRF guard — a URL on a private network is rejected. */
export function createIntegration(
	ctx: AgentContext,
	input: z.infer<typeof createIntegrationInput>
) {
	return createFormIntegration(ctx.db, input.formId, ctx.userId, input);
}

export const updateIntegrationInput = z.object({
	data: z.record(z.string(), z.unknown()).optional(),
	formId: z.string().min(1),
	id: z.string().min(1),
	logic: z.record(z.string(), z.unknown()).nullable().optional(),
	settings: z.record(z.string(), z.unknown()).optional(),
	status: z.enum(["active", "inactive"]).optional(),
});

/** Patch an existing integration. Unlike the web UI's dialog (which always resaves the whole `data`/`settings` object), a given `data`/`settings` here is *merged* into the existing saved values — so you only need to send the keys you're changing. Omit a field entirely to leave it untouched. */
export async function updateIntegration(
	ctx: AgentContext,
	input: z.infer<typeof updateIntegrationInput>
) {
	const { formId, id, data, settings, ...rest } = input;
	const existing = await getFormIntegrationRow(ctx.db, formId, id, ctx.userId);
	return updateFormIntegration(ctx.db, formId, id, ctx.userId, {
		...rest,
		...(data
			? { data: { ...(existing.data as Record<string, unknown>), ...data } }
			: {}),
		...(settings
			? {
					settings: {
						...(existing.settings as Record<string, unknown>),
						...settings,
					},
				}
			: {}),
	});
}

export const deleteIntegrationInput = z.object({
	formId: z.string().min(1),
	id: z.string().min(1),
});

/** Delete (soft-delete) an integration. */
export function deleteIntegration(
	ctx: AgentContext,
	input: z.infer<typeof deleteIntegrationInput>
) {
	return deleteFormIntegration(ctx.db, input.formId, input.id, ctx.userId);
}

export const testIntegrationInput = z.object({
	data: z
		.record(z.string(), z.unknown())
		.optional()
		.describe(
			"Overrides merged on top of the saved integration's data, when `id` is given."
		),
	formId: z.string().min(1),
	id: z
		.string()
		.min(1)
		.optional()
		.describe("An existing integration's id, to test with its saved config."),
	integrationId: z
		.enum(INTEGRATION_IDS)
		.optional()
		.describe("Required when `id` is omitted."),
	settings: z.record(z.string(), z.unknown()).optional(),
});

/** Sends one integration a realistic sample payload (built from the form's fields) through its real handler — including the SSRF guard — without needing a real submission on file. Pass an existing `id` to test with its saved config (optionally overridden), or `integrationId` + `data`/`settings` to test one that isn't saved yet. Returns whether it succeeded, the HTTP status, and (truncated) response body. */
export async function testIntegration(
	ctx: AgentContext,
	input: z.infer<typeof testIntegrationInput>
) {
	const { form: formRow } = await requireFormForAgent(
		ctx,
		input.formId,
		"edit",
		"manage_integrations"
	);
	let { integrationId, data = {}, settings = {} } = input;
	if (input.id) {
		const existing = await getFormIntegrationRow(
			ctx.db,
			input.formId,
			input.id,
			ctx.userId
		);
		integrationId ??= existing.integrationId;
		data = { ...(existing.data as Record<string, unknown>), ...data };
		settings = {
			...(existing.settings as Record<string, unknown>),
			...settings,
		};
	}
	if (!integrationId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"Provide `integrationId`, or `id` of an existing integration to test.",
		});
	}
	const clean = await cleanIntegrationData(data);
	return sendIntegrationTest(
		ctx.db,
		ctx.services,
		formRow,
		integrationId,
		clean,
		settings
	);
}

/* -------------------------------------------------------------------------- */
/*                             Email notifications                            */
/* -------------------------------------------------------------------------- */
/**
 * An email notification is a `formIntegration` row with `integrationId:
 * "email"` — these tools are a typed, convenience layer over the generic
 * integration tools above, sharing the same `cleanIntegrationData`/SSRF
 * checks and the same `composeEmail`/preview logic the web UI's
 * "Notifications" tab uses (packages/api/src/services/notifications.ts).
 */

export const listEmailNotificationsInput = z.object({
	formId: z.string().min(1),
});

/** List a form's email notifications, with their full configuration (recipients, subject, body, sender, attachment, condition) — unlike `list_integrations`, which never returns `data` for any type. */
export async function listEmailNotifications(
	ctx: AgentContext,
	input: z.infer<typeof listEmailNotificationsInput>
) {
	await requireFormForAgent(ctx, input.formId, "view");
	const rows = await ctx.db
		.select()
		.from(formIntegration)
		.where(
			and(
				eq(formIntegration.formId, input.formId),
				eq(formIntegration.integrationId, "email"),
				isNull(formIntegration.deletedAt)
			)
		)
		.orderBy(desc(formIntegration.createdAt));
	return rows.map((row) => ({
		createdAt: row.createdAt.toISOString(),
		data: row.data,
		id: row.id,
		logic: row.logic,
		settings: row.settings,
		status: row.status,
	}));
}

export const createEmailNotificationInput = z.object({
	data: notificationDataSchema.default({}),
	formId: z.string().min(1),
	logic: z.record(z.string(), z.unknown()).nullable().optional(),
	status: z.enum(["active", "inactive"]).default("active"),
});

/** Create a new email notification. See `list_integration_types`'s "email" entry for `data` fields (send_to, subject, email_content, sender_name, reply_to, senderId, attach_pdf_template_id, include_submission_data…). */
export function createEmailNotification(
	ctx: AgentContext,
	input: z.infer<typeof createEmailNotificationInput>
) {
	return createFormIntegration(ctx.db, input.formId, ctx.userId, {
		data: input.data as Record<string, unknown>,
		integrationId: "email",
		logic: input.logic ?? null,
		status: input.status,
	});
}

export const updateEmailNotificationInput = z.object({
	data: notificationDataSchema.optional(),
	formId: z.string().min(1),
	id: z.string().min(1),
	logic: z.record(z.string(), z.unknown()).nullable().optional(),
	status: z.enum(["active", "inactive"]).optional(),
});

/** Patch an existing email notification. A given `data` is merged into the saved values — send only the keys you're changing. */
export async function updateEmailNotification(
	ctx: AgentContext,
	input: z.infer<typeof updateEmailNotificationInput>
) {
	const { formId, id, data, ...rest } = input;
	if (data) {
		const existing = await getFormIntegrationRow(
			ctx.db,
			formId,
			id,
			ctx.userId
		);
		if (existing.integrationId !== "email") {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "That integration isn't an email notification.",
			});
		}
		return updateFormIntegration(ctx.db, formId, id, ctx.userId, {
			...rest,
			data: { ...(existing.data as Record<string, unknown>), ...data },
		});
	}
	return updateFormIntegration(ctx.db, formId, id, ctx.userId, rest);
}

export const deleteEmailNotificationInput = z.object({
	formId: z.string().min(1),
	id: z.string().min(1),
});

/** Delete (soft-delete) an email notification. */
export function deleteEmailNotification(
	ctx: AgentContext,
	input: z.infer<typeof deleteEmailNotificationInput>
) {
	return deleteFormIntegration(ctx.db, input.formId, input.id, ctx.userId);
}

export const previewEmailNotificationInput = z.object({
	colorScheme: z.enum(["light", "dark"]).optional(),
	data: notificationDataSchema,
	formId: z.string().min(1),
});

/** Render a draft (or saved) email notification against the form's latest submission (or sample data, if it has none yet) — the same render the web UI's live preview shows. Returns the subject, resolved from/reply-to, recipients, a plain-text excerpt ("preheader"), and the full rendered HTML. */
export async function previewEmailNotification(
	ctx: AgentContext,
	input: z.infer<typeof previewEmailNotificationInput>
) {
	const { form: formRow } = await requireFormForAgent(
		ctx,
		input.formId,
		"view"
	);
	return previewEmailNotificationService(
		ctx.db,
		ctx.services,
		formRow,
		input.data,
		input.colorScheme
	);
}

export const sendTestEmailNotificationInput = z.object({
	data: notificationDataSchema,
	formId: z.string().min(1),
	to: z
		.string()
		.email()
		.optional()
		.describe("Defaults to the authenticated user's own email address."),
});

/** Send a draft (or saved) email notification as a real test send, so it can be checked in an actual inbox. Defaults to the calling user's own email, same as the web UI's "Send test" button; pass `to` to send it elsewhere. */
export async function sendTestEmailNotificationTool(
	ctx: AgentContext,
	input: z.infer<typeof sendTestEmailNotificationInput>
) {
	const { form: formRow } = await requireFormForAgent(
		ctx,
		input.formId,
		"edit",
		"manage_integrations"
	);
	const to = input.to ?? (await requireUserEmail(ctx));
	return sendTestEmailNotificationService(
		ctx.db,
		ctx.services,
		formRow,
		input.data,
		to
	);
}

async function requireUserEmail(ctx: AgentContext): Promise<string> {
	const [row] = await ctx.db
		.select({ email: userTable.email })
		.from(userTable)
		.where(eq(userTable.id, ctx.userId))
		.limit(1);
	if (!row?.email) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"Couldn't resolve your account's email address. Pass `to` explicitly.",
		});
	}
	return row.email;
}

/* -------------------------------------------------------------------------- */
/*                                   Senders                                   */
/* -------------------------------------------------------------------------- */

export const listSendersInput = z.object({ workspaceId: z.string().min(1) });

/** List a workspace's configured "From" sender identities (Settings → Email sending) — pick a `senderId` from here for `create_email_notification`/`update_email_notification`'s `data.senderId`. */
export async function listSenders(
	ctx: AgentContext,
	input: z.infer<typeof listSendersInput>
) {
	await requireWorkspace(ctx.db, input.workspaceId, ctx.userId, "view");
	const [row] = await ctx.db
		.select({ settings: workspace.settings })
		.from(workspace)
		.where(eq(workspace.id, input.workspaceId))
		.limit(1);
	return listWorkspaceSenders(row?.settings ?? null);
}
