/**
 * Instance-wide "AI agents & MCP" settings, stored in
 * `instance_settings.agent_settings` (jsonb, default `{}`). Always read
 * through `resolveAgentSettings` so a fresh/empty row still gets sane
 * defaults, and so a future shape change can keep old data readable.
 */
import { z } from "zod";

export const agentSettingsSchema = z
	.object({
		/** Master switch. When off, /api/mcp returns 404 and the UI hides MCP instructions. */
		mcpEnabled: z.boolean().default(false),
		/** Lets users create personal API tokens at all (Settings → API tokens). */
		allowApiTokens: z.boolean().default(true),
		/** When false, every agent surface (MCP + personal tokens) is read-only, regardless of a token's own scope. */
		allowWriteTools: z.boolean().default(true),
		/**
		 * Internal, not admin-editable: the OAuth client_id of the pre-registered
		 * public "StryveForms CLI" client, so `stryveforms login` can start the
		 * RFC 8628 device flow without a client secret. Set once on server
		 * startup — see services/agent/cli-client.ts.
		 */
		cliClientId: z.string().nullable().default(null),
		/**
		 * Kept passthrough so an unrelated settings subtree nested in this
		 * same `agent_settings` jsonb column (e.g. `media`, Unsplash config,
		 * see services/media/settings.ts) survives a read-then-write of
		 * these agent/MCP toggles instead of being stripped.
		 * `.partial()` (used by `resolveAgentSettings` below and by the
		 * admin-update input in routers/instance.ts) preserves this policy.
		 */
	})
	.passthrough();

export type AgentSettings = z.infer<typeof agentSettingsSchema>;

const DEFAULT_AGENT_SETTINGS: AgentSettings = {
	allowApiTokens: true,
	allowWriteTools: true,
	cliClientId: null,
	mcpEnabled: false,
};

/** Fills in defaults for any key missing from the stored jsonb (including a totally empty `{}`). */
export function resolveAgentSettings(
	raw: Record<string, unknown> | null | undefined
): AgentSettings {
	const parsed = agentSettingsSchema.partial().safeParse(raw ?? {});
	return { ...DEFAULT_AGENT_SETTINGS, ...(parsed.success ? parsed.data : {}) };
}
