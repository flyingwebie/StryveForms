import type { AppConfig, Services } from "@StryveForms/api/context";
import { emailBranding } from "@StryveForms/api/services/instance";
import { createStorage } from "@StryveForms/api/services/storage";
import { createAuth } from "@StryveForms/auth";
import { createDb } from "@StryveForms/db";
import { createMailer } from "@StryveForms/emails/mailer";
import { emails } from "@StryveForms/emails/messages";

import { ENV } from "./env.server";

const DEFAULT_IMPORT_RATE = 60;

export const db = createDb(ENV);

export const config: AppConfig = {
	appName: ENV.APP_NAME ?? "StryveForms",
	appUrl: ENV.APP_URL.replace(/\/$/, ""),
	captcha: {
		hcaptchaSecret: ENV.HCAPTCHA_SECRET_KEY || undefined,
		recaptchaSecret: ENV.RECAPTCHA_SECRET_KEY || undefined,
		turnstileSecret: ENV.TURNSTILE_SECRET_KEY || undefined,
		hcaptchaSiteKey: ENV.HCAPTCHA_SITE_KEY || undefined,
		recaptchaSiteKey: ENV.RECAPTCHA_SITE_KEY || undefined,
		turnstileSiteKey: ENV.TURNSTILE_SITE_KEY || undefined,
	},
	importRateLimitPerMinute:
		ENV.OPNFORM_IMPORT_RATE_LIMIT ?? DEFAULT_IMPORT_RATE,
	serverUrl: ENV.BETTER_AUTH_URL.replace(/\/$/, ""),
	signingSecret: ENV.BETTER_AUTH_SECRET,
};

export const services: Services = {
	config,
	mailer: createMailer({
		MAIL_FROM: ENV.MAIL_FROM,
		SMTP_HOST: ENV.SMTP_HOST,
		SMTP_PASSWORD: ENV.SMTP_PASSWORD,
		SMTP_PORT: ENV.SMTP_PORT,
		SMTP_SECURE: ENV.SMTP_SECURE,
		SMTP_USER: ENV.SMTP_USER,
	}),
	storage: createStorage({
		S3_ACCESS_KEY_ID: ENV.S3_ACCESS_KEY_ID,
		S3_BUCKET: ENV.S3_BUCKET,
		S3_ENDPOINT: ENV.S3_ENDPOINT,
		S3_REGION: ENV.S3_REGION,
		S3_SECRET_ACCESS_KEY: ENV.S3_SECRET_ACCESS_KEY,
		STORAGE_DRIVER: ENV.STORAGE_DRIVER,
		STORAGE_PATH: ENV.STORAGE_PATH,
	}),
};

/** Extra origins allowed to sign in (comma separated), plus local dev ports in development. */
const extraOrigins = [
	...(process.env.TRUSTED_ORIGINS ?? "")
		.split(",")
		.map((o) => o.trim())
		.filter(Boolean),
	...(ENV.NODE_ENV === "development"
		? [
				"http://localhost:3101",
				"http://localhost:3102",
				"http://localhost:3103",
				"http://localhost:3104",
			]
		: []),
];

export const auth = createAuth(ENV, db, {
	appName: config.appName,
	desktopOrigins: extraOrigins,
	webauthnRpId: ENV.WEBAUTHN_RP_ID || undefined,
	emails: {
		async sendAuthLink({ kind, name, to, url }) {
			await services.mailer.send({
				react: emails.authLink({
					branding: await emailBranding(db, config),
					kind,
					name,
					url,
				}),
				subject:
					kind === "verify-email"
						? "Confirm your email"
						: "Reset your password",
				to,
			});
		},
		// Email-OTP fallback for people without an authenticator app — see
		// Settings → Account → Two-factor authentication.
		async sendTwoFactorOtp({ code, name, to }) {
			await services.mailer.send({
				react: emails.twoFactorOtp({
					branding: await emailBranding(db, config),
					code,
					name,
				}),
				subject: `Your sign-in code is ${code}`,
				to,
			});
		},
	},
});
