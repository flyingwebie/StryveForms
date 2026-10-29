/**
 * Exercises the webhook-like/Slack/Discord/Telegram handlers end to end,
 * with `fetch` mocked so no real network call happens. `ALLOW_PRIVATE_WEBHOOKS`
 * is set so the SSRF guard's DNS lookup is skipped for the fake receiver host
 * used here — the handlers still go through `assertPublicUrl` itself.
 */
import type { FormField } from "@StryveForms/forms/types";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";

import type { AppConfig } from "../../context";
import type { FormRow } from "../../lib/serialize";
import {
	automationHandler,
	discordHandler,
	type IntegrationRun,
	slackHandler,
	telegramHandler,
	webhookHandler,
} from "./handlers";
import type { SubmissionRow } from "./payload";

const CONFIG: AppConfig = {
	appName: "StryveForms",
	appUrl: "https://forms.example.com",
	captcha: {},
	importRateLimitPerMinute: 60,
	serverUrl: "https://api.example.com",
	signingSecret: "test-signing-secret-xxxxxxxxxxxx",
};

const FIELDS: FormField[] = [{ id: "name", name: "Name", type: "text" }];

const SLACK_URL_PATTERN = /hooks\.slack\.com/;
const DISCORD_URL_PATTERN = /discord\.com/;

function buildForm(overrides: Partial<FormRow> = {}): FormRow {
	return {
		color: "#111827",
		computedVariables: [],
		customDomain: null,
		editableSubmissions: false,
		id: "form-1",
		properties: FIELDS,
		removedProperties: [],
		slug: "contact-us",
		title: "Contact us",
		...overrides,
	} as unknown as FormRow;
}

function buildSubmission(): SubmissionRow {
	const now = new Date("2026-01-01T00:00:00Z");
	return {
		completionTime: null,
		createdAt: now,
		data: { name: "Ada" },
		formId: "form-1",
		id: "sub-1",
		legacyOpnformId: null,
		meta: {},
		publicId: "pub-1",
		status: "completed",
		updatedAt: now,
	};
}

function baseRun(overrides: Partial<IntegrationRun> = {}): IntegrationRun {
	return {
		config: CONFIG,
		data: {},
		form: buildForm(),
		integrationId: "webhook",
		mailer: { logOnly: false, send: async () => ({ messageId: "unused" }) },
		settings: {},
		submission: buildSubmission(),
		...overrides,
	};
}

interface CapturedRequest {
	body: Record<string, unknown>;
	headers: Record<string, string>;
	url: string;
}

let captured: CapturedRequest | null = null;
let originalFetch: typeof fetch;
let originalAllowPrivate: string | undefined;
let originalTelegramToken: string | undefined;

/** The last fetch call's body/headers — asserts fetch actually ran first. */
function lastRequest(): CapturedRequest {
	if (!captured) {
		throw new Error("fetch was not called");
	}
	return captured;
}

beforeEach(() => {
	captured = null;
	originalFetch = globalThis.fetch;
	originalAllowPrivate = process.env.ALLOW_PRIVATE_WEBHOOKS;
	originalTelegramToken = process.env.TELEGRAM_BOT_TOKEN;
	process.env.ALLOW_PRIVATE_WEBHOOKS = "true";
	globalThis.fetch = ((url: string, init?: RequestInit) => {
		captured = {
			body: init?.body ? JSON.parse(init.body as string) : {},
			headers: (init?.headers ?? {}) as Record<string, string>,
			url: String(url),
		};
		return Promise.resolve(new Response("ok", { status: 200 }));
	}) as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	if (originalAllowPrivate === undefined) {
		delete process.env.ALLOW_PRIVATE_WEBHOOKS;
	} else {
		process.env.ALLOW_PRIVATE_WEBHOOKS = originalAllowPrivate;
	}
	if (originalTelegramToken === undefined) {
		delete process.env.TELEGRAM_BOT_TOKEN;
	} else {
		process.env.TELEGRAM_BOT_TOKEN = originalTelegramToken;
	}
});

