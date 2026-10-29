import { parseArgs } from "node:util";

import { createClient, describeError } from "../client";
import { resolveUrl, writeConfig } from "../config";
import { fail, printJson, printLine } from "../output";

const DEVICE_SCOPE = "openid profile offline_access mcp:read mcp:write";
const POLL_INTERVAL_FLOOR_MS = 1000;

interface DeviceCodeResponse {
	device_code: string;
	expires_in: number;
	interval?: number;
	user_code: string;
	verification_uri: string;
	verification_uri_complete?: string;
}

interface TokenResponse {
	access_token: string;
	expires_in: number;
	refresh_token?: string;
}

interface TokenError {
	error: string;
	error_description?: string;
}

async function deviceLogin(url: string, clientId: string, json: boolean) {
	const codeRes = await fetch(`${url}/api/auth/device/code`, {
		body: new URLSearchParams({
			client_id: clientId,
			resource: `${url}/api/mcp`,
			scope: DEVICE_SCOPE,
		}),
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		method: "POST",
	});
	if (!codeRes.ok) {
		fail(`Could not start device login (${codeRes.status}).`, json);
	}
	const code = (await codeRes.json()) as DeviceCodeResponse;

	if (!json) {
		printLine(
			`Open ${code.verification_uri_complete ?? code.verification_uri} and approve this device.`
		);
		printLine(`Code: ${code.user_code}`);
		printLine("Waiting for approval…");
	}

	const deadline = Date.now() + code.expires_in * 1000;
	let intervalMs = Math.max(
		POLL_INTERVAL_FLOOR_MS,
		(code.interval ?? 5) * 1000
	);

	while (Date.now() < deadline) {
		// biome-ignore lint/performance/noAwaitInLoops: this is a deliberate RFC 8628 poll loop
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
		const tokenRes = await fetch(`${url}/api/auth/oauth2/token`, {
			body: new URLSearchParams({
				client_id: clientId,
				device_code: code.device_code,
				grant_type: "urn:ietf:params:oauth:grant-type:device_code",
			}),
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			method: "POST",
		});
		if (tokenRes.ok) {
			const token = (await tokenRes.json()) as TokenResponse;
			writeConfig({
				expiresAt: Math.floor(Date.now() / 1000) + token.expires_in,
				refreshToken: token.refresh_token,
				token: token.access_token,
				url,
			});
			if (json) {
				printJson({ ok: true, url });
			} else {
				printLine("Signed in.");
			}
			return;
		}
		const err = (await tokenRes.json().catch(() => null)) as TokenError | null;
		if (err?.error === "slow_down") {
			intervalMs += POLL_INTERVAL_FLOOR_MS;
			continue;
		}
		if (err?.error === "authorization_pending") {
			continue;
		}
		fail(err?.error_description ?? err?.error ?? "Device login failed.", json);
	}
	fail("Device login timed out. Run `stryveforms login` again.", json);
}

export async function loginCommand(argv: string[]): Promise<void> {
	const { values } = parseArgs({
		args: argv,
		options: {
			json: { type: "boolean" },
			token: { type: "string" },
			url: { type: "string" },
		},
	});
	const json = Boolean(values.json);
	const url = resolveUrl(values.url);

	if (values.token) {
		const client = createClient(url, values.token);
		try {
			const user = await client.me.query();
			writeConfig({ token: values.token, url });
			if (json) {
				printJson({ email: user.email, ok: true, url });
			} else {
				printLine(`Signed in as ${user.email} at ${url}.`);
			}
		} catch (error) {
			fail(describeError(error), json);
		}
		return;
	}

	// No --token: try the OAuth device flow against this server's registered
	// public CLI client (apps/server bootstraps it on startup).
	const publicClient = createClient(url, undefined);
	let info: { agent: { cliClientId: string | null } };
	try {
		info = await publicClient.instance.public.query();
	} catch (error) {
		fail(describeError(error), json);
	}
	if (!info.agent.cliClientId) {
		fail(
			"Device login isn't available on this server. Create a personal API token in Settings → Developers and run `stryveforms login --token <token>`.",
			json
		);
	}
	await deviceLogin(url, info.agent.cliClientId, json);
}
