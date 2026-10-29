import { defineRelationsPart } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	/** Instance administrator (manages branding, registration and users). */
	isAdmin: boolean("is_admin").default(false).notNull(),
	/** Set once a TOTP authenticator has been verified (the `twoFactor` plugin). */
	twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at").notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_userId_idx").on(table.userId)]
);

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)]
);

/* -------------------------------------------------------------------------- */
/*         Two-factor auth (better-auth/plugins) + passkeys (@better-auth/passkey) */
/* -------------------------------------------------------------------------- */
/* Hand-authored from the installed plugins' schema.ts (1.7.7), for the same  */
/* reason as the MCP/OAuth tables below: `auth:generate` needs these tables   */
/* to already exist before it can boot the real auth instance to diff        */
/* against. If a future `auth:generate` run reports a mismatch, trust it.    */

/** A user's enrolled TOTP authenticator + backup codes (`twoFactor` plugin). One row per user. */
export const twoFactor = pgTable(
	"two_factor",
	{
		id: text("id").primaryKey(),
		/** The shared TOTP secret (never returned to the client). */
		secret: text("secret").notNull(),
		/** Hashed, comma-joined one-time recovery codes (never returned to the client). */
		backupCodes: text("backup_codes").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		/** False until the user confirms a 6-digit code during enrollment. */
		verified: boolean("verified").default(true).notNull(),
		failedVerificationCount: integer("failed_verification_count").default(0),
		lockedUntil: timestamp("locked_until"),
	},
	(table) => [index("two_factor_user_idx").on(table.userId)]
);

/** A registered WebAuthn credential (`@better-auth/passkey` plugin). */
export const passkey = pgTable(
	"passkey",
	{
		id: text("id").primaryKey(),
		/** User-chosen label (e.g. "MacBook Touch ID"); falls back to the authenticator's name in the UI. */
		name: text("name"),
		publicKey: text("public_key").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		credentialID: text("credential_id").notNull(),
		counter: integer("counter").notNull(),
		/** "singleDevice" or "multiDevice" (synced, e.g. iCloud Keychain). */
		deviceType: text("device_type").notNull(),
		backedUp: boolean("backed_up").notNull(),
		/** Comma-joined WebAuthn transports (e.g. "internal,hybrid"). */
		transports: text("transports"),
		createdAt: timestamp("created_at").defaultNow(),
		/** Identifies the authenticator model (1Password, Google Password Manager…) for display. */
		aaguid: text("aaguid"),
	},
	(table) => [
		index("passkey_user_idx").on(table.userId),
		index("passkey_credential_idx").on(table.credentialID),
	]
);

/* -------------------------------------------------------------------------- */
/*                 MCP / OAuth 2.1 provider (@better-auth/mcp)                */
/* -------------------------------------------------------------------------- */
/* Hand-authored from the installed @better-auth/mcp, @better-auth/oauth-     */
/* provider and better-auth jwt/device-authorization plugin schemas (1.7.7),  */
/* because `bun run auth:generate` requires these tables to already exist     */
/* before it can boot the real auth instance to diff against. If a future    */
/* `auth:generate` run reports a mismatch, trust it over this file.           */

/** Signing keys for the `jwt` plugin (issues/verifies MCP access & ID tokens). */
export const jwks = pgTable("jwks", {
	id: text("id").primaryKey(),
	publicKey: text("public_key").notNull(),
	privateKey: text("private_key").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	expiresAt: timestamp("expires_at"),
	alg: text("alg"),
	crv: text("crv"),
});

/** RFC 8628 device codes — lets the CLI sign in without a local callback listener. */
export const deviceCode = pgTable(
	"device_code",
	{
		id: text("id").primaryKey(),
		deviceCode: text("device_code").notNull().unique(),
		userCode: text("user_code").notNull().unique(),
		userId: text("user_id").references(() => user.id, {
			onDelete: "cascade",
		}),
		expiresAt: timestamp("expires_at").notNull(),
		status: text("status").notNull(),
		lastPolledAt: timestamp("last_polled_at"),
		pollingInterval: integer("polling_interval"),
		/** First-party (non-OAuth) client id, when not going through the OAuth provider. */
		clientId: text("client_id"),
		scope: text("scope"),
		/** Set by `oauthDeviceAuthorization()`: the registered OAuth client requesting this code. */
		oauthClientId: text("oauth_client_id"),
		/** RFC 8707 resources requested alongside this device code. */
		resources: jsonb("resources").$type<string[]>(),
	},
	(t) => [index("device_code_user_idx").on(t.userId)]
);

