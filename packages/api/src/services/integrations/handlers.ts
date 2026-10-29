import type { Database } from "@StryveForms/db";
import { pdfTemplate } from "@StryveForms/db/schema/features";
import type { EmailBranding } from "@StryveForms/emails/components/layout";
import type { Mailer, SendEmailInput } from "@StryveForms/emails/mailer";

import { emails } from "@StryveForms/emails/messages";
import { evaluateComputedVariables } from "@StryveForms/forms/computed";
import { resolveMentions } from "@StryveForms/forms/mentions";
import type { ComputedVariable } from "@StryveForms/forms/types";
import { displayValueToText } from "@StryveForms/forms/values";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";

import type { AppConfig } from "../../context";
import { shareUrl } from "../../lib/files";
import type { FormRow } from "../../lib/serialize";
import { renderTemplatePdfForSubmission } from "../pdf/generate";
import { sanitizeRichText } from "../sanitize";
import { resolveSender } from "../senders";
import type { StorageDriver } from "../storage";
import {
	editSubmissionUrl,
	type FormattedField,
	formatSubmissionFields,
	mentionValues,
	type SubmissionRow,
	webhookPayload,
} from "./payload";
import {
	parseDiscordSettings,
	parseSlackSettings,
	parseTelegramSettings,
	parseWebhookLikeSettings,
	type WebhookLikeSettings,
} from "./settings";
import { assertPublicUrl } from "./ssrf";

export interface IntegrationRun {
	/** Branding of this installation (name, logo, colour). */
	branding?: EmailBranding;
	config: AppConfig;
	data: Record<string, unknown>;
	/** Needed only to look up a PDF template for the "attach PDF" email option. */
	db?: Database;
	form: FormRow;
	/** e.g. "webhook", "n8n", "slack"… — which catalogue entry this is. Only
	 * read by the webhook-like/slack/discord/telegram handlers. */
	integrationId?: string;
	mailer: Mailer;
	/** From address for this workspace (custom SMTP sender), if any. */
	senderAddress?: string | undefined;
	/** The integration's "Security"/"Payload"/"Advanced" settings jsonb. */
	settings?: Record<string, unknown>;
	/** Needed only to render a PDF template's uploaded base file/zone images. */
	storage?: StorageDriver;
	submission: SubmissionRow;
	/** Marks a "Send test" run, so senders can flag the payload/message as a test. */
	test?: boolean;
	/** The owning workspace's settings jsonb, for `resolveSender` (new sender picker). */
	workspaceSettings?: Record<string, unknown> | null;
}

export type IntegrationHandler = (
	run: IntegrationRun
) => Promise<Record<string, unknown> | undefined>;

const WEBHOOK_TIMEOUT_MS = 10_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMAGE_FILE = /\.(png|jpe?g|gif|webp)$/i;
const RECIPIENT_SPLIT = /[\n,;]+/;
const BLOCKED_HEADERS = new Set([
	"authorization",
	"x-webhook-signature",
	"content-type",
	"content-length",
	"host",
	"cookie",
	"x-forwarded-for",
	"x-forwarded-proto",
	"x-real-ip",
	"transfer-encoding",
]);

const str = (value: unknown, fallback = "") =>
	typeof value === "string" ? value : fallback;
const bool = (value: unknown, fallback = false) =>
	typeof value === "boolean" ? value : fallback;

function mentionContext(
	run: Pick<IntegrationRun, "form" | "submission">,
	fields: FormattedField[]
) {
	const values = mentionValues(fields);
	const computed = evaluateComputedVariables(
		run.form.computedVariables as ComputedVariable[],
		run.submission.data
	);
	return { computed, values };
}

async function postJson(
	url: string,
	body: unknown,
	headers: Record<string, string> = {},
	timeoutMs = WEBHOOK_TIMEOUT_MS
) {
	const target = await assertPublicUrl(url);
	const json = JSON.stringify(body);
	const response = await fetch(target, {
		body: json,
		headers: { "Content-Type": "application/json", ...headers },
		method: "POST",
		redirect: "manual",
		signal: AbortSignal.timeout(timeoutMs),
	});
	const text = await response.text().catch(() => "");
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
	}
	return { response: text.slice(0, 1000), status: response.status };
}

