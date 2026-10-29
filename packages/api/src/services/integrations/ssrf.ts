import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const PRIVATE_V4 = [
	/^0\./,
	/^10\./,
	/^127\./,
	/^169\.254\./,
	/^172\.(1[6-9]|2\d|3[01])\./,
	/^192\.168\./,
	/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
	/^198\.1[89]\./,
	/^2(2[4-9]|[3-5]\d)\./,
];
const PRIVATE_V6 = [/^::1$/, /^::$/, /^f[cd]/i, /^fe[89ab]/i, /^::ffff:/i];

export function isPrivateAddress(ip: string): boolean {
	if (isIP(ip) === 4) {
		return PRIVATE_V4.some((r) => r.test(ip));
	}
	return PRIVATE_V6.some((r) => r.test(ip));
}

export class UnsafeUrlError extends Error {}

/**
 * Rejects webhook URLs that point at the server's own network.
 * Set ALLOW_PRIVATE_WEBHOOKS=true for trusted self-hosted networks.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
	let url: URL;
	try {
		url = new URL(raw);
	} catch (error) {
		throw new UnsafeUrlError("Invalid URL", { cause: error });
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new UnsafeUrlError("Only http(s) URLs are allowed");
	}
	if (url.username || url.password) {
		throw new UnsafeUrlError("URLs with credentials are not allowed");
	}
	if (process.env.ALLOW_PRIVATE_WEBHOOKS === "true") {
		return url;
	}
	const host = url.hostname.replace(/^\[|\]$/g, "");
	const addresses = isIP(host)
		? [host]
		: (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
	if (addresses.length === 0) {
		throw new UnsafeUrlError("Could not resolve host");
	}
	if (addresses.some(isPrivateAddress) || host === "localhost") {
		throw new UnsafeUrlError("URLs on private networks are not allowed");
	}
	return url;
}
