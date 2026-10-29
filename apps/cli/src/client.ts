/**
 * A thin, typed tRPC client pointed at `${url}/trpc`, authenticated with a
 * Bearer token (personal API token or OAuth access token — both are
 * accepted the same way by apps/server's context.ts). Every CLI command
 * calls the exact same `instance.agent.*` procedures the MCP server's tools
 * call (packages/api/src/services/agent/tools.ts) — one service layer, two
 * front-ends.
 */
import type { AppRouter } from "@StryveForms/api/routers/index";
import { createTRPCClient, httpLink, TRPCClientError } from "@trpc/client";

export class CliAuthError extends Error {}

export function createClient(url: string, token: string | undefined) {
	return createTRPCClient<AppRouter>({
		links: [
			httpLink({
				headers: token ? { Authorization: `Bearer ${token}` } : {},
				url: `${url}/trpc`,
			}),
		],
	});
}

/** Readable message for `--json` error output and for the human-friendly stderr line. */
export function describeError(error: unknown): string {
	if (error instanceof TRPCClientError) {
		const code = (error.data as { code?: string } | undefined)?.code;
		if (code === "UNAUTHORIZED") {
			return "Not signed in or your token is invalid/expired. Run `stryveforms login`.";
		}
		if (code === "FORBIDDEN") {
			return `Forbidden: ${error.message}`;
		}
		return error.message;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}
