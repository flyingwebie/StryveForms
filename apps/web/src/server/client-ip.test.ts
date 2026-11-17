import { describe, expect, it } from "bun:test";

import { resolveClientIp, trustedProxyHops } from "./client-ip";

const PROXY = "10.0.1.5";
const CLIENT = "203.0.113.7";
const SPOOFED = "1.2.3.4";

describe("resolveClientIp", () => {
	it("uses the socket address when no proxy is trusted, ignoring a sent header", () => {
		expect(
			resolveClientIp({ forwardedFor: SPOOFED, hops: 0, socketIp: CLIENT })
		).toBe(CLIENT);
	});

	it("takes the address the trusted proxy appended, not a client-sent one", () => {
		// Client sent "1.2.3.4"; the proxy appended the address it saw.
		expect(
			resolveClientIp({
				forwardedFor: `${SPOOFED}, ${CLIENT}`,
				hops: 1,
				socketIp: PROXY,
			})
		).toBe(CLIENT);
	});

	it("works when the proxy overwrites the header instead of appending", () => {
		expect(
			resolveClientIp({ forwardedFor: CLIENT, hops: 1, socketIp: PROXY })
		).toBe(CLIENT);
	});

	it("counts two trusted proxies", () => {
		expect(
			resolveClientIp({
				forwardedFor: `${SPOOFED}, ${CLIENT}, 172.70.0.1`,
				hops: 2,
				socketIp: PROXY,
			})
		).toBe(CLIENT);
	});

	it("falls back to the left-most entry when there are fewer entries than hops", () => {
		expect(
			resolveClientIp({ forwardedFor: CLIENT, hops: 3, socketIp: PROXY })
		).toBe(CLIENT);
		expect(
			resolveClientIp({ forwardedFor: null, hops: 1, socketIp: undefined })
		).toBeUndefined();
	});
});

describe("trustedProxyHops", () => {
	it("defaults to 0 for missing or invalid values", () => {
		expect(trustedProxyHops(undefined)).toBe(0);
		expect(trustedProxyHops("")).toBe(0);
		expect(trustedProxyHops("-1")).toBe(0);
		expect(trustedProxyHops("abc")).toBe(0);
	});

	it("reads a hop count and caps it", () => {
		expect(trustedProxyHops("1")).toBe(1);
		expect(trustedProxyHops("99")).toBe(10);
	});
});