/**
 * Builds the headers a "webhook-like" sender (webhook, n8n, Zapier, Make,
 * Pabbly, Activepieces, Albato) adds for its configured auth type. HMAC
 * signing (based on the legacy `webhook_secret` field, kept for existing
 * integrations) is handled separately, since it needs the request body.
 */
function authHeaders(settings: WebhookLikeSettings): Record<string, string> {
	switch (settings.authType) {
		case "bearer":
			return settings.authToken
				? { Authorization: `Bearer ${settings.authToken}` }
				: {};
		case "basic":
			return settings.authUsername || settings.authPassword
				? {
						Authorization: `Basic ${Buffer.from(
							`${settings.authUsername}:${settings.authPassword}`
						).toString("base64")}`,
					}
				: {};
		case "api_key":
			return settings.authHeaderName && settings.authHeaderValue
				? { [settings.authHeaderName]: settings.authHeaderValue }
				: {};
		default:
			return {};
	}
}

function hmacHeaders(
	settings: WebhookLikeSettings,
	secret: string,
	body: unknown
): Record<string, string> {
	if (!secret) {
		return {};
	}
	const timestamp = Math.floor(Date.now() / 1000);
	const signedPayload = settings.hmacIncludeTimestamp
		? `${timestamp}.${JSON.stringify(body)}`
		: JSON.stringify(body);
	const signature = createHmac(settings.hmacAlgorithm, secret)
		.update(signedPayload)
		.digest("hex");
	const headerName = settings.hmacHeaderName || "X-Webhook-Signature";
	const headers: Record<string, string> = {
		[headerName]: `${settings.hmacAlgorithm}=${signature}`,
	};
	if (settings.hmacIncludeTimestamp) {
		headers["X-Webhook-Timestamp"] = String(timestamp);
	}
	return headers;
}

/* --------------------------------- Email --------------------------------- */

/** Renders the configured PDF template for this submission, to attach to the email. Silent no-op if unset/unavailable. */
export async function pdfAttachment(
	run: IntegrationRun
): Promise<SendEmailInput["attachments"]> {
	const templateId = str(run.data.attach_pdf_template_id);
	if (!(templateId && run.db && run.storage)) {
		return;
	}
	const [template] = await run.db
		.select()
		.from(pdfTemplate)
		.where(eq(pdfTemplate.id, templateId));
	if (!(template && template.formId === run.form.id)) {
		return;
	}
	const { bytes, filename } = await renderTemplatePdfForSubmission(
		{ config: run.config, mailer: run.mailer, storage: run.storage },
		template,
		run.form,
		run.submission
	);
	return [
		{ content: Buffer.from(bytes), contentType: "application/pdf", filename },
	];
}

export interface ComposedEmail {
	fromAddress?: string;
	react: ReturnType<typeof emails.submissionNotification>;
	recipients: string[];
	replyTo?: string;
	senderName: string;
	subject: string;
}

type ComposeEmailInput = Pick<
	IntegrationRun,
	| "branding"
	| "config"
	| "data"
	| "form"
	| "senderAddress"
	| "submission"
	| "workspaceSettings"
>;

/**
 * Builds the subject, sender/reply-to, recipients and rendered body for the
 * email integration. Shared by the real send below and the notifications
 * tab's live preview / "send test" (routers/writer.ts), so both always agree
 * on what an email will look like.
 */
