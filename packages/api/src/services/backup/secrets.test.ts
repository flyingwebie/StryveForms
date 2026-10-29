import { describe, expect, test } from "bun:test";

import {
	isSecretRefPlaceholder,
	resolveSecretRefs,
	sanitizeIntegrationFields,
	sanitizeWorkspaceSettings,
} from "./secrets";

describe("sanitizeIntegrationFields", () => {
	test("blanks secret fields and records nothing when includeSecrets is false", () => {
		const secrets = new Map<string, string>();
		const result = sanitizeIntegrationFields(
			"row-1",
			{ webhook_secret: "shh", webhook_url: "https://hooks.example/abc" },
			{ auth_token: "bearer-token" },
			{
				includeSecrets: false,
				onSecret: (ref, value) => secrets.set(ref, value),
			}
		);
		expect(result.hadSecret).toBe(true);
		expect(result.data.webhook_secret).toBe("");
		expect(result.data.webhook_url).toBe("");
		expect(result.settings.auth_token).toBe("");
		expect(secrets.size).toBe(0);
	});

	test("replaces secret fields with a secretRef and records the plaintext when includeSecrets is true", () => {
		const secrets = new Map<string, string>();
		const result = sanitizeIntegrationFields(
			"row-1",
			{ webhook_secret: "shh" },
			{ auth_token: "bearer-token" },
			{
				includeSecrets: true,
				onSecret: (ref, value) => secrets.set(ref, value),
			}
		);
		expect(result.hadSecret).toBe(true);
		expect(isSecretRefPlaceholder(result.data.webhook_secret)).toBe(true);
		expect(isSecretRefPlaceholder(result.settings.auth_token)).toBe(true);
		expect(secrets.get("integration:row-1:data.webhook_secret")).toBe("shh");
		expect(secrets.get("integration:row-1:settings.auth_token")).toBe(
			"bearer-token"
		);
	});

	test("hadSecret is false and nothing changes when there's no secret field set", () => {
		const result = sanitizeIntegrationFields(
			"row-1",
			{ some_other_field: "value" },
			{},
			{ includeSecrets: false, onSecret: () => undefined }
		);
		expect(result.hadSecret).toBe(false);
		expect(result.data.some_other_field).toBe("value");
	});
});

describe("sanitizeWorkspaceSettings", () => {
	test("blanks the SMTP password when includeSecrets is false", () => {
		const result = sanitizeWorkspaceSettings(
			"ws-1",
			{ smtp: { host: "smtp.example", password: "pw" } },
			{ includeSecrets: false, onSecret: () => undefined }
		);
		expect(result.hadSecret).toBe(true);
		expect((result.settings.smtp as { password: string }).password).toBe("");
		expect((result.settings.smtp as { host: string }).host).toBe(
			"smtp.example"
		);
	});

	test("is a no-op when there's no SMTP password configured", () => {
		const settings = { smtp: { host: "smtp.example" } };
		const result = sanitizeWorkspaceSettings("ws-1", settings, {
			includeSecrets: false,
			onSecret: () => undefined,
		});
		expect(result.hadSecret).toBe(false);
		expect(result.settings).toBe(settings);
	});
});

describe("resolveSecretRefs", () => {
	test("resolves a secretRef placeholder from the decrypted map", () => {
		const secrets = new Map([["integration:row-1:data.webhook_secret", "shh"]]);
		const value: Record<string, unknown> = {
			webhook_secret: { secretRef: "integration:row-1:data.webhook_secret" },
		};
		expect(resolveSecretRefs(value, secrets)).toEqual({
			webhook_secret: "shh",
		});
	});

	test("blanks a placeholder when the secret isn't in the map (no passphrase / skipped)", () => {
		const value: Record<string, unknown> = {
			webhook_secret: { secretRef: "missing:ref" },
		};
		expect(resolveSecretRefs(value, null)).toEqual({ webhook_secret: "" });
	});

	test("walks arrays and nested objects", () => {
		const secrets = new Map([["a", "resolved-a"]]);
		const value = {
			items: [{ token: { secretRef: "a" } }, { token: "plain" }],
		};
		expect(resolveSecretRefs(value, secrets)).toEqual({
			items: [{ token: "resolved-a" }, { token: "plain" }],
		});
	});

	test("leaves ordinary values untouched", () => {
		const value = { count: 3, name: "plain string" };
		expect(resolveSecretRefs(value, new Map())).toEqual(value);
	});
});
