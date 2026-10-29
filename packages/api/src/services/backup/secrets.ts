/**
 * Finds and blanks/encrypts the secret-shaped fields inside exported rows
 * (BACKUP_DESIGN.md "Secrets"): webhook signing secrets, Bearer/Basic
 * credentials and webhook-style URLs (the URL itself is the capability for
 * Slack/Discord/n8n/etc.), custom SMTP passwords, and the AI provider key.
 * Internal to services/backup — not part of CONTRACT.md.
 *
 * Note on the instance-wide Unsplash Access Key
 * (`instance_settings.agent_settings.media.unsplashAccessKeyEncrypted`, see
 * services/media/settings.ts): it needs no handling here, and none in
 * `writeInstanceArchive`/`restoreInstanceArchive` (backup/index.ts) either.
 * That whole `instanceSettings` row is already written to and restored
 * from `data/instanceSettings.jsonl` verbatim (see `writeInstanceArchive`'s
 * "secrets are kept in plaintext inside the inner ZIP" comment) — and the
 * Unsplash key column is itself AES-256-GCM ciphertext (services/ai/crypto.ts,
 * keyed off BETTER_AUTH_SECRET), the same way `aiCredential.encryptedKey`
 * (handled below in this file, for the per-workspace export path) is
 * ciphertext even before any backup-level protection is applied. Restoring
 * an instance archive onto a different installation (different
 * BETTER_AUTH_SECRET) leaves the key undecryptable — same accepted
 * limitation `aiCredential` already has; the admin just re-enters it.
 * Unsplash has no per-workspace settings at all (it's instance-wide), so
 * the workspace export/import functions below never need to touch it.
 */

/** `formIntegration.data` keys that hold a secret (a webhook URL/HMAC secret). */
const INTEGRATION_DATA_SECRET_KEYS = [
	"webhook_url",
	"hook_url",
	"webhook_secret",
] as const;

/** `formIntegration.settings` keys that hold a secret (webhook-like auth). */
const INTEGRATION_SETTINGS_SECRET_KEYS = [
	"auth_token",
	"auth_password",
	"auth_header_value",
] as const;

export interface SanitizedIntegrationFields {
	data: Record<string, unknown>;
	/** True when at least one secret field was found — the row couldn't be fully restored without it. */
	hadSecret: boolean;
	settings: Record<string, unknown>;
}

/** A secret field's placeholder inside an exported row, in place of its real value. */
export interface SecretRefPlaceholder {
	secretRef: string;
}

export function isSecretRefPlaceholder(
	value: unknown
): value is SecretRefPlaceholder {
	return (
		!!value &&
		typeof value === "object" &&
		typeof (value as SecretRefPlaceholder).secretRef === "string"
	);
}

/**
 * Strips the known secret fields out of one integration row's `data`/
 * `settings`. With `includeSecrets`, each is replaced by a `{ secretRef }`
 * placeholder and its plaintext is handed to `onSecret` (the caller
 * collects these into the `secrets.enc` map); otherwise it's blanked.
 */
export function sanitizeIntegrationFields(
	rowId: string,
	data: Record<string, unknown>,
	settings: Record<string, unknown>,
	options: {
		includeSecrets: boolean;
		onSecret: (ref: string, value: string) => void;
	}
): SanitizedIntegrationFields {
	let hadSecret = false;
	const cleanData = { ...data };
	for (const key of INTEGRATION_DATA_SECRET_KEYS) {
		const value = cleanData[key];
		if (typeof value === "string" && value.length > 0) {
			hadSecret = true;
			cleanData[key] = sanitizeOne(
				`integration:${rowId}:data.${key}`,
				value,
				options
			);
		}
	}
	const cleanSettings = { ...settings };
	for (const key of INTEGRATION_SETTINGS_SECRET_KEYS) {
		const value = cleanSettings[key];
		if (typeof value === "string" && value.length > 0) {
			hadSecret = true;
			cleanSettings[key] = sanitizeOne(
				`integration:${rowId}:settings.${key}`,
				value,
				options
			);
		}
	}
	return { data: cleanData, hadSecret, settings: cleanSettings };
}

/** Same idea as {@link sanitizeIntegrationFields}, for `workspace.settings.smtp.password`. */
export function sanitizeWorkspaceSettings(
	workspaceId: string,
	settings: Record<string, unknown>,
	options: {
		includeSecrets: boolean;
		onSecret: (ref: string, value: string) => void;
	}
): { hadSecret: boolean; settings: Record<string, unknown> } {
	const smtp = settings.smtp as Record<string, unknown> | undefined;
	if (
		!(smtp && typeof smtp.password === "string" && smtp.password.length > 0)
	) {
		return { hadSecret: false, settings };
	}
	const ref = `workspace:${workspaceId}:settings.smtp.password`;
	return {
		hadSecret: true,
		settings: {
			...settings,
			smtp: { ...smtp, password: sanitizeOne(ref, smtp.password, options) },
		},
	};
}

function sanitizeOne(
	ref: string,
	value: string,
	options: {
		includeSecrets: boolean;
		onSecret: (ref: string, value: string) => void;
	}
): string | SecretRefPlaceholder {
	if (options.includeSecrets) {
		options.onSecret(ref, value);
		return { secretRef: ref };
	}
	return "";
}

/**
 * Reverses {@link sanitizeIntegrationFields}/{@link sanitizeWorkspaceSettings}
 * on import: resolves every `{ secretRef }` placeholder back to its
 * plaintext from the decrypted secrets map, or blanks it (`""`) when the
 * secret wasn't available (no `secrets.enc`, or the passphrase was skipped).
 */
export function resolveSecretRefs<T>(
	value: T,
	secrets: ReadonlyMap<string, string> | null
): T {
	if (Array.isArray(value)) {
		return value.map((item) => resolveSecretRefs(item, secrets)) as T;
	}
	if (isSecretRefPlaceholder(value)) {
		return (secrets?.get(value.secretRef) ?? "") as T;
	}
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value)) {
			out[key] = resolveSecretRefs(val, secrets);
		}
		return out as T;
	}
	return value;
}
