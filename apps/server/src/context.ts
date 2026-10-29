import type { Context as ApiContext } from "@StryveForms/api/context";
import { resolveBearerSession } from "@StryveForms/api/services/agent/tokens";
import type { Context as HonoContext } from "hono";
import { getConnInfo } from "hono/bun";

import { auth, db, services } from "./services";

export interface CreateContextOptions {
	context: HonoContext;
}

/** Client IP, honouring a reverse proxy when TRUST_PROXY=true. */
export function clientIp(c: HonoContext): string | null {
	if (process.env.TRUST_PROXY === "true") {
		const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
		if (forwarded) {
			return forwarded;
		}
	}
	try {
		return getConnInfo(c).remote.address ?? null;
	} catch {
		return null;
	}
}

export async function createContext({
	context,
}: CreateContextOptions): Promise<ApiContext> {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});
	// No cookie session (a browser call) — check for a personal API token
	// (Settings → API tokens), which is how the CLI and other Bearer-only
	// HTTP clients authenticate against the same tRPC endpoints.
	if (!session) {
		const bearer = await resolveBearerSession(
			db,
			context.req.raw.headers.get("authorization")
		);
		if (bearer) {
			return {
				apiToken: {
					id: bearer.apiToken.tokenId,
					name: bearer.apiToken.name,
					scope: bearer.apiToken.scope,
				},
				db,
				request: { headers: context.req.raw.headers, ip: clientIp(context) },
				services,
				session: bearer.session,
			};
		}
	}
	return {
		apiToken: null,
		db,
		request: { headers: context.req.raw.headers, ip: clientIp(context) },
		services,
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
