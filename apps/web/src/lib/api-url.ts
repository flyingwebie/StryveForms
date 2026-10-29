import { ENV } from "@/env";

const TRAILING_SLASHES = /\/+$/;
const DEFAULT_INTERNAL_API = "http://localhost:3000";

/**
 * Where API calls go.
 * - Browser: this app's own origin (it proxies /api and /trpc to the API
 *   server, so cookies stay first-party), unless VITE_SERVER_URL is set.
 * - Server-side rendering: SERVER_URL, the API's internal address.
 */
export function apiBase(): string {
	if (typeof window === "undefined") {
		const internal =
			typeof process === "undefined" ? undefined : process.env.SERVER_URL;
		return (internal || ENV.VITE_SERVER_URL || DEFAULT_INTERNAL_API).replace(
			TRAILING_SLASHES,
			""
		);
	}
	return (ENV.VITE_SERVER_URL || window.location.origin).replace(
		TRAILING_SLASHES,
		""
	);
}
