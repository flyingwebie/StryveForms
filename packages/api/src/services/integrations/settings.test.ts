import { describe, expect, test } from "bun:test";

import {
	parseDiscordSettings,
	parseSlackSettings,
	parseTelegramSettings,
	parseWebhookLikeSettings,
} from "./settings";

describe("parseWebhookLikeSettings", () => {
	test("defaults the plain webhook integration to the classic payload style", () => {
		expect(parseWebhookLikeSettings("webhook", {}).payloadStyle).toBe(
			"classic"
		);
	});

	test("defaults every other automation tool to the nested payload style", () => {
		for (const id of [
			"n8n",
			"zapier",
			"make",
			"pabbly",
			"activepieces",
			"albato",
		]) {
			expect(parseWebhookLikeSettings(id, {}).payloadStyle).toBe("nested");
		}
	});

	test("an empty settings object keeps every existing-integration default", () => {
		const settings = parseWebhookLikeSettings("webhook", {});
		expect(settings.authType).toBe("none");
		expect(settings.includeMetadata).toBe(true);
		expect(settings.retryOnFailure).toBe(false);
		expect(settings.timeoutSeconds).toBe(10);
		expect(settings.hmacAlgorithm).toBe("sha256");
		expect(settings.hmacHeaderName).toBe("X-Webhook-Signature");
	});

	test("reads valid overrides", () => {
		const settings = parseWebhookLikeSettings("n8n", {
			auth_type: "bearer",
			auth_token: "secret-token",
			payload_style: "flat",
			timeout_seconds: 30,
		});
		expect(settings.authType).toBe("bearer");
		expect(settings.authToken).toBe("secret-token");
		expect(settings.payloadStyle).toBe("flat");
		expect(settings.timeoutSeconds).toBe(30);
	});

	test("falls back to the default for an invalid enum value", () => {
		expect(
			parseWebhookLikeSettings("webhook", { auth_type: "not-a-type" }).authType
		).toBe("none");
	});

	test("clamps the timeout to the allowed range", () => {
		expect(
			parseWebhookLikeSettings("webhook", { timeout_seconds: 999 })
				.timeoutSeconds
		).toBe(60);
		expect(
			parseWebhookLikeSettings("webhook", { timeout_seconds: -5 })
				.timeoutSeconds
		).toBe(1);
	});
});

describe("parseSlackSettings", () => {
	test("defaults to the rich Block Kit format", () => {
		expect(parseSlackSettings({}).format).toBe("blocks");
	});
	test("accepts the simple format", () => {
		expect(parseSlackSettings({ format: "simple" }).format).toBe("simple");
	});
});

describe("parseDiscordSettings", () => {
	test("defaults to an embed with no overrides", () => {
		const settings = parseDiscordSettings({});
		expect(settings.format).toBe("embed");
		expect(settings.username).toBe("");
		expect(settings.avatarUrl).toBe("");
		expect(settings.threadId).toBe("");
	});
	test("reads overrides", () => {
		const settings = parseDiscordSettings({
			avatar_url: "https://example.com/a.png",
			thread_id: "123",
			username: "Forms Bot",
		});
		expect(settings.username).toBe("Forms Bot");
		expect(settings.avatarUrl).toBe("https://example.com/a.png");
		expect(settings.threadId).toBe("123");
	});
});

describe("parseTelegramSettings", () => {
	test("defaults to MarkdownV2 and non-silent", () => {
		const settings = parseTelegramSettings({});
		expect(settings.parseMode).toBe("MarkdownV2");
		expect(settings.silent).toBe(false);
	});
	test("reads overrides", () => {
		const settings = parseTelegramSettings({
			parse_mode: "HTML",
			silent: true,
		});
		expect(settings.parseMode).toBe("HTML");
		expect(settings.silent).toBe(true);
	});
});
