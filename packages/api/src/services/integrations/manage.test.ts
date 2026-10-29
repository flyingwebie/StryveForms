/**
 * `cleanIntegrationData` is the one piece of manage.ts that's pure enough to
 * unit test without a database: it validates webhook-shaped URLs (through
 * the SSRF guard) and sanitizes rich-text email content. The create/update/
 * delete functions themselves are exercised indirectly by routers/
 * integration.ts and services/agent/tools.ts, which both call them against
 * a real database — covering them here would mean faking Drizzle.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { cleanIntegrationData, INTEGRATION_IDS } from "./manage";

describe("INTEGRATION_IDS", () => {
	test("lists every catalog type, including email", () => {
		expect(INTEGRATION_IDS).toContain("email");
		expect(INTEGRATION_IDS).toContain("webhook");
		expect(INTEGRATION_IDS).toContain("slack");
		expect(INTEGRATION_IDS.length).toBeGreaterThan(5);
	});
});

describe("cleanIntegrationData", () => {
	let previousAllowPrivate: string | undefined;

	beforeEach(() => {
		previousAllowPrivate = process.env.ALLOW_PRIVATE_WEBHOOKS;
		process.env.ALLOW_PRIVATE_WEBHOOKS = "true";
	});

	afterEach(() => {
		if (previousAllowPrivate === undefined) {
			delete process.env.ALLOW_PRIVATE_WEBHOOKS;
		} else {
			process.env.ALLOW_PRIVATE_WEBHOOKS = previousAllowPrivate;
		}
	});

	test("passes through data with no URL/rich-text keys unchanged", async () => {
		const result = await cleanIntegrationData({ chat_id: "12345" });
		expect(result).toEqual({ chat_id: "12345" });
	});

	test("accepts a valid webhook_url", async () => {
		const result = await cleanIntegrationData({
			webhook_url: "https://example.com/hook",
		});
		expect(result.webhook_url).toBe("https://example.com/hook");
	});

	test("rejects a malformed webhook_url", async () => {
		await expect(
			cleanIntegrationData({ webhook_url: "not a url" })
		).rejects.toThrow();
	});

	test("rejects a non-http(s) webhook_url", async () => {
		await expect(
			cleanIntegrationData({ webhook_url: "ftp://example.com/hook" })
		).rejects.toThrow();
	});

	test("checks hook_url the same way as webhook_url", async () => {
		await expect(
			cleanIntegrationData({ hook_url: "javascript:alert(1)" })
		).rejects.toThrow();
	});

	test("sanitizes email_content (strips a script tag)", async () => {
		const result = await cleanIntegrationData({
			email_content: "<p>Hi</p><script>alert(1)</script>",
		});
		expect(String(result.email_content)).not.toContain("<script>");
		expect(String(result.email_content)).toContain("<p>Hi</p>");
	});

	test("leaves a non-string email_content alone (defensive — shouldn't happen past zod)", async () => {
		const result = await cleanIntegrationData({ email_content: 123 as never });
		expect(result.email_content).toBe(123);
	});

	test("doesn't mutate the input object", async () => {
		const input = { webhook_url: "https://example.com/hook" };
		await cleanIntegrationData(input);
		expect(input.webhook_url).toBe("https://example.com/hook");
	});
});