/** A registered OAuth client (MCP clients via DCR, or the CLI registered as a public native client). */
export const oauthClient = pgTable(
	"oauth_client",
	{
		id: text("id").primaryKey(),
		clientId: text("client_id").notNull().unique(),
		clientSecret: text("client_secret"),
		clientDiscoveryId: text("client_discovery_id"),
		disabled: boolean("disabled").default(false),
		skipConsent: boolean("skip_consent"),
		enableEndSession: boolean("enable_end_session"),
		subjectType: text("subject_type"),
		scopes: jsonb("scopes").$type<string[]>(),
		clientCredentialsScopes: jsonb("client_credentials_scopes")
			.$type<string[]>()
			.default([]),
		userId: text("user_id").references(() => user.id, {
			onDelete: "cascade",
		}),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
		name: text("name"),
		uri: text("uri"),
		icon: text("icon"),
		contacts: jsonb("contacts").$type<string[]>(),
		tos: text("tos"),
		policy: text("policy"),
		softwareId: text("software_id"),
		softwareVersion: text("software_version"),
		softwareStatement: text("software_statement"),
		redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
		postLogoutRedirectUris: jsonb("post_logout_redirect_uris").$type<
			string[]
		>(),
		backchannelLogoutUri: text("backchannel_logout_uri"),
		backchannelLogoutSessionRequired: boolean(
			"backchannel_logout_session_required"
		),
		tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
		applicationType: text("application_type"),
		jwks: text("jwks"),
		jwksUri: text("jwks_uri"),
		grantTypes: jsonb("grant_types").$type<string[]>(),
		responseTypes: jsonb("response_types").$type<string[]>(),
		requirePKCE: boolean("require_pkce"),
		dpopBoundAccessTokens: boolean("dpop_bound_access_tokens").default(false),
		referenceId: text("reference_id"),
		metadata: jsonb("metadata").$type<Record<string, unknown>>(),
	},
	(t) => [index("oauth_client_user_idx").on(t.userId)]
);

/** A protected resource this server issues access tokens for (e.g. the MCP endpoint). */
export const oauthResource = pgTable("oauth_resource", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull().unique(),
	name: text("name").notNull(),
	accessTokenTtl: integer("access_token_ttl"),
	refreshTokenTtl: integer("refresh_token_ttl"),
	signingAlgorithm: text("signing_algorithm"),
	signingKeyId: text("signing_key_id"),
	allowedScopes: jsonb("allowed_scopes").$type<string[]>(),
	customClaims: jsonb("custom_claims").$type<Record<string, unknown>>(),
	dpopBoundAccessTokensRequired: boolean(
		"dpop_bound_access_tokens_required"
	).default(false),
	disabled: boolean("disabled").default(false),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
	policyVersion: integer("policy_version").default(0),
	metadata: jsonb("metadata").$type<Record<string, unknown>>(),
});

