/**
 * Per-integration "Security" / "Payload" / "Advanced" settings, stored in
 * `formIntegration.settings` (a jsonb column already on the table, kept
 * separate from `data` so the plain per-integration fields in `data` don't
 * get crowded). Every reader here fills in defaults for missing/invalid
 * keys, so existing saved integrations (an empty `{}`) keep working exactly
 * as before this feature shipped.
 */

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw {
	return value && typeof value === "object" ? (value as Raw) : {};
}

function pickEnum<T extends string>(
	value: unknown,
	allowed: readonly T[],
	fallback: T
): T {
	return typeof value === "string" &&
		(allowed as readonly string[]).includes(value)
		? (value as T)
		: fallback;
}

function pickBool(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function pickString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

function pickNumber(
	value: unknown,
	fallback: number,
	{ min, max }: { max: number; min: number }
): number {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n)) {
		return fallback;
	}
	return Math.min(max, Math.max(min, Math.round(n)));
}

/* --------------------------- Webhook-like senders ------------------------- */
/** Shared by webhook, n8n, zapier, make, pabbly, activepieces, albato — they
 * all receive a plain JSON POST, so the same security/payload/advanced
 * knobs apply to every one of them. */

export const AUTH_TYPES = ["none", "bearer", "basic", "api_key"] as const;
export type AuthType = (typeof AUTH_TYPES)[number];

export const PAYLOAD_STYLES = ["classic", "nested", "flat"] as const;
export type PayloadStyle = (typeof PAYLOAD_STYLES)[number];

export interface WebhookLikeSettings {
	authHeaderName: string;
	authHeaderValue: string;
	authPassword: string;
	authToken: string;
	authType: AuthType;
	authUsername: string;
	hmacAlgorithm: "sha1" | "sha256";
	hmacHeaderName: string;
	hmacIncludeTimestamp: boolean;
	includeMetadata: boolean;
	/**
	 * "classic": OpnForm-compatible body (data + deprecated `submission` map) —
	 * default for the plain Webhook integration, for existing automations.
	 * "nested": `data: { id: { name, type, value } }` — default for n8n/Zapier/etc.
	 * "flat": `data: { id: value }` — simplest shape to map in a no-code tool.
	 */
	payloadStyle: PayloadStyle;
	retryOnFailure: boolean;
	timeoutSeconds: number;
}

export function parseWebhookLikeSettings(
	integrationId: string,
	raw: unknown
): WebhookLikeSettings {
	const input = asRecord(raw);
	const defaultStyle: PayloadStyle =
		integrationId === "webhook" ? "classic" : "nested";
	return {
		authHeaderName: pickString(input.auth_header_name),
		authHeaderValue: pickString(input.auth_header_value),
		authPassword: pickString(input.auth_password),
		authToken: pickString(input.auth_token),
		authType: pickEnum(input.auth_type, AUTH_TYPES, "none"),
		authUsername: pickString(input.auth_username),
		hmacAlgorithm: pickEnum(input.hmac_algorithm, ["sha1", "sha256"], "sha256"),
		hmacHeaderName: pickString(input.hmac_header_name, "X-Webhook-Signature"),
		hmacIncludeTimestamp: pickBool(input.hmac_include_timestamp, false),
		includeMetadata: pickBool(input.include_metadata, true),
		payloadStyle: pickEnum(input.payload_style, PAYLOAD_STYLES, defaultStyle),
		retryOnFailure: pickBool(input.retry_on_failure, false),
		timeoutSeconds: pickNumber(input.timeout_seconds, 10, { max: 60, min: 1 }),
	};
}

/* ---------------------------------- Slack --------------------------------- */

export const SLACK_FORMATS = ["blocks", "simple"] as const;

export interface SlackSettings {
	format: (typeof SLACK_FORMATS)[number];
}

export function parseSlackSettings(raw: unknown): SlackSettings {
	const input = asRecord(raw);
	return { format: pickEnum(input.format, SLACK_FORMATS, "blocks") };
}

/* --------------------------------- Discord -------------------------------- */

export const DISCORD_FORMATS = ["embed", "simple"] as const;

export interface DiscordSettings {
	avatarUrl: string;
	format: (typeof DISCORD_FORMATS)[number];
	threadId: string;
	username: string;
}

export function parseDiscordSettings(raw: unknown): DiscordSettings {
	const input = asRecord(raw);
	return {
		avatarUrl: pickString(input.avatar_url),
		format: pickEnum(input.format, DISCORD_FORMATS, "embed"),
		threadId: pickString(input.thread_id),
		username: pickString(input.username),
	};
}

/* -------------------------------- Telegram -------------------------------- */

export const TELEGRAM_PARSE_MODES = ["MarkdownV2", "HTML", "None"] as const;

export interface TelegramSettings {
	parseMode: (typeof TELEGRAM_PARSE_MODES)[number];
	silent: boolean;
}

export function parseTelegramSettings(raw: unknown): TelegramSettings {
	const input = asRecord(raw);
	return {
		parseMode: pickEnum(input.parse_mode, TELEGRAM_PARSE_MODES, "MarkdownV2"),
		silent: pickBool(input.silent, false),
	};
}
