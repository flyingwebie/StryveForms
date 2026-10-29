/**
 * Instance-wide Unsplash configuration for the shared `ImagePicker`
 * (apps/web/src/components/app/media/**). Admin-only, set in
 * Admin → "Images & Unsplash" (apps/web/src/components/app/admin/media-tab.tsx).
 *
 * Storage: nested as `media` inside `instance_settings.agent_settings`
 * (jsonb, default `{}`), reusing an existing jsonb column rather than
 * adding one. `agent_settings` was chosen over
 * `email_settings`/`backup_settings` because its own update path
 * (routers/instance.ts `agent.settings.update`) always merges
 * `{...resolveAgentSettings(current), ...input}` rather than overwriting the
 * whole column — so this `media` subtree survives an admin toggling MCP
 * settings, as long as `resolveAgentSettings` doesn't strip it. That read
 * path now keeps unknown keys via `agentSettingsSchema.passthrough()` (see
 * services/agent/settings.ts, edited for this) specifically so `media`
 * round-trips safely. If a future change wants a dedicated column for this,
 * that's a clean, additive migration — nothing here depends on the nesting.
 *
 * The access key itself is never stored in plaintext: see
 * `unsplashAccessKeyEncrypted`, encrypted with services/ai/crypto.ts
 * (AES-256-GCM, key derived from BETTER_AUTH_SECRET) — the same scheme
 * already used for workspace AI provider keys. Decrypt only on the server,
 * right before calling the Unsplash API; never send it to the browser.
 */

import type { Database } from "@StryveForms/db";
import { instanceSettings } from "@StryveForms/db/schema/forms";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
	clearInstanceCache,
	getInstanceSettings,
	INSTANCE_ID,
} from "../instance";

export const mediaSettingsSchema = z.object({
	/** Master switch, independent of whether a key is saved — lets an admin keep a key on file but turn the tab off. */
	unsplashEnabled: z.boolean().default(false),
	/** AES-256-GCM ciphertext (base64) of the Unsplash Access Key, or null if none is saved. */
	unsplashAccessKeyEncrypted: z.string().nullable().default(null),
});

export type MediaSettings = z.infer<typeof mediaSettingsSchema>;

const DEFAULT_MEDIA_SETTINGS: MediaSettings = {
	unsplashAccessKeyEncrypted: null,
	unsplashEnabled: false,
};

/** Fills in defaults for a missing/partial `media` subtree (including a brand-new instance's empty `{}`). */
export function resolveMediaSettings(
	agentSettingsRaw: Record<string, unknown> | null | undefined
): MediaSettings {
	const raw = (agentSettingsRaw as { media?: unknown } | null | undefined)
		?.media;
	const parsed = mediaSettingsSchema
		.partial()
		.safeParse(raw && typeof raw === "object" ? raw : {});
	return { ...DEFAULT_MEDIA_SETTINGS, ...(parsed.success ? parsed.data : {}) };
}

/** Reads this instance's Unsplash settings. */
export async function getMediaSettings(db: Database): Promise<MediaSettings> {
	const settings = await getInstanceSettings(db);
	return resolveMediaSettings(settings.agentSettings);
}

/**
 * Merges `patch` into the saved `media` subtree without disturbing the rest
 * of `agent_settings` (MCP toggles, `cliClientId`…) — reads the raw column,
 * replaces only the `media` key, writes it back.
 */
export async function updateMediaSettings(
	db: Database,
	patch: Partial<MediaSettings>
): Promise<MediaSettings> {
	const settings = await getInstanceSettings(db);
	const currentRaw = (settings.agentSettings ?? {}) as Record<string, unknown>;
	const nextMedia: MediaSettings = {
		...resolveMediaSettings(settings.agentSettings),
		...patch,
	};
	await db
		.update(instanceSettings)
		.set({ agentSettings: { ...currentRaw, media: nextMedia } })
		.where(eq(instanceSettings.id, INSTANCE_ID));
	clearInstanceCache();
	return nextMedia;
}
