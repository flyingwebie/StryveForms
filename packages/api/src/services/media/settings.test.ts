import { describe, expect, test } from "bun:test";

import { resolveMediaSettings } from "./settings";

describe("resolveMediaSettings", () => {
	test("defaults to disabled/no key for a brand-new instance", () => {
		expect(resolveMediaSettings({})).toEqual({
			unsplashAccessKeyEncrypted: null,
			unsplashEnabled: false,
		});
	});

	test("defaults for null/undefined agentSettings", () => {
		expect(resolveMediaSettings(null)).toEqual(resolveMediaSettings({}));
		expect(resolveMediaSettings(undefined)).toEqual(resolveMediaSettings({}));
	});

	test("reads the nested media subtree", () => {
		expect(
			resolveMediaSettings({
				media: { unsplashAccessKeyEncrypted: "cipher", unsplashEnabled: true },
			})
		).toEqual({
			unsplashAccessKeyEncrypted: "cipher",
			unsplashEnabled: true,
		});
	});

	test("ignores an unrelated agentSettings shape instead of throwing", () => {
		expect(() =>
			resolveMediaSettings({ mcpEnabled: true, cliClientId: "cli_abc" })
		).not.toThrow();
		expect(
			resolveMediaSettings({ mcpEnabled: true, cliClientId: "cli_abc" })
		).toEqual({
			unsplashAccessKeyEncrypted: null,
			unsplashEnabled: false,
		});
	});

	test("ignores a malformed media subtree instead of throwing", () => {
		expect(() =>
			resolveMediaSettings({ media: { unsplashEnabled: "yes" } } as never)
		).not.toThrow();
	});
});
