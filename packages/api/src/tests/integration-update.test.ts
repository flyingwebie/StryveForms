import { describe, expect, test } from "bun:test";

import { integrationPatchInput } from "../routers/integration";

describe("integration update input", () => {
	test("omitted fields stay undefined, not reset to their create-time defaults", () => {
		// Regression test: this schema used to be `integrationInput.partial()`,
		// whose `data`/`status`/`logic` fields each carry a zod `.default()`.
		// `.partial()` re-wraps those in `.optional()` around the existing
		// `ZodDefault`, so an omitted field still resolved through its default
		// instead of staying `undefined` — a status-only toggle silently wiped
		// `data` back to `{}` on every save.
		const parsed = integrationPatchInput.parse({ status: "inactive" });
		expect(parsed.status).toBe("inactive");
		expect(parsed.data).toBeUndefined();
		expect(parsed.logic).toBeUndefined();
		expect(parsed.integrationId).toBeUndefined();
	});

	test("explicitly provided fields still parse through", () => {
		const parsed = integrationPatchInput.parse({
			data: { webhook_url: "https://example.com" },
			logic: null,
			status: "active",
		});
		expect(parsed.data).toEqual({ webhook_url: "https://example.com" });
		expect(parsed.logic).toBeNull();
		expect(parsed.status).toBe("active");
	});
});
