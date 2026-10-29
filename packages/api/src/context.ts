import type { Session } from "@StryveForms/auth";
import type { Database } from "@StryveForms/db";
import type { Mailer } from "@StryveForms/emails/mailer";

import type { StorageDriver } from "./services/storage";

export interface AppConfig {
	appName: string;
	/** Public URL of the web app, e.g. https://forms.example.com */
	appUrl: string;
	captcha: {
		hcaptchaSecret?: string | undefined;
		recaptchaSecret?: string | undefined;
		turnstileSecret?: string | undefined;
	};
	importRateLimitPerMinute: number;
	/** Public URL of this API server, used for file links. */
	serverUrl: string;
	/** Secret used to sign temporary file links. */
	signingSecret: string;
}

export interface Services {
	config: AppConfig;
	mailer: Mailer;
	storage: StorageDriver;
}

export interface RequestInfo {
	headers: Headers;
	ip: string | null;
}

export interface Context {
	/** Set when this request authenticated with a personal API token (Bearer) rather than a cookie session. */
	apiToken: { id: string; name: string; scope: "read" | "write" } | null;
	db: Database;
	request: RequestInfo;
	services: Services;
	session: Session | null;
}
