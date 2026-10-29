import type { Context, Next } from "hono";

import { clientIp } from "./context";

interface Bucket {
	count: number;
	resetAt: number;
}

/**
 * Small in-memory fixed-window rate limiter, keyed by client IP.
 * Good enough for a single server; use a shared store when running several.
 */
export function rateLimit({
	limit,
	windowMs,
}: {
	limit: number;
	windowMs: number;
}) {
	const buckets = new Map<string, Bucket>();
	let lastSweep = Date.now();

	return async (c: Context, next: Next) => {
		const now = Date.now();
		if (now - lastSweep > windowMs) {
			for (const [key, bucket] of buckets) {
				if (bucket.resetAt <= now) {
					buckets.delete(key);
				}
			}
			lastSweep = now;
		}
		const key = clientIp(c) ?? "unknown";
		const bucket = buckets.get(key);
		if (!bucket || bucket.resetAt <= now) {
			buckets.set(key, { count: 1, resetAt: now + windowMs });
		} else {
			bucket.count += 1;
			if (bucket.count > limit) {
				c.header(
					"Retry-After",
					String(Math.ceil((bucket.resetAt - now) / 1000))
				);
				return c.json(
					{ message: "Too many requests. Please try again in a moment." },
					429
				);
			}
		}
		await next();
	};
}
