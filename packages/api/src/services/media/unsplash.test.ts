/**
 * No real Unsplash key is available in this environment, so every
 * network call here is mocked — same `globalThis.fetch`
 * swap used by services/integrations/webhook-senders.test.ts. There is no
 * live check to skip beyond that.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
	parseUnsplashPhoto,
	parseUnsplashSearchResponse,
	searchUnsplashPhotos,
	testUnsplashKey,
	triggerUnsplashDownload,
	UnsplashError,
} from "./unsplash";

const SAMPLE_PHOTO = {
	alt_description: "a mountain at sunrise",
	blur_hash: "LKO2:N%2Tw=^]~RBVZRi};RPxuwH",
	color: "#c0c0c0",
	description: null,
	height: 4000,
	id: "abc123",
	links: {
		download_location: "https://api.unsplash.com/photos/abc123/download",
		html: "https://unsplash.com/photos/abc123",
	},
	urls: {
		full: "https://images.unsplash.com/abc123?full",
		raw: "https://images.unsplash.com/abc123",
		regular: "https://images.unsplash.com/abc123?regular",
		small: "https://images.unsplash.com/abc123?small",
		thumb: "https://images.unsplash.com/abc123?thumb",
	},
	user: {
		links: { html: "https://unsplash.com/@janedoe" },
		name: "Jane Doe",
		username: "janedoe",
	},
	width: 6000,
};

describe("parseUnsplashPhoto", () => {
	test("parses a well-formed photo", () => {
		expect(parseUnsplashPhoto(SAMPLE_PHOTO)).toEqual({
			altDescription: "a mountain at sunrise",
			blurHash: "LKO2:N%2Tw=^]~RBVZRi};RPxuwH",
			color: "#c0c0c0",
			description: null,
			downloadLocation: "https://api.unsplash.com/photos/abc123/download",
			height: 4000,
			htmlLink: "https://unsplash.com/photos/abc123",
			id: "abc123",
			likelyPremium: false,
			urls: {
				full: "https://images.unsplash.com/abc123?full",
				raw: "https://images.unsplash.com/abc123",
				regular: "https://images.unsplash.com/abc123?regular",
				small: "https://images.unsplash.com/abc123?small",
				thumb: "https://images.unsplash.com/abc123?thumb",
			},
			user: {
				name: "Jane Doe",
				profileLink: "https://unsplash.com/@janedoe",
				username: "janedoe",
			},
			width: 6000,
		});
	});

	test("flags the undocumented premium_photo- id prefix as likely premium", () => {
		const premium = { ...SAMPLE_PHOTO, id: "premium_photo-abc123" };
		expect(parseUnsplashPhoto(premium)?.likelyPremium).toBe(true);
	});

	test("falls back to a derived profile link when user.links is missing", () => {
		const noLinks = {
			...SAMPLE_PHOTO,
			user: { name: "Jane Doe", username: "janedoe" },
		};
		expect(parseUnsplashPhoto(noLinks)?.user.profileLink).toBe(
			"https://unsplash.com/@janedoe"
		);
	});

	test("returns null for malformed input instead of throwing", () => {
		expect(parseUnsplashPhoto(null)).toBeNull();
		expect(parseUnsplashPhoto({})).toBeNull();
		expect(parseUnsplashPhoto({ id: "abc", urls: {} })).toBeNull();
	});
});

describe("parseUnsplashSearchResponse", () => {
	test("parses a search response, dropping malformed entries", () => {
		const result = parseUnsplashSearchResponse(
			{ results: [SAMPLE_PHOTO, { id: "broken" }], total: 42, total_pages: 2 },
			1
		);
		expect(result.photos).toHaveLength(1);
		expect(result.photos[0]?.id).toBe("abc123");
		expect(result.totalResults).toBe(42);
		expect(result.totalPages).toBe(2);
		expect(result.page).toBe(1);
	});

	test("returns an empty result for malformed input", () => {
		expect(parseUnsplashSearchResponse(null, 1)).toEqual({
			page: 1,
			photos: [],
			totalPages: 0,
			totalResults: 0,
		});
	});
});

const RATE_LIMIT_PATTERN = /rate limit/i;

let originalFetch: typeof fetch;
let captured: { headers: Record<string, string>; url: string } | null;

beforeEach(() => {
	originalFetch = globalThis.fetch;
	captured = null;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function mockFetchOnce(response: Response) {
	globalThis.fetch = ((url: string, init?: RequestInit) => {
		captured = {
			headers: (init?.headers ?? {}) as Record<string, string>,
			url: String(url),
		};
		return Promise.resolve(response);
	}) as typeof fetch;
}

/** The last fetch call's URL/headers — asserts fetch actually ran first. */
function lastRequest(): { headers: Record<string, string>; url: string } {
	if (!captured) {
		throw new Error("fetch was not called");
	}
	return captured;
}

