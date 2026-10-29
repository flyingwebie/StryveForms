import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_SECONDS = 60 * 60;

function signature(secret: string, payload: string): string {
	return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Builds `path?expires=…&signature=…` that stays valid for `ttlSeconds`. */
export function signPath(
	secret: string,
	path: string,
	ttlSeconds = DEFAULT_TTL_SECONDS
): string {
	const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
	const sig = signature(secret, `${path}:${expires}`);
	return `${path}?expires=${expires}&signature=${sig}`;
}

export function verifySignedPath(
	secret: string,
	path: string,
	expires: string | undefined,
	sig: string | undefined
): boolean {
	if (!(expires && sig)) {
		return false;
	}
	const expiresAt = Number(expires);
	if (!Number.isFinite(expiresAt) || expiresAt < Date.now() / 1000) {
		return false;
	}
	const expected = Buffer.from(signature(secret, `${path}:${expiresAt}`));
	const given = Buffer.from(sig);
	return expected.length === given.length && timingSafeEqual(expected, given);
}

export function sha256(value: string): string {
	return createHmac("sha256", "stryveforms").update(value).digest("hex");
}