/** Which clients may request which resources (only authoritative when `enforcePerClientResources` is on). */
export const oauthClientResource = pgTable(
	"oauth_client_resource",
	{
		id: text("id").primaryKey(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		resourceId: text("resource_id")
			.notNull()
			.references(() => oauthResource.identifier, { onDelete: "cascade" }),
		metadata: jsonb("metadata").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(t) => [
		index("oauth_client_resource_client_idx").on(t.clientId),
		index("oauth_client_resource_resource_idx").on(t.resourceId),
		uniqueIndex("oauth_client_resource_pair_idx").on(t.clientId, t.resourceId),
	]
);

/** An opaque refresh token issued with the "offline_access" scope. */
export const oauthRefreshToken = pgTable(
	"oauth_refresh_token",
	{
		id: text("id").primaryKey(),
		token: text("token").notNull().unique(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId),
		sessionId: text("session_id").references(() => session.id, {
			onDelete: "set null",
		}),
		userId: text("user_id")
			.notNull()
			.references(() => user.id),
		referenceId: text("reference_id"),
		authorizationCodeId: text("authorization_code_id"),
		resources: jsonb("resources").$type<string[]>(),
		requestedUserInfoClaims: jsonb("requested_user_info_claims").$type<
			string[]
		>(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		revoked: timestamp("revoked"),
		rotatedAt: timestamp("rotated_at"),
		rotationReplayResponse: text("rotation_replay_response"),
		rotationReplayExpiresAt: timestamp("rotation_replay_expires_at"),
		authTime: timestamp("auth_time"),
		confirmation: jsonb("confirmation").$type<Record<string, unknown>>(),
		scopes: jsonb("scopes").$type<string[]>().notNull(),
	},
	(t) => [
		index("oauth_refresh_token_client_idx").on(t.clientId),
		index("oauth_refresh_token_session_idx").on(t.sessionId),
		index("oauth_refresh_token_user_idx").on(t.userId),
		index("oauth_refresh_token_auth_code_idx").on(t.authorizationCodeId),
	]
);

/** An opaque access token, used when the token isn't a self-contained signed JWT. */
export const oauthAccessToken = pgTable(
	"oauth_access_token",
	{
		id: text("id").primaryKey(),
		token: text("token").unique(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId),
		sessionId: text("session_id").references(() => session.id, {
			onDelete: "set null",
		}),
		userId: text("user_id").references(() => user.id),
		referenceId: text("reference_id"),
		authorizationCodeId: text("authorization_code_id"),
		resources: jsonb("resources").$type<string[]>(),
		requestedUserInfoClaims: jsonb("requested_user_info_claims").$type<
			string[]
		>(),
		refreshId: text("refresh_id").references(() => oauthRefreshToken.id),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		revoked: timestamp("revoked"),
		confirmation: jsonb("confirmation").$type<Record<string, unknown>>(),
		scopes: jsonb("scopes").$type<string[]>().notNull(),
	},
	(t) => [
		index("oauth_access_token_client_idx").on(t.clientId),
		index("oauth_access_token_session_idx").on(t.sessionId),
		index("oauth_access_token_user_idx").on(t.userId),
		index("oauth_access_token_auth_code_idx").on(t.authorizationCodeId),
		index("oauth_access_token_refresh_idx").on(t.refreshId),
	]
);

/** A user's recorded consent for a client/scope (and optional reference, e.g. workspace) combination. */
export const oauthConsent = pgTable(
	"oauth_consent",
	{
		id: text("id").primaryKey(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId),
		userId: text("user_id").references(() => user.id),
		referenceId: text("reference_id"),
		resources: jsonb("resources").$type<string[]>(),
		requestedUserInfoClaims: jsonb("requested_user_info_claims").$type<
			string[]
		>(),
		scopes: jsonb("scopes").$type<string[]>().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => [
		index("oauth_consent_client_idx").on(t.clientId),
		index("oauth_consent_user_idx").on(t.userId),
	]
);

/** Single-use replay guard for `private_key_jwt` client assertions, keyed by a digest of their `jti`. */
export const oauthClientAssertion = pgTable("oauth_client_assertion", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expires_at").notNull(),
});

export const authRelations = defineRelationsPart(
	{ user, session, account, verification, twoFactor, passkey },
	(r) => ({
		user: {
			sessions: r.many.session({
				from: r.user.id,
				to: r.session.userId,
			}),
			accounts: r.many.account({
				from: r.user.id,
				to: r.account.userId,
			}),
			twoFactors: r.many.twoFactor({
				from: r.user.id,
				to: r.twoFactor.userId,
			}),
			passkeys: r.many.passkey({
				from: r.user.id,
				to: r.passkey.userId,
			}),
		},
		session: {
			user: r.one.user({
				from: r.session.userId,
				to: r.user.id,
			}),
		},
		account: {
			user: r.one.user({
				from: r.account.userId,
				to: r.user.id,
			}),
		},
		twoFactor: {
			user: r.one.user({
				from: r.twoFactor.userId,
				to: r.user.id,
			}),
		},
		passkey: {
			user: r.one.user({
				from: r.passkey.userId,
				to: r.user.id,
			}),
		},
	})
);
