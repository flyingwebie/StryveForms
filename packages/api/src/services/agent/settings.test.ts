import { describe, expect, test } from "bun:test";

import { resolveAgentSettings } from "./settings";

describe("resolveAgentSettings", () => {
	test("fills every default for an empty row", () => {
		expect(resolveAgentSettings({})).toEqual({
			allowApiTokens: true,
			allowWriteTools: true,
			cliClientId: null,
			mcpEnabled: false,
		});
	});

	test("fills defaults for null/undefined", () => {
		expect(resolveAgentSettings(null)).toEqual(resolveAgentSettings({}));
		expect(resolveAgentSettings(undefined)).toEqual(resolveAgentSettings({}));
	});

	test("keeps saved values and only fills missing keys", () => {
		expect(resolveAgentSettings({ mcpEnabled: true })).toEqual({
			allowApiTokens: true,
			allowWriteTools: true,
			cliClientId: null,
			mcpEnabled: true,
		});
	});

	test("ignores an invalid shape instead of throwing", () => {
		expect(() =>
			resolveAgentSettings({ mcpEnabled: "not-a-boolean" } as never)
		).not.toThrow();
	});

	test("round-trips a stored cliClientId", () => {
		expect(resolveAgentSettings({ cliClientId: "cli_abc" }).cliClientId).toBe(
			"cli_abc"
		);
	});
});
