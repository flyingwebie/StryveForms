import type { Database } from "@StryveForms/db";
// biome-ignore lint/performance/noNamespaceImport: the Drizzle adapter needs the whole auth schema
import * as schema from "@StryveForms/db/schema/auth";
import {
	instanceSettings,
	workspace,
	workspaceInvite,
	workspaceMember,
} from "@StryveForms/db/schema/forms";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { mcp } from "@better-auth/mcp";
import { oauthDeviceAuthorization } from "@better-auth/oauth-provider";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { jwt, twoFactor } from "better-auth/plugins";
import { and, count, eq, gt } from "drizzle-orm";

/**
 * Scopes a personal API token or an OAuth access token can carry. "mcp:read"
 * covers every read-only MCP tool/CLI command; "mcp:write" additionally
 * allows create/update/publish actions. Kept intentionally small — this
 * mirrors the "read / write" choice users get when creating a personal API
 * token in Settings → API tokens.
 */
export const MCP_SCOPES = [
	"openid",
	"profile",
	"offline_access",
	"mcp:read",
	"mcp:write",
] as const;

export interface AuthConfig {
	APP_URL?: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	CORS_ORIGIN: string;
}

export interface AuthEmailSender {
	sendAuthLink: (input: {
		kind: "verify-email" | "reset-password";
		name?: string | null;
		to: string;
		url: string;
	}) => Promise<void>;
	/**
	 * Optional email-OTP fallback for two-factor sign-in, for people who'd
	 * rather not install an authenticator app. Omit it to offer only the
	 * authenticator-app (TOTP) method.
	 */
	sendTwoFactorOtp?: (input: {
		code: string;
		name?: string | null;
		to: string;
	}) => Promise<void>;
}

export interface AuthOptions {
	/**
	 * Default/fallback display name for the installation — shown as the TOTP
	 * issuer in authenticator apps and as the WebAuthn relying-party name,
	 * whenever a caller doesn't override it. Settings → Account overrides the
	 * TOTP issuer per-call with the live instance name (instanceSettings.name);
	 * this is just what a server-side `auth.api.*` call or a brand-new
	 * authenticator sees before that. Falls back to "StryveForms".
	 */
	appName?: string;
	desktopOrigins?: readonly string[];
	/** Sends verification and password-reset emails. */
	emails?: AuthEmailSender;
	/** Require users to verify their email before signing in. */
	requireEmailVerification?: boolean;
	/**
	 * Overrides the WebAuthn relying-party ID (passkeys only bind to one
	 * exact hostname — see `WEBAUTHN_RP_ID` in apps/server/.env.schema). Leave
	 * unset to derive it from `APP_URL`'s hostname, which is correct for the
	 * normal single-domain deployment.
	 */
	webauthnRpId?: string;
}

const DEFAULT_APP_NAME = "StryveForms";

const INSTANCE_ID = "default";
const TRAILING_SLASH = /\/$/;

/** Strips a trailing slash so joined paths never end up with "//". */
function trimSlash(url: string): string {
	return url.replace(TRAILING_SLASH, "");
}

/** The MCP protected-resource identifier: the API server's own MCP endpoint. */
export function mcpResource(env: Pick<AuthConfig, "BETTER_AUTH_URL">): string {
	return `${trimSlash(env.BETTER_AUTH_URL)}/api/mcp`;
}

async function userCount(database: Database): Promise<number> {
	const [row] = await database.select({ n: count() }).from(schema.user);
	return row?.n ?? 0;
}

/**
 * Sign-up rules: the very first account is always allowed (it becomes the
 * instance admin). After that, the instance's registration mode applies:
 * `open` lets anyone in (optionally limited to some email domains), `closed`
 * only lets in people with a pending workspace invite.
 */
async function assertCanRegister(database: Database, email: string) {
	if ((await userCount(database)) === 0) {
		return;
	}
	const address = email.toLowerCase();
	const [invite] = await database
		.select({ id: workspaceInvite.id })
		.from(workspaceInvite)
		.where(
			and(
				eq(workspaceInvite.email, address),
				eq(workspaceInvite.status, "pending"),
				gt(workspaceInvite.expiresAt, new Date())
			)
		)
		.limit(1);
	if (invite) {
		return;
	}
	const [settings] = await database
		.select()
		.from(instanceSettings)
		.where(eq(instanceSettings.id, INSTANCE_ID));
	if (settings?.registrationMode === "closed") {
		throw new APIError("FORBIDDEN", {
			message:
				"Registration is closed. Ask an administrator for an invitation.",
		});
	}
	const domains = (settings?.allowedEmailDomains ?? []).map((d) =>
		d.toLowerCase()
	);
	const domain = address.split("@")[1] ?? "";
	if (domains.length > 0 && !domains.includes(domain)) {
		throw new APIError("FORBIDDEN", {
			message: `Sign-ups are limited to ${domains.map((d) => `@${d}`).join(", ")} addresses.`,
		});
	}
}

/** Every new user gets a personal workspace so they can create forms right away. */
async function createDefaultWorkspace(
	database: Database,
	userId: string,
	name: string
) {
	const workspaceId = crypto.randomUUID();
	const [firstName] = name.trim().split(" ");
	await database.insert(workspace).values({
		icon: "📝",
		id: workspaceId,
		name: firstName ? `${firstName}'s workspace` : "My workspace",
	});
	await database
		.insert(workspaceMember)
		.values({ role: "admin", userId, workspaceId });
}