describe("searchUnsplashPhotos", () => {
	test("sends the Client-ID header and query params, and parses results", async () => {
		mockFetchOnce(
			new Response(
				JSON.stringify({ results: [SAMPLE_PHOTO], total: 1, total_pages: 1 }),
				{ status: 200 }
			)
		);
		const result = await searchUnsplashPhotos({
			accessKey: "test-key",
			orientation: "landscape",
			query: "mountains",
		});
		expect(result.photos).toHaveLength(1);
		expect(lastRequest().url).toContain("search/photos");
		expect(lastRequest().url).toContain("query=mountains");
		expect(lastRequest().url).toContain("orientation=landscape");
		expect(lastRequest().headers.Authorization).toBe("Client-ID test-key");
	});

	test("turns a 401 into a friendly UnsplashError", async () => {
		mockFetchOnce(new Response("", { status: 401 }));
		await expect(
			searchUnsplashPhotos({ accessKey: "bad-key", query: "mountains" })
		).rejects.toThrow(UnsplashError);
	});

	test("turns a 403 into a rate-limit message", async () => {
		mockFetchOnce(new Response("", { status: 403 }));
		await expect(
			searchUnsplashPhotos({ accessKey: "test-key", query: "mountains" })
		).rejects.toThrow(RATE_LIMIT_PATTERN);
	});
});

describe("triggerUnsplashDownload", () => {
	test("GETs the download_location URL with the Client-ID header", async () => {
		mockFetchOnce(
			new Response(
				JSON.stringify({ url: "https://images.unsplash.com/abc123" }),
				{ status: 200 }
			)
		);
		await triggerUnsplashDownload({
			accessKey: "test-key",
			downloadLocation: "https://api.unsplash.com/photos/abc123/download",
		});
		expect(lastRequest().url).toBe(
			"https://api.unsplash.com/photos/abc123/download"
		);
		expect(lastRequest().headers.Authorization).toBe("Client-ID test-key");
	});

	test("refuses a non-Unsplash host, so a caller can't be tricked into an arbitrary fetch", async () => {
		await expect(
			triggerUnsplashDownload({
				accessKey: "test-key",
				downloadLocation: "https://evil.example.com/steal",
			})
		).rejects.toThrow(UnsplashError);
	});

	test("rejects a malformed URL", async () => {
		await expect(
			triggerUnsplashDownload({
				accessKey: "test-key",
				downloadLocation: "not-a-url",
			})
		).rejects.toThrow(UnsplashError);
	});
});

describe("testUnsplashKey", () => {
	test("reports ok with the remaining rate limit when the key works", async () => {
		mockFetchOnce(
			new Response(JSON.stringify({ results: [], total: 0, total_pages: 0 }), {
				headers: { "X-Ratelimit-Limit": "50", "X-Ratelimit-Remaining": "49" },
				status: 200,
			})
		);
		const result = await testUnsplashKey({ accessKey: "test-key" });
		expect(result.ok).toBe(true);
		expect(result.message).toContain("49/50");
	});

	test("reports not-ok for an invalid key", async () => {
		mockFetchOnce(new Response("", { status: 401 }));
		const result = await testUnsplashKey({ accessKey: "bad-key" });
		expect(result.ok).toBe(false);
	});
});