export function composeEmail(run: ComposeEmailInput): ComposedEmail {
	const { config, data, form, submission } = run;
	const fields = formatSubmissionFields(form, submission, config, {
		includeHidden: bool(data.include_hidden_fields_submission_data),
		keepHtml: true,
	});
	const { computed, values } = mentionContext(run, fields);
	const text = (template: unknown) =>
		resolveMentions(str(template), values, { computed, mode: "text" });

	const recipients = text(data.send_to)
		.split(RECIPIENT_SPLIT)
		.map((r) => r.trim())
		.filter((r) => EMAIL_PATTERN.test(r));
	// `senderId` picks one of the workspace's sender addresses (settings ->
	// sender-select); free-text name/reply-to on the notification itself are
	// explicit overrides and win over whatever that pick resolves to.
	const resolvedSender = resolveSender(
		run.workspaceSettings ?? null,
		str(data.senderId) || null
	);
	const replyToCandidate = text(data.reply_to) || resolvedSender?.replyTo || "";
	const replyTo = EMAIL_PATTERN.test(replyToCandidate)
		? replyToCandidate
		: undefined;
	const senderEmail = str(data.sender_email);
	const senderName =
		text(data.sender_name) ||
		resolvedSender?.name ||
		run.branding?.appName ||
		config.appName;
	const fromAddress =
		run.senderAddress ??
		resolvedSender?.address ??
		(EMAIL_PATTERN.test(senderEmail) ? senderEmail : undefined);
	const editUrl =
		bool(data.link_edit_submission) && form.editableSubmissions
			? editSubmissionUrl(form, submission, config)
			: null;
	const html = sanitizeRichText(
		resolveMentions(
			str(data.email_content, "<p>New form submission</p>"),
			values,
			{ computed }
		)
	);

	const react = emails.submissionNotification({
		branding: {
			...run.branding,
			accentColor: form.color,
			appName: run.branding?.appName ?? config.appName,
			appUrl: config.appUrl,
			logoUrl: str(data.logo_url) || run.branding?.logoUrl || null,
			showPoweredBy: !form.noBranding,
		},
		editButtonText: form.editableSubmissionsButtonText,
		editUrl,
		emailContentHtml: html,
		fields: fields.map((f) => ({
			files: Array.isArray(f.display)
				? f.display.flatMap((d) =>
						typeof d === "string"
							? []
							: [
									{
										isImage: IMAGE_FILE.test(d.name),
										label: d.name,
										url: d.url,
									},
								]
					)
				: undefined,
			name: f.name,
			value:
				Array.isArray(f.display) && f.display.some((d) => typeof d !== "string")
					? null
					: (f.display as string | string[] | null),
			valueIsHtml: f.type === "rich_text",
		})),
		includeSubmissionData: bool(data.include_submission_data, true),
		preview: text(data.subject) || "New form submission",
	});
	const subject = text(data.subject) || `New submission: ${form.title}`;
	return { fromAddress, react, recipients, replyTo, senderName, subject };
}

export const emailHandler: IntegrationHandler = async (run) => {
	const composed = composeEmail(run);
	if (composed.recipients.length === 0) {
		throw new Error("No valid recipient email address");
	}
	const attachments = await pdfAttachment(run).catch(
		(error: unknown): undefined => {
			console.error("[pdf] attach to email failed", error);
		}
	);
	await Promise.all(
		composed.recipients.map((to) =>
			run.mailer.send({
				attachments,
				from: composed.fromAddress
					? `${composed.senderName} <${composed.fromAddress}>`
					: undefined,
				react: composed.react,
				replyTo: composed.replyTo,
				subject: composed.subject,
				to,
			})
		)
	);
	return { recipients: composed.recipients };
};

/* -------------------------------- Webhooks ------------------------------- */

/** Custom header text area ("Name: value" per line) -> a plain object. */
function parseHeaderLines(raw: unknown): Record<string, string> {
	if (typeof raw !== "string") {
		return raw && typeof raw === "object"
			? (raw as Record<string, string>)
			: {};
	}
	const headers: Record<string, string> = {};
	for (const line of raw.split("\n")) {
		const index = line.indexOf(":");
		if (index === -1) {
			continue;
		}
		const name = line.slice(0, index).trim();
		const value = line.slice(index + 1).trim();
		if (name && value) {
			headers[name] = value;
		}
	}
	return headers;
}

/**
 * webhook, n8n, Zapier, Make, Pabbly, Activepieces, Albato all receive a
 * plain JSON POST — this one handler builds the body and headers for all
 * seven, from the shared "Security"/"Payload"/"Advanced" settings.
 */
function sendWebhookLike(
	run: Pick<
		IntegrationRun,
		| "config"
		| "data"
		| "form"
		| "integrationId"
		| "settings"
		| "submission"
		| "test"
	>
) {
	const { config, data, form, submission } = run;
	const settings = parseWebhookLikeSettings(
		run.integrationId ?? "webhook",
		run.settings
	);
	const url = str(data.webhook_url) || str(data.hook_url);
	const body = webhookPayload(form, submission, config, {
		flat: settings.payloadStyle === "flat",
		includeMetadata: settings.includeMetadata,
		legacy: settings.payloadStyle === "classic",
		test: run.test,
	});
	const headers: Record<string, string> = { ...authHeaders(settings) };
	for (const [name, value] of Object.entries(
		parseHeaderLines(data.webhook_headers)
	)) {
		if (!BLOCKED_HEADERS.has(name.toLowerCase())) {
			headers[name] = value;
		}
	}
	const secret = str(data.webhook_secret);
	Object.assign(headers, hmacHeaders(settings, secret, body));
	return postJson(url, body, headers, settings.timeoutSeconds * 1000);
}