/** The first account of a fresh installation administers it. */
async function promoteFirstUser(database: Database, userId: string) {
	if ((await userCount(database)) !== 1) {
		return;
	}
	await database
		.update(schema.user)
		.set({ isAdmin: true })
		.where(eq(schema.user.id, userId));
	await database
		.insert(instanceSettings)
		.values({ id: INSTANCE_ID })
		.onConflictDoNothing();
}

export function createAuth(
	env: AuthConfig,
	database: Database,
	options: AuthOptions = {}
) {
	const {
		appName = DEFAULT_APP_NAME,
		desktopOrigins = [],
		emails,
		requireEmailVerification = false,
		webauthnRpId,
	} = options;
	const secure = env.BETTER_AUTH_URL.startsWith("https://");
	// Where the browser is sent for the OAuth login/consent/device screens —
	// the web app, not the API server. Passkeys bind to this same origin:
	// its hostname is the WebAuthn "relying party ID" (unless overridden), so
	// a passkey registered here never validates against a different domain.
	const webOrigin = trimSlash(env.APP_URL ?? env.BETTER_AUTH_URL);
	const rpId = webauthnRpId || new URL(webOrigin).hostname;
	const trustedOrigins = [
		...new Set([
			env.CORS_ORIGIN,
			env.APP_URL,
			env.BETTER_AUTH_URL,
			...desktopOrigins,
		]),
	].filter((o): o is string => Boolean(o));

	return betterAuth({
		// Default TOTP issuer / WebAuthn relying-party name (see `AuthOptions.appName`).
		appName,
		database: drizzleAdapter(database, {
			provider: "pg",
			schema,
		}),
		trustedOrigins,
		user: {
			additionalFields: {
				isAdmin: {
					defaultValue: false,
					input: false,
					required: false,
					type: "boolean",
				},
			},
		},
		emailAndPassword: {
			enabled: true,
			requireEmailVerification,
			sendResetPassword: emails
				? async ({ user, url }) => {
						await emails.sendAuthLink({
							kind: "reset-password",
							name: user.name,
							to: user.email,
							url,
						});
					}
				: undefined,
		},
		emailVerification: emails
			? {
					autoSignInAfterVerification: true,
					sendOnSignUp: requireEmailVerification,
					sendVerificationEmail: async ({ user, url }) => {
						await emails.sendAuthLink({
							kind: "verify-email",
							name: user.name,
							to: user.email,
							url,
						});
					},
				}
			: undefined,
		databaseHooks: {
			user: {
				create: {
					before: async (user) => {
						await assertCanRegister(database, user.email);
						return { data: user };
					},
					after: async (user) => {
						await promoteFirstUser(database, user.id);
						await createDefaultWorkspace(database, user.id, user.name);
					},
				},
			},
		},
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		advanced: {
			// The web app proxies /api to the API server, so cookies are first-party.
			// `Secure` only on HTTPS so plain http://localhost works in every browser.
			defaultCookieAttributes: {
				httpOnly: true,
				sameSite: "lax",
				secure,
			},
			useSecureCookies: secure,
		},
		plugins: [
			jwt(),
			// TOTP authenticator apps + backup codes, with an optional email-OTP
			// fallback (only wired up when the caller gave us a mailer for it).
			// `issuer` here is just the startup-time default; Settings → Account
			// overrides it per-call with the live instance name.
			twoFactor({
				issuer: appName,
				otpOptions: emails?.sendTwoFactorOtp
					? {
							async sendOTP({ otp, user }) {
								await emails.sendTwoFactorOtp?.({
									code: otp,
									name: user.name,
									to: user.email,
								});
							},
						}
					: undefined,
			}),
			// WebAuthn passkeys (Settings → Account → Passkeys, and "Sign in with
			// a passkey" on the login page). `rpID` must be an exact hostname the
			// browser is actually on — see `AuthOptions.webauthnRpId` for a
			// deployment where that isn't `APP_URL`'s own hostname.
			passkey({
				origin: webOrigin,
				rpID: rpId,
				rpName: appName,
			}),
			// Turns this server into an OAuth 2.1 authorization + protected
			// resource server for MCP clients (Claude Code, Cursor, Claude
			// Desktop…). MCP deprecated Dynamic Client Registration, but most
			// clients today still rely on it to self-register, so the DCR
			// fallback stays on. `mcp()` is itself the OAuth provider — don't
			// also register a separate `oauthProvider()` plugin.
			mcp({
				allowDynamicClientRegistration: true,
				allowUnauthenticatedClientRegistration: true,
				consentPage: `${webOrigin}/oauth/consent`,
				loginPage: `${webOrigin}/login`,
				resource: mcpResource(env),
				scopes: [...MCP_SCOPES],
			}),
			// Lets `stryveforms login` (the CLI) authorize in a browser without a
			// local callback listener, requesting an OAuth access token scoped
			// to the same MCP resource. The CLI is registered as a public
			// native client — see packages/api/src/services/agent/cli-client.ts.
			oauthDeviceAuthorization({
				verificationUri: `${webOrigin}/device`,
			}),
		],
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
