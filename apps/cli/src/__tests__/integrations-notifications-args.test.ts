/**
 * Pure argument-parsing coverage for the `integrations`/`notifications`
 * commands. The commands themselves (list/create/update/delete/test) all
 * need a signed-in session and a live server to exercise past this point,
 * so this only covers `parseArgs`'s flag wiring — the part that's pure and
 * safe to run in CI without a server.
 */
import { describe, expect, test } from "bun:test";

import { parseIntegrationsArgs } from "../commands/integrations";
import { parseNotificationsArgs } from "../commands/notifications";

describe("parseIntegrationsArgs", () => {
	test("reads --form, --type, --file, --id, --status, --json", () => {
		const { values, positionals } = parseIntegrationsArgs([
			"int_123",
			"--form",
			"f1",
			"--type",
			"webhook",
			"--file",
			"spec.json",
			"--status",
			"inactive",
			"--json",
		]);
		expect(positionals).toEqual(["int_123"]);
		expect(values.form).toBe("f1");
		expect(values.type).toBe("webhook");
		expect(values.file).toBe("spec.json");
		expect(values.status).toBe("inactive");
		expect(values.json).toBe(true);
	});

	test("every flag is optional — an empty invocation parses cleanly", () => {
		const { values, positionals } = parseIntegrationsArgs([]);
		expect(positionals).toEqual([]);
		expect(values.form).toBeUndefined();
		expect(values.json).toBeUndefined();
	});
});

describe("parseNotificationsArgs", () => {
	test("reads --form, --file, --to, --dark, --status, --json", () => {
		const { values, positionals } = parseNotificationsArgs([
			"notif_1",
			"--form",
			"f1",
			"--file",
			"data.json",
			"--to",
			"person@example.com",
			"--dark",
			"--status",
			"active",
			"--json",
		]);
		expect(positionals).toEqual(["notif_1"]);
		expect(values.form).toBe("f1");
		expect(values.file).toBe("data.json");
		expect(values.to).toBe("person@example.com");
		expect(values.dark).toBe(true);
		expect(values.status).toBe("active");
		expect(values.json).toBe(true);
	});

	test("every flag is optional — an empty invocation parses cleanly", () => {
		const { values, positionals } = parseNotificationsArgs([]);
		expect(positionals).toEqual([]);
		expect(values.dark).toBeUndefined();
	});
});
