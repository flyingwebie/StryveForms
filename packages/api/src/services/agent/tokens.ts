/**
 * Personal API tokens (Settings → API tokens): a bearer credential for the
 * CLI and for any MCP/HTTP client that doesn't want the full OAuth dance.
 * The plain token is shown exactly once at creation time; only its SHA-256
 * hash is ever stored (`api_token.token_hash`), matching the column that
 * already existed before this round.
 */

import type { Session } from "@StryveForms/auth";
import type { Database } from "@StryveForms/db";
import { user as userTable } from "@StryveForms/db/schema/auth";
import { apiToken } from "@StryveForms/db/schema/forms";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";

import { newId } from "../../lib/ids";

export const TOKEN_SCOPES = ["read", "write"] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

/** Prefix makes a leaked token greppable/revokable and tells humans/scanners what it is. */
const TOKEN_PREFIX = "sfpat_";
const TOKEN_BYTES = 32;
const BEARER_HEADER = /^Bearer\s+(.+)$/i;

/** Exported for tests — it's a pure, deterministic function, so no secret is exposed by naming it. */
export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

/** A token's own abilities array carries exactly one scope marker (plus always "mcp:read"). Exported for tests. */
export function abilitiesForScope(scope: TokenScope): string[] {
	return scope === "write" ? ["read", "write"] : ["read"];
}

export function scopeFromAbilities(abilities: string[]): TokenScope {
	return abilities.includes("write") ? "write" : "read";
}

export interface CreatedApiToken {
	createdAt: Date;
	expiresAt: Date | null;
	id: string;
	name: string;
	scope: TokenScope;
	/** The plaintext token. Only returned here, at creation time — never again. */
	token: string;
}

export async function createApiToken(
	db: Database,
	userId: string,
	input: { name: string; scope: TokenScope; expiresAt?: Date | null }
): Promise<CreatedApiToken> {
	const token = `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
	const id = newId();
	const [row] = await db
		.insert(apiToken)
		.values({
			abilities: abilitiesForScope(input.scope),
			expiresAt: input.expiresAt ?? null,
			id,
			name: input.name,
			tokenHash: hashToken(token),
			userId,
		})
		.returning({
			createdAt: apiToken.createdAt,
			expiresAt: apiToken.expiresAt,
		});
	return {
		createdAt: row?.createdAt ?? new Date(),
		expiresAt: row?.expiresAt ?? null,
		id,
		name: input.name,
		scope: input.scope,
		token,
	};
}

export async function listApiTokens(db: Database, userId: string) {
	const rows = await db
		.select()
		.from(apiToken)
		.where(eq(apiToken.userId, userId))
		.orderBy(desc(apiToken.createdAt));
	return rows.map((row) => ({
		createdAt: row.createdAt,
		expiresAt: row.expiresAt,
		id: row.id,
		lastUsedAt: row.lastUsedAt,
		name: row.name,
		scope: scopeFromAbilities(row.abilities),
	}));
}

export async function revokeApiToken(
	db: Database,
	userId: string,
	tokenId: string
): Promise<boolean> {
	const deleted = await db
		.delete(apiToken)
		.where(and(eq(apiToken.id, tokenId), eq(apiToken.userId, userId)))
		.returning({ id: apiToken.id });
	return deleted.length > 0;
}

export interface VerifiedApiToken {
	name: string;
	scope: TokenScope;
	tokenId: string;
	userId: string;
}

/** Looks a bearer token up by its hash, checking it hasn't expired. Touches `lastUsedAt` (best-effort, not awaited by the caller's hot path). */
export async function verifyApiToken(
	db: Database,
	rawToken: string
): Promise<VerifiedApiToken | null> {
	if (!rawToken.startsWith(TOKEN_PREFIX)) {
		return null;
	}
	const hash = hashToken(rawToken);
	const [row] = await db
		.select()
		.from(apiToken)
		.where(
			and(
				eq(apiToken.tokenHash, hash),
				or(isNull(apiToken.expiresAt), gt(apiToken.expiresAt, new Date()))
			)
		)
		.limit(1);
	if (!row) {
		return null;
	}
	// Fire-and-forget: a slightly stale lastUsedAt is harmless, and nothing
	// here should block or fail the actual request on this write.
	db.update(apiToken)
		.set({ lastUsedAt: new Date() })
		.where(eq(apiToken.id, row.id))
		.catch((error: unknown) => {
			console.error("[api-token] failed to record lastUsedAt", error);
		});
	return {
		name: row.name,
		scope: scopeFromAbilities(row.abilities),
		tokenId: row.id,
		userId: row.userId,
	};
}

/** Whether a bearer value looks like one of our personal tokens (vs. an OAuth JWT access token). */
export function isPersonalApiToken(value: string): boolean {
	return value.startsWith(TOKEN_PREFIX);
}

const FAR_FUTURE = new Date("2999-01-01T00:00:00.000Z");

/**
 * Resolves an `Authorization: Bearer <personal token>` header into a
 * session-shaped object that `protectedProcedure` can use exactly like a
 * cookie session — this is how the CLI and any other Bearer-only HTTP
 * client reach the tRPC API. Returns `null` for anything that isn't one of
 * our tokens (including an OAuth access token — those are only valid for
 * the MCP resource, see apps/server's /api/mcp route).
 */
export async function resolveBearerSession(
	db: Database,
	authorizationHeader: string | null
): Promise<{ apiToken: VerifiedApiToken; session: Session } | null> {
	const raw = authorizationHeader?.match(BEARER_HEADER)?.[1];
	if (!(raw && isPersonalApiToken(raw))) {
		return null;
	}
	const verified = await verifyApiToken(db, raw);
	if (!verified) {
		return null;
	}
	const [userRow] = await db
		.select()
		.from(userTable)
		.where(eq(userTable.id, verified.userId))
		.limit(1);
	if (!userRow) {
		return null;
	}
	const session = {
		session: {
			createdAt: new Date(),
			expiresAt: FAR_FUTURE,
			id: `api-token:${verified.tokenId}`,
			ipAddress: null,
			token: `api-token:${verified.tokenId}`,
			updatedAt: new Date(),
			userAgent: null,
			userId: userRow.id,
		},
		user: userRow,
		// biome-ignore lint/suspicious/noExplicitAny: the real Session type comes from Better Auth's own plugin inference; this hand-built object matches its shape (session + user) but can't structurally satisfy that generic type.
	} as any as Session;
	return { apiToken: verified, session };
}
