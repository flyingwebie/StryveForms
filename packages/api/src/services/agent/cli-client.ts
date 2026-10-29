/**
 * One-time bootstrap: registers the "StryveForms CLI" as a public native
 * OAuth client with the device-code grant, so `stryveforms login` can run
 * the RFC 8628 device flow without ever holding a client secret. Runs once
 * per fresh database (idempotent — skips if a client id is already saved).
 *
 * Inserted directly (not through `auth.api.adminCreateOAuthClient`) because
 * that admin endpoint expects an authenticated admin session's headers —
 * there isn't one yet at server startup, and this client only needs the
 * same handful of columns the OAuth provider itself reads at the device and
 * token endpoints.
 */
import type { Database } from "@StryveForms/db";
import { oauthClient, oauthClientResource } from "@StryveForms/db/schema/auth";
import { instanceSettings } from "@StryveForms/db/schema/forms";
import { eq } from "drizzle-orm";

import { newId } from "../../lib/ids";
import {
	clearInstanceCache,
	getInstanceSettings,
	INSTANCE_ID,
} from "../instance";
import { resolveAgentSettings } from "./settings";

/** `resourceUrl` must match `mcp({ resource })` in packages/auth — the MCP endpoint this client is allowed to request tokens for. */
export async function ensureCliOAuthClient(
	db: Database,
	resourceUrl: string
): Promise<string> {
	const settings = await getInstanceSettings(db);
	const resolved = resolveAgentSettings(settings.agentSettings);
	if (resolved.cliClientId) {
		return resolved.cliClientId;
	}
	const clientId = `cli_${newId()}`;
	await db.insert(oauthClient).values({
		applicationType: "native",
		clientId,
		dpopBoundAccessTokens: false,
		grantTypes: [
			"urn:ietf:params:oauth:grant-type:device_code",
			"refresh_token",
		],
		id: newId(),
		name: "StryveForms CLI",
		// The device grant never redirects a browser through this client, but
		// the column is non-null, so store a placeholder.
		redirectUris: ["stryveforms-cli:///callback"],
		requirePKCE: false,
		scopes: ["openid", "profile", "offline_access", "mcp:read", "mcp:write"],
		tokenEndpointAuthMethod: "none",
	});
	// Links this client to the MCP protected resource, matching what dynamic
	// client registration does automatically for MCP clients.
	await db.insert(oauthClientResource).values({
		clientId,
		id: newId(),
		resourceId: resourceUrl,
	});
	await db
		.update(instanceSettings)
		.set({ agentSettings: { ...resolved, cliClientId: clientId } })
		.where(eq(instanceSettings.id, INSTANCE_ID));
	clearInstanceCache();
	return clientId;
}
