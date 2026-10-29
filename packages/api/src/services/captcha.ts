import type { AppConfig } from "../context";

const VERIFY_URLS = {
	hcaptcha: "https://api.hcaptcha.com/siteverify",
	recaptcha: "https://www.google.com/recaptcha/api/siteverify",
	turnstile: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
} as const;

export type CaptchaProvider = keyof typeof VERIFY_URLS;

function secretFor(
	config: AppConfig,
	provider: CaptchaProvider
): string | undefined {
	switch (provider) {
		case "hcaptcha":
			return config.captcha.hcaptchaSecret;
		case "recaptcha":
			return config.captcha.recaptchaSecret;
		default:
			return config.captcha.turnstileSecret;
	}
}

/**
 * Checks a captcha token with the provider. Returns true when the instance
 * has no secret configured for that provider (captcha can't be enforced).
 */
export async function verifyCaptcha(
	config: AppConfig,
	provider: CaptchaProvider,
	token: string | undefined,
	ip: string | null
): Promise<boolean> {
	const secret = secretFor(config, provider);
	if (!secret) {
		return true;
	}
	if (!token) {
		return false;
	}
	const body = new URLSearchParams({ response: token, secret });
	if (ip) {
		body.set("remoteip", ip);
	}
	try {
		const response = await fetch(VERIFY_URLS[provider], {
			body,
			method: "POST",
		});
		const result = (await response.json()) as { success?: boolean };
		return result.success === true;
	} catch {
		return false;
	}
}