describe("webhookHandler (generic webhook) — security settings", () => {
	test("signs the exact JSON body sent, hex-encoded HMAC-SHA256 by default", async () => {
		const secret = "shh-its-a-secret";
		await webhookHandler(
			baseRun({
				data: {
					webhook_secret: secret,
					webhook_url: "https://receiver.example.com/hook",
				},
			})
		);
		const { body, headers } = lastRequest();
		const expected = createHmac("sha256", secret)
			.update(JSON.stringify(body))
			.digest("hex");
		expect(headers["X-Webhook-Signature"]).toBe(`sha256=${expected}`);
	});

	test("uses a custom header name and sha1 when configured", async () => {
		const secret = "shh";
		await webhookHandler(
			baseRun({
				data: {
					webhook_secret: secret,
					webhook_url: "https://receiver.example.com/hook",
				},
				settings: { hmac_algorithm: "sha1", hmac_header_name: "X-Sig" },
			})
		);
		const { body, headers } = lastRequest();
		const expected = createHmac("sha1", secret)
			.update(JSON.stringify(body))
			.digest("hex");
		expect(headers["X-Sig"]).toBe(`sha1=${expected}`);
		expect(headers["X-Webhook-Signature"]).toBeUndefined();
	});

	test("an included timestamp is signed together with the body, Stripe-style", async () => {
		const secret = "shh";
		await webhookHandler(
			baseRun({
				data: {
					webhook_secret: secret,
					webhook_url: "https://receiver.example.com/hook",
				},
				settings: { hmac_include_timestamp: true },
			})
		);
		const { body, headers } = lastRequest();
		const timestamp = headers["X-Webhook-Timestamp"];
		expect(timestamp).toBeDefined();
		const signedPayload = [timestamp, JSON.stringify(body)].join(".");
		const expected = createHmac("sha256", secret)
			.update(signedPayload)
			.digest("hex");
		expect(headers["X-Webhook-Signature"]).toBe(`sha256=${expected}`);
	});

	test("bearer auth sends an Authorization header", async () => {
		await webhookHandler(
			baseRun({
				data: { webhook_url: "https://receiver.example.com/hook" },
				settings: { auth_token: "abc123", auth_type: "bearer" },
			})
		);
		expect(lastRequest().headers.Authorization).toBe("Bearer abc123");
	});

	test("basic auth sends a base64-encoded Authorization header", async () => {
		await webhookHandler(
			baseRun({
				data: { webhook_url: "https://receiver.example.com/hook" },
				settings: {
					auth_password: "secret",
					auth_type: "basic",
					auth_username: "user",
				},
			})
		);
		expect(lastRequest().headers.Authorization).toBe(
			`Basic ${Buffer.from("user:secret").toString("base64")}`
		);
	});

	test("api_key auth sends the configured custom header", async () => {
		await webhookHandler(
			baseRun({
				data: { webhook_url: "https://receiver.example.com/hook" },
				settings: {
					auth_header_name: "X-API-Key",
					auth_header_value: "my-key",
					auth_type: "api_key",
				},
			})
		);
		expect(lastRequest().headers["X-API-Key"]).toBe("my-key");
	});

	test("a user-supplied Authorization header can't override the configured auth", async () => {
		await webhookHandler(
			baseRun({
				data: {
					webhook_headers: "Authorization: Bearer hijacked",
					webhook_url: "https://receiver.example.com/hook",
				},
				settings: { auth_token: "abc123", auth_type: "bearer" },
			})
		);
		expect(lastRequest().headers.Authorization).toBe("Bearer abc123");
	});
});

