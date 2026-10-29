/**
 * `integrationTypeCatalog` is the one piece of tools.ts pure enough to unit
 * test without a database — it's the static "what fields does each
 * integration type take" reference the `list_integration_types`
 * MCP/CLI/AI-assistant tool returns. Every other export here (createForm,
 * createIntegration, listEmailNotifications, …) goes through
 * requireForm/requireWorkspace against a real database, and is exercised
 * indirectly by the routers/MCP server that call them.
 */
import { describe, expect, test } from "bun:test";

import { integrationTypeCatalog } from "./tools";

describe("integrationTypeCatalog", () => {
	const catalog = integrationTypeCatalog();

	test("covers every integration type, including email", () => {
		const ids = catalog.map((t) => t.id);
		expect(ids).toEqual([
			"email",
			"slack",
			"discord",
			"telegram",
			"webhook",
			"n8n",
			"zapier",
			"make",
			"pabbly",
			"activepieces",
			"albato",
		]);
	});

	test("every entry has a name, section, and at least one documented data field", () => {
		for (const entry of catalog) {
			expect(entry.name.length).toBeGreaterThan(0);
			expect(entry.section.length).toBeGreaterThan(0);
			expect(entry.dataFields.length).toBeGreaterThan(0);
			for (const field of entry.dataFields) {
				expect(field.key.length).toBeGreaterThan(0);
				expect(field.type.length).toBeGreaterThan(0);
				expect(field.description.length).toBeGreaterThan(0);
			}
		}
	});

	test("every webhook-like automation integration shares the same settings fields", () => {
		const webhookLike = catalog.filter((t) =>
			[
				"webhook",
				"n8n",
				"zapier",
				"make",
				"pabbly",
				"activepieces",
				"albato",
			].includes(t.id)
		);
		expect(webhookLike).toHaveLength(7);
		for (const entry of webhookLike) {
			const keys = entry.settingsFields.map((f) => f.key);
			expect(keys).toContain("auth_type");
			expect(keys).toContain("payload_style");
			expect(keys).toContain("timeout_seconds");
		}
	});

	test("email's data fields mention send_to and support a mention placeholder in its description", () => {
		const email = catalog.find((t) => t.id === "email");
		expect(email).toBeDefined();
		const sendTo = email?.dataFields.find((f) => f.key === "send_to");
		expect(sendTo?.description).toContain("@-mention");
	});

	test("slack/discord require a webhook URL prefixed for their own domain", () => {
		const slack = catalog.find((t) => t.id === "slack");
		const discord = catalog.find((t) => t.id === "discord");
		expect(
			slack?.dataFields.find((f) => f.key === "slack_webhook_url")?.description
		).toContain("hooks.slack.com");
		expect(
			discord?.dataFields.find((f) => f.key === "discord_webhook_url")
				?.description
		).toContain("discord.com/api/webhooks");
	});
});
