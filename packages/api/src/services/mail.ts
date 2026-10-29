import { createMailer, type Mailer } from "@StryveForms/emails/mailer";

import type { Services } from "../context";

/**
 * How the SMTP connection is encrypted:
 * - "none": plain, unencrypted. Only for a trusted local mail server.
 * - "ssl": encrypted from the start of the connection (implicit TLS, usually port 465).
 * - "starttls": starts as plain text, then upgrades to an encrypted connection (usually port 587).
 */
export type SmtpEncryption = "none" | "ssl" | "starttls";

export const SMTP_STANDARD_PORTS: Record<SmtpEncryption, number> = {
	none: 25,
	ssl: 465,
	starttls: 587,
};

export interface WorkspaceSmtp {
	encryption?: SmtpEncryption;
	host?: string;
	password?: string;
	port?: number;
	/** Legacy field from before the encryption select existed. Still read for old data. */
	secure?: boolean;
	senderAddress?: string;
	username?: string;
}

/**
 * Normalizes a workspace's stored SMTP settings into the current three-way
 * encryption choice. Workspaces saved before the Encryption select existed
 * only had a "secure" boolean (true = SSL/TLS, false = STARTTLS), so those
 * are migrated on read and keep behaving the same way.
 */
export function resolveSmtpEncryption(
	smtp: Pick<WorkspaceSmtp, "encryption" | "secure"> | undefined
): SmtpEncryption {
	if (smtp?.encryption) {
		return smtp.encryption;
	}
	return smtp?.secure === false ? "starttls" : "ssl";
}

const cache = new Map<string, Mailer>();

/** Uses the workspace's own SMTP server when configured, else the instance mailer. */
export function workspaceMailer(
	services: Services,
	settings: Record<string, unknown>
): { mailer: Mailer; senderAddress?: string } {
	const smtp = settings.smtp as WorkspaceSmtp | undefined;
	if (!(smtp?.host && smtp.username && smtp.password)) {
		return { mailer: services.mailer };
	}
	const encryption = resolveSmtpEncryption(smtp);
	const key = `${smtp.host}:${smtp.port}:${smtp.username}:${smtp.password}:${encryption}`;
	let mailer = cache.get(key);
	if (!mailer) {
		mailer = createMailer({
			MAIL_FROM: smtp.senderAddress,
			SMTP_HOST: smtp.host,
			SMTP_IGNORE_TLS: encryption === "none",
			SMTP_PASSWORD: smtp.password,
			SMTP_PORT: smtp.port ?? SMTP_STANDARD_PORTS[encryption],
			SMTP_REQUIRE_TLS: encryption === "starttls",
			SMTP_SECURE: encryption === "ssl",
			SMTP_USER: smtp.username,
		});
		cache.set(key, mailer);
	}
	return { mailer, senderAddress: smtp.senderAddress };
}