/** webhook, n8n, Make, Zapier, Pabbly, Albato, Activepieces: plain JSON POST. */
export const webhookHandler: IntegrationHandler = sendWebhookLike;
export const automationHandler: IntegrationHandler = sendWebhookLike;

/* ------------------------------ Chat messages ---------------------------- */

interface ChatMessage {
	fields: { name: string; value: string }[];
	links: { label: string; url: string }[];
	text: string;
}

function chatMessage(run: IntegrationRun): ChatMessage {
	const { config, data, form, submission } = run;
	const fields = formatSubmissionFields(form, submission, config, {
		includeHidden: bool(data.include_hidden_fields_submission_data),
	});
	const { computed, values } = mentionContext(run, fields);
	const links: ChatMessage["links"] = [];
	if (bool(data.link_open_form, true)) {
		links.push({
			label: "Open form",
			url: shareUrl(config, form.slug, form.customDomain),
		});
	}
	if (bool(data.link_edit_form, true)) {
		links.push({
			label: "View submissions",
			url: `${config.appUrl}/dashboard/forms/${form.id}`,
		});
	}
	if (bool(data.link_edit_submission, true) && form.editableSubmissions) {
		links.push({
			label: "Edit submission",
			url: editSubmissionUrl(form, submission, config),
		});
	}
	return {
		fields: bool(data.include_submission_data, true)
			? fields
					.filter((f) => f.display !== null)
					.map((f) => ({ name: f.name, value: displayValueToText(f.display) }))
			: [],
		links,
		text:
			resolveMentions(str(data.message, "New form submission"), values, {
				computed,
				mode: "text",
			}) || `New submission for ${form.title}`,
	};
}

const escapeSlack = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const slackHandler: IntegrationHandler = (run) => {
	const url = str(run.data.slack_webhook_url);
	if (!url.startsWith("https://hooks.slack.com/")) {
		throw new Error(
			"Slack webhook URL must start with https://hooks.slack.com/"
		);
	}
	const settings = parseSlackSettings(run.settings);
	const message = chatMessage(run);
	const prefix = run.test ? "🧪 *Test send* — " : "";
	if (settings.format === "simple") {
		// Plain text: one line, no Block Kit — for channels that just want the gist.
		const lines = [
			`${prefix}${message.text}`,
			...message.fields.map((f) => `${f.name}: ${f.value}`),
			...message.links.map((l) => `${l.label}: ${l.url}`),
		];
		return postJson(url, { text: lines.join("\n") });
	}
	const blocks: unknown[] = [
		{
			text: { text: `${prefix}${escapeSlack(message.text)}`, type: "mrkdwn" },
			type: "section",
		},
	];
	if (message.fields.length > 0) {
		blocks.push({
			text: {
				text: message.fields
					.map((f) => `*${escapeSlack(f.name)}*: ${escapeSlack(f.value)}`)
					.join("\n"),
				type: "mrkdwn",
			},
			type: "section",
		});
	}
	if (message.links.length > 0) {
		blocks.push({
			text: {
				text: message.links.map((l) => `*<${l.url}|${l.label}>*`).join("     "),
				type: "mrkdwn",
			},
			type: "section",
		});
	}
	return postJson(url, { blocks });
};