describe("payload style settings", () => {
	test("webhook defaults to the classic (legacy) shape", async () => {
		await webhookHandler(
			baseRun({ data: { webhook_url: "https://receiver.example.com/hook" } })
		);
		expect(lastRequest().body.submission).toBeDefined();
	});

	test("n8n defaults to the nested shape, with no legacy submission map", async () => {
		await automationHandler(
			baseRun({
				data: { webhook_url: "https://receiver.example.com/hook" },
				integrationId: "n8n",
			})
		);
		expect(lastRequest().body.submission).toBeUndefined();
	});

	test("flat style overrides either default", async () => {
		await webhookHandler(
			baseRun({
				data: { webhook_url: "https://receiver.example.com/hook" },
				settings: { payload_style: "flat" },
			})
		);
		expect(lastRequest().body.data).toEqual({ name: "Ada" });
	});
});

describe("slackHandler", () => {
	const SLACK_URL = "https://hooks.slack.com/services/T000/B000/xxx";

	test("rejects a non-Slack URL", async () => {
		// slackHandler throws synchronously (before returning a promise), so
		// wrap it in an async function for `.rejects` to catch.
		await expect(
			(async () =>
				slackHandler(
					baseRun({ data: { slack_webhook_url: "https://evil.example.com" } })
				))()
		).rejects.toThrow(SLACK_URL_PATTERN);
	});

	test("rich format sends Block Kit blocks", async () => {
		await slackHandler(baseRun({ data: { slack_webhook_url: SLACK_URL } }));
		expect(lastRequest().body.blocks).toBeDefined();
	});

	test("simple format sends plain text, no blocks", async () => {
		await slackHandler(
			baseRun({
				data: { slack_webhook_url: SLACK_URL },
				settings: { format: "simple" },
			})
		);
		const { body } = lastRequest();
		expect(body.blocks).toBeUndefined();
		expect(typeof body.text).toBe("string");
	});
});

describe("discordHandler", () => {
	const DISCORD_URL = "https://discord.com/api/webhooks/123/abc";

	test("rejects a non-Discord URL", async () => {
		await expect(
			(async () =>
				discordHandler(
					baseRun({ data: { discord_webhook_url: "https://evil.example.com" } })
				))()
		).rejects.toThrow(DISCORD_URL_PATTERN);
	});

	test("sends username/avatar overrides when set", async () => {
		await discordHandler(
			baseRun({
				data: { discord_webhook_url: DISCORD_URL },
				settings: {
					avatar_url: "https://example.com/a.png",
					username: "Forms Bot",
				},
			})
		);
		const { body } = lastRequest();
		expect(body.username).toBe("Forms Bot");
		expect(body.avatar_url).toBe("https://example.com/a.png");
	});

	test("a thread id is appended to the URL as a query parameter", async () => {
		await discordHandler(
			baseRun({
				data: { discord_webhook_url: DISCORD_URL },
				settings: { thread_id: "999" },
			})
		);
		expect(lastRequest().url).toBe(`${DISCORD_URL}?thread_id=999`);
	});
});

describe("telegramHandler", () => {
	beforeEach(() => {
		process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
	});

	test("defaults to MarkdownV2", async () => {
		await telegramHandler(baseRun({ data: { chat_id: "42" } }));
		expect(lastRequest().body.parse_mode).toBe("MarkdownV2");
	});

	test("HTML mode escapes with HTML entities, not Markdown escapes", async () => {
		// The message field stores rich-text HTML, so a literal "<tag>" would be
		// stripped as markup rather than escaped — use "&" to show HTML escaping.
		await telegramHandler(
			baseRun({
				data: { chat_id: "42", message: "Ben & Jerry" },
				settings: { parse_mode: "HTML" },
			})
		);
		const { body } = lastRequest();
		expect(body.parse_mode).toBe("HTML");
		expect(String(body.text)).toContain("Ben &amp; Jerry");
	});

	test("silent sets disable_notification", async () => {
		await telegramHandler(
			baseRun({ data: { chat_id: "42" }, settings: { silent: true } })
		);
		expect(lastRequest().body.disable_notification).toBe(true);
	});
});
