/**
 * Works out the respondent's real IP address for the API, which uses it to
 * limit password guesses, sign-ins, uploads and submissions per client.
 *
 * `X-Forwarded-For` is a list each proxy appends to, so its left-most entries
 * are whatever the client chose to send. Only the entries added by proxies we
 * run can be trusted. `TRUSTED_PROXY_HOPS` says how many of those sit in front
 * of the web app:
 *
 *   0 (default) — the web app faces the internet: use the socket address.
 *   1           — one reverse proxy (Coolify's Traefik, nginx, Caddy…).
 *   2           — e.g. Cloudflare in front of that proxy.
 *
 * Counting from the right of `[...X-Forwarded-For, socket address]`, the entry
 * `hops` places in is the address the outermost trusted proxy saw.
 */

const MAX_HOPS = 10;

/** Reads `TRUSTED_PROXY_HOPS`; anything missing or invalid means 0. */
export function trustedProxyHops(
	value: string | undefined = process.env.TRUSTED_PROXY_HOPS
): number {
	const hops = Number.parseInt(value ?? "", 10);
	if (!Number.isFinite(hops) || hops < 0) {
		return 0;
	}
	return Math.min(hops, MAX_HOPS);
}

export function resolveClientIp({
	forwardedFor,
	hops,
	socketIp,
}: {
	forwardedFor: string | null;
	hops: number;
	socketIp: string | undefined;
}): string | undefined {
	if (hops === 0) {
		return socketIp;
	}
	const chain = (forwardedFor ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
	if (socketIp) {
		chain.push(socketIp);
	}
	if (chain.length === 0) {
		return;
	}
	// Fewer entries than trusted hops means a proxy is missing or misconfigured;
	// the left-most entry is then the best guess left.
	return chain[Math.max(0, chain.length - 1 - hops)];
}