const escapeDiscord = (s: string) =>
	s.replace(/([*_~`>|[\]()])/g, "\\$1").replace(/@/g, "@\u200b");

export const discordHandler: IntegrationHandler = (run) => {
	const baseUrl = str(run.data.discord_webhook_url);
	if (!baseUrl.startsWith("https://discord.com/api/webhooks")) {
		throw new Error(
			"Discord webhook URL must start with https://discord.com/api/webhooks"
		);
	}
	const settings = parseDiscordSettings(run.settings);
	// Posting into a specific thread under the webhook's channel.
	const url = settings.threadId
		? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}thread_id=${encodeURIComponent(settings.threadId)}`
		: baseUrl;
	const message = chatMessage(run);
	const testPrefix = run.test ? "🧪 **Test send** — " : "";
	const username =
		settings.username || run.branding?.appName || run.config.appName;
	if (settings.format === "simple") {
		const lines = [
			`${testPrefix}${message.text}`,
			...message.fields.map((f) => `**${f.name}**: ${f.value}`),
			...message.links.map((l) => `[${l.label}](${l.url})`),
		];
		return postJson(url, {
			avatar_url: settings.avatarUrl || undefined,
			content: lines.join("\n"),
			username,
		});
	}
	const description = [
		...message.fields.map(
			(f) => `**${escapeDiscord(f.name)}**: ${escapeDiscord(f.value)}`
		),
		message.links.map((l) => `[${l.label}](${l.url})`).join(" • "),
	]
		.filter(Boolean)
		.join("\n");
	return postJson(url, {
		avatar_url: settings.avatarUrl || undefined,
		content: `${testPrefix}${escapeDiscord(message.text)}`,
		embeds: description
			? [
					{
						color: Number.parseInt(run.form.color.replace("#", ""), 16) || 0,
						description,
						type: "rich",
					},
				]
			: [],
		tts: false,
		username,
	});
};

const escapeTelegram = (s: string) =>
	s.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");

/** Needs TELEGRAM_BOT_TOKEN and a chat id (OpnForm linked chats through OAuth). */
export const telegramHandler: IntegrationHandler = (run) => {
	const token = process.env.TELEGRAM_BOT_TOKEN;
	const chatId = str(run.data.chat_id);
	if (!(token && chatId)) {
		throw new Error(
			"Telegram needs TELEGRAM_BOT_TOKEN on the server and a chat id"
		);
	}
	const settings = parseTelegramSettings(run.settings);
	const message = chatMessage(run);
	const testPrefix = run.test ? "🧪 TEST — " : "";
	const text = (() => {
		if (settings.parseMode === "None") {
			return [
				`${testPrefix}${message.text}`,
				...message.fields.map((f) => `${f.name}: ${f.value}`),
				...message.links.map((l) => `${l.label}: ${l.url}`),
			]
				.filter(Boolean)
				.join("\n");
		}
		if (settings.parseMode === "HTML") {
			const esc = (s: string) =>
				s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
			return [
				`<b>${testPrefix}${esc(message.text)}</b>`,
				...message.fields.map((f) => `<b>${esc(f.name)}</b>: ${esc(f.value)}`),
				message.links
					.map((l) => `<a href="${l.url}">${esc(l.label)}</a>`)
					.join("  "),
			]
				.filter(Boolean)
				.join("\n");
		}
		return [
			`*${escapeTelegram(testPrefix)}${escapeTelegram(message.text)}*`,
			...message.fields.map(
				(f) => `*${escapeTelegram(f.name)}*: ${escapeTelegram(f.value)}`
			),
			message.links
				.map((l) => `[${escapeTelegram(l.label)}](${l.url})`)
				.join("  "),
		]
			.filter(Boolean)
			.join("\n");
	})();
	return postJson(`https://api.telegram.org/bot${token}/sendMessage`, {
		chat_id: chatId,
		disable_notification: settings.silent,
		...(settings.parseMode === "None"
			? {}
			: { parse_mode: settings.parseMode }),
		text,
	});
};

export const HANDLERS: Record<string, IntegrationHandler> = {
	activepieces: automationHandler,
	albato: automationHandler,
	discord: discordHandler,
	email: emailHandler,
	make: automationHandler,
	n8n: automationHandler,
	pabbly: automationHandler,
	slack: slackHandler,
	telegram: telegramHandler,
	webhook: webhookHandler,
	zapier: automationHandler,
};

/** Integration types the UI can configure, with labels. */
export const INTEGRATION_CATALOG = [
	{ id: "email", name: "Email notification", section: "Notifications" },
	{ id: "slack", name: "Slack", section: "Notifications" },
	{ id: "discord", name: "Discord", section: "Notifications" },
	{ id: "telegram", name: "Telegram", section: "Notifications" },
	{ id: "webhook", name: "Webhook", section: "Automation" },
	{ id: "n8n", name: "n8n", section: "Automation" },
	{ id: "zapier", name: "Zapier", section: "Automation" },
	{ id: "make", name: "Make", section: "Automation" },
	{ id: "pabbly", name: "Pabbly Connect", section: "Automation" },
	{ id: "activepieces", name: "Activepieces", section: "Automation" },
	{ id: "albato", name: "Albato", section: "Automation" },
] as const;
