import { render } from "@react-email/render";
import { createTransport, type Transporter } from "nodemailer";
import type { ReactElement } from "react";

export interface MailerConfig {
	MAIL_FROM?: string | undefined;
	SMTP_HOST?: string | undefined;
	/**
	 * Only meaningful when SMTP_SECURE is false. True = never attempt TLS at
	 * all (plain, unencrypted SMTP) — only for a trusted local mail server.
	 */
	SMTP_IGNORE_TLS?: boolean | undefined;
	SMTP_PASSWORD?: string | undefined;
	SMTP_PORT?: number | undefined;
	/**
	 * Only meaningful when SMTP_SECURE is false. True = require the server to
	 * upgrade to TLS (STARTTLS, usually port 587) and fail if it can't. Leave
	 * unset for nodemailer's default opportunistic-TLS behaviour.
	 */
	SMTP_REQUIRE_TLS?: boolean | undefined;
	/** True = implicit TLS from the start of the connection (SSL/TLS, usually port 465). */
	SMTP_SECURE?: boolean | undefined;
	SMTP_USER?: string | undefined;
}

export interface SendEmailInput {
	attachments?: {
		content: Buffer | string;
		contentType?: string;
		filename: string;
	}[];
	/** Overrides the sender, e.g. `Acme Forms <forms@acme.com>`. */
	from?: string;
	react: ReactElement;
	replyTo?: string;
	subject: string;
	to: string | string[];
}

export interface Mailer {
	/** True when SMTP isn't configured: `send` logs the email instead of delivering it. */
	logOnly: boolean;
	send: (input: SendEmailInput) => Promise<{ messageId: string }>;
}

function buildTransport(config: MailerConfig): {
	logOnly: boolean;
	transport: Transporter;
} {
	if (!config.SMTP_HOST) {
		return {
			logOnly: true,
			transport: createTransport({ jsonTransport: true }),
		};
	}
	return {
		logOnly: false,
		transport: createTransport({
			auth: config.SMTP_USER
				? { pass: config.SMTP_PASSWORD, user: config.SMTP_USER }
				: undefined,
			host: config.SMTP_HOST,
			ignoreTLS: config.SMTP_IGNORE_TLS,
			port: config.SMTP_PORT ?? 587,
			requireTLS: config.SMTP_REQUIRE_TLS,
			secure: config.SMTP_SECURE ?? false,
		}),
	};
}

/**
 * Sends React Email templates over SMTP. Without SMTP_HOST, emails are printed
 * to the console so local development works without a mail server.
 */
export function createMailer(config: MailerConfig): Mailer {
	const { logOnly, transport } = buildTransport(config);
	const defaultFrom = config.MAIL_FROM ?? "StryveForms <no-reply@localhost>";

	return {
		logOnly,
		async send(input) {
			const [html, text] = await Promise.all([
				render(input.react),
				render(input.react, { plainText: true }),
			]);
			const info = await transport.sendMail({
				attachments: input.attachments,
				from: input.from ?? defaultFrom,
				html,
				replyTo: input.replyTo,
				subject: input.subject,
				text,
				to: input.to,
			});
			if (logOnly) {
				const recipients = Array.isArray(input.to)
					? input.to.join(", ")
					: input.to;
				console.info(
					`[mail] (SMTP not configured) to=${recipients} subject="${input.subject}"\n${text}`
				);
			}
			return { messageId: String(info.messageId ?? "") };
		},
	};
}
