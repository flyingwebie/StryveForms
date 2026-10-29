import { useEffect, useId, useRef } from "react";

export type CaptchaProvider = "hcaptcha" | "recaptcha" | "turnstile";

const SCRIPT_SRC: Record<CaptchaProvider, string> = {
	hcaptcha: "https://js.hcaptcha.com/1/api.js",
	recaptcha: "https://www.google.com/recaptcha/api.js",
	turnstile: "https://challenges.cloudflare.com/turnstile/v0/api.js",
};

const GLOBAL_NAME: Record<CaptchaProvider, string> = {
	hcaptcha: "hcaptcha",
	recaptcha: "grecaptcha",
	turnstile: "turnstile",
};

interface CaptchaRenderApi {
	render: (
		container: HTMLElement,
		options: { callback: (token: string) => void; sitekey: string }
	) => unknown;
}

function loadScript(src: string): Promise<void> {
	const existing = document.querySelector(`script[src="${src}"]`);
	if (existing) {
		return Promise.resolve();
	}
	return new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = src;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error(`Failed to load ${src}`));
		document.head.append(script);
	});
}

function waitForGlobal(name: string, attempts = 40): Promise<CaptchaRenderApi> {
	return new Promise((resolve, reject) => {
		let left = attempts;
		const check = () => {
			const api = (
				window as unknown as Record<string, CaptchaRenderApi | undefined>
			)[name];
			if (api?.render) {
				resolve(api);
				return;
			}
			left -= 1;
			if (left <= 0) {
				reject(new Error(`${name} did not load in time`));
				return;
			}
			setTimeout(check, 250);
		};
		check();
	});
}

export interface CaptchaWidgetProps {
	onToken: (token: string | undefined) => void;
	provider: CaptchaProvider;
	siteKey: string;
}

/** Renders hCaptcha, reCAPTCHA v2, or Turnstile — skipped entirely when the site key is empty. */
export function CaptchaWidget({
	onToken,
	provider,
	siteKey,
}: CaptchaWidgetProps) {
	const containerId = useId();
	const containerRef = useRef<HTMLDivElement>(null);
	const onTokenRef = useRef(onToken);
	onTokenRef.current = onToken;

	useEffect(() => {
		if (!siteKey) {
			return;
		}
		let cancelled = false;
		loadScript(SCRIPT_SRC[provider])
			.then(() => waitForGlobal(GLOBAL_NAME[provider]))
			.then((api) => {
				if (cancelled || !containerRef.current) {
					return;
				}
				api.render(containerRef.current, {
					callback: (token) => onTokenRef.current(token),
					sitekey: siteKey,
				});
			})
			.catch(() => onTokenRef.current(undefined));
		return () => {
			cancelled = true;
		};
	}, [provider, siteKey]);

	if (!siteKey) {
		return null;
	}

	return <div id={containerId} ref={containerRef} />;
}
