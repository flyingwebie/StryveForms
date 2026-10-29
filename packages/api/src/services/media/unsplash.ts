/**
 * Thin, server-only client for the official Unsplash API (api.unsplash.com).
 * The Access Key never reaches the browser — every call here runs inside
 * routers/media.ts, which decrypts the admin-saved key first.
 *
 * Research done before building, with sources. See
 * apps/web/src/components/app/media/README.md for the full
 * write-up. Short version, each backed by an official Unsplash page:
 *
 * 1. An Access Key (Client-ID) is required for every call. `source.unsplash.com`,
 *    the old no-key hotlinking shortcut, was fully retired (it now 503s) —
 *    so "free Unsplash without any key" is not possible against the real
 *    API; the UI says this plainly instead of pretending otherwise.
 *    https://unsplash.com/documentation
 * 2. Rate limits: 50 requests/hour in "Demo" mode (the default for a new
 *    app); raised only after Unsplash approves a "Production" application
 *    (no fixed number is published — apply via partnerships@unsplash.com).
 *    https://help.unsplash.com/en/articles/3887917-when-should-i-apply-for-a-higher-rate-limit
 * 3. Attribution must credit the photographer and Unsplash, linking both
 *    back with `?utm_source=<app>&utm_medium=referral`:
 *    https://help.unsplash.com/en/articles/2511315-guideline-attribution
 * 4. `photo.links.download_location` must be GETed (server-side, with the
 *    Access Key) whenever a photo is actually used/inserted — it's a
 *    tracking ping only, never the image source:
 *    https://help.unsplash.com/en/articles/2511258-guideline-triggering-a-download
 * 5. Returned image URLs (images.unsplash.com) must be hotlinked, not
 *    re-hosted: https://unsplash.com/documentation
 * 6. Unsplash+ ("Premium") photos: the documented Photo object
 *    (unsplash.com/documentation) has no `premium`/`plus` field, the
 *    documented `/search/photos` parameters (query, page, per_page,
 *    order_by, collections, content_filter, color, orientation) have no
 *    license/plus filter, and Unsplash's own API Terms license every image
 *    returned by the API under the single, free "Unsplash License" —
 *    Unsplash+ has its own separate "Unsplash+ License"/"Unsplash+ Terms",
 *    sold directly on unsplash.com, not through api.unsplash.com for
 *    third-party apps (https://unsplash.com/api-terms). So: this client
 *    can only ever return free, standard-licensed photos. There is no
 *    API-supported way to fetch or filter in actual Unsplash+ results — see
 *    the README for how the picker's "Free / Premium / All" control honors
 *    that instead of faking it.
 */

const API_BASE = "https://api.unsplash.com";
const FETCH_TIMEOUT_MS = 15_000;
const UNSPLASH_HOST = "api.unsplash.com";

export class UnsplashError extends Error {}

export type UnsplashOrientation = "landscape" | "portrait" | "squarish";

export interface UnsplashPhoto {
	altDescription: string | null;
	blurHash: string | null;
	color: string | null;
	description: string | null;
	downloadLocation: string;
	height: number;
	htmlLink: string;
	id: string;
	/**
	 * Best-effort only: Unsplash's documented API never signals Unsplash+
	 * content (no field for it, see module docs above). This flags the one
	 * undocumented tell a few community scrapers of Unsplash's own website
	 * (not the registered API) have reported — an id prefixed
	 * `premium_photo-`. Treat it as a defensive guess, not a supported
	 * contract: it may never fire against api.unsplash.com, and that's
	 * expected, not a bug.
	 */
	likelyPremium: boolean;
	urls: {
		full: string;
		raw: string;
		regular: string;
		small: string;
		thumb: string;
	};
	user: { name: string; profileLink: string; username: string };
	width: number;
}

export interface UnsplashSearchResult {
	page: number;
	photos: UnsplashPhoto[];
	totalPages: number;
	totalResults: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function str(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

/** The five Unsplash CDN sizes the UI/renderer may hotlink; all five must be present. */
function parseUnsplashUrls(
	raw: Record<string, unknown>
): UnsplashPhoto["urls"] | null {
	const urls = isRecord(raw.urls) ? raw.urls : null;
	if (!urls) {
		return null;
	}
	const full = str(urls.full);
	const rawUrl = str(urls.raw);
	const regular = str(urls.regular);
	const small = str(urls.small);
	const thumb = str(urls.thumb);
	if (!(full && rawUrl && regular && small && thumb)) {
		return null;
	}
	return { full, raw: rawUrl, regular, small, thumb };
}

/** The attributed photographer: name, username, and a profile link (used in credit UI). */
function parseUnsplashUser(
	raw: Record<string, unknown>
): UnsplashPhoto["user"] | null {
	const user = isRecord(raw.user) ? raw.user : null;
	if (!user) {
		return null;
	}
	const name = str(user.name);
	const username = str(user.username);
	if (!(name && username)) {
		return null;
	}
	const userLinks = isRecord(user.links) ? user.links : null;
	return {
		name,
		profileLink:
			(userLinks && str(userLinks.html)) || `https://unsplash.com/@${username}`,
		username,
	};
}

/** Parses one Unsplash API photo object; returns null for anything malformed rather than throwing. */
export function parseUnsplashPhoto(raw: unknown): UnsplashPhoto | null {
	if (!isRecord(raw)) {
		return null;
	}
	const id = str(raw.id);
	const links = isRecord(raw.links) ? raw.links : null;
	const downloadLocation = links ? str(links.download_location) : null;
	const urls = parseUnsplashUrls(raw);
	const user = parseUnsplashUser(raw);
	if (!(id && downloadLocation && urls && user)) {
		return null;
	}
	return {
		altDescription: str(raw.alt_description),
		blurHash: str(raw.blur_hash),
		color: str(raw.color),
		description: str(raw.description),
		downloadLocation,
		height: typeof raw.height === "number" ? raw.height : 0,
		htmlLink: (links && str(links.html)) || `https://unsplash.com/photos/${id}`,
		id,
		likelyPremium: id.startsWith("premium_photo-"),
		urls,
		user,
		width: typeof raw.width === "number" ? raw.width : 0,
	};
}

/** Parses an Unsplash `/search/photos` response, dropping any malformed entries. */
export function parseUnsplashSearchResponse(
	raw: unknown,
	page: number
): UnsplashSearchResult {
	if (!isRecord(raw)) {
		return { page, photos: [], totalPages: 0, totalResults: 0 };
	}
	const results = Array.isArray(raw.results) ? raw.results : [];
	const photos = results
		.map((r) => parseUnsplashPhoto(r))
		.filter((p): p is UnsplashPhoto => p !== null);
	return {
		page,
		photos,
		totalPages: typeof raw.total_pages === "number" ? raw.total_pages : 0,
		totalResults: typeof raw.total === "number" ? raw.total : 0,
	};
}

async function unsplashFetch(
	accessKey: string,
	url: string
): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		return await fetch(url, {
			headers: {
				Authorization: `Client-ID ${accessKey}`,
				"Accept-Version": "v1",
			},
			signal: controller.signal,
		});
	} catch (error) {
		throw new UnsplashError(
			error instanceof Error && error.name === "AbortError"
				? "Timed out reaching Unsplash"
				: "Could not reach Unsplash",
			{ cause: error }
		);
	} finally {
		clearTimeout(timeout);
	}
}

async function friendlyError(response: Response): Promise<string> {
	if (response.status === 401) {
		return "Unsplash rejected this Access Key. Check it was copied in full.";
	}
	if (response.status === 403) {
		return "Unsplash rate limit reached for this key (demo keys allow 50 requests/hour). Try again shortly, or apply for Production access.";
	}
	const body = await response.text().catch(() => "");
	return `Unsplash returned an error (${response.status})${body ? `: ${body.slice(0, 200)}` : ""}`;
}

/** Searches Unsplash's free photo library. Always returns standard-licensed photos only — see module docs. */
export async function searchUnsplashPhotos(input: {
	accessKey: string;
	orientation?: UnsplashOrientation;
	page?: number;
	perPage?: number;
	query: string;
}): Promise<UnsplashSearchResult> {
	const page = input.page ?? 1;
	const perPage = Math.min(Math.max(input.perPage ?? 24, 1), 30);
	const params = new URLSearchParams({
		page: String(page),
		per_page: String(perPage),
		query: input.query,
	});
	if (input.orientation) {
		params.set("orientation", input.orientation);
	}
	const response = await unsplashFetch(
		input.accessKey,
		`${API_BASE}/search/photos?${params.toString()}`
	);
	if (!response.ok) {
		throw new UnsplashError(await friendlyError(response));
	}
	const json = await response.json().catch(() => null);
	return parseUnsplashSearchResponse(json, page);
}

/**
 * GETs `photo.links.download_location`, exactly as the Unsplash API
 * guideline requires whenever a photo is actually used (not merely
 * previewed). Only accepts an api.unsplash.com URL, so a caller can't be
 * tricked into making this server fetch an arbitrary address.
 */
export async function triggerUnsplashDownload(input: {
	accessKey: string;
	downloadLocation: string;
}): Promise<void> {
	let parsed: URL;
	try {
		parsed = new URL(input.downloadLocation);
	} catch (cause) {
		throw new UnsplashError("Not a valid download link", { cause });
	}
	if (parsed.protocol !== "https:" || parsed.host !== UNSPLASH_HOST) {
		throw new UnsplashError("Not an Unsplash download link");
	}
	const response = await unsplashFetch(input.accessKey, parsed.toString());
	if (!response.ok) {
		throw new UnsplashError(await friendlyError(response));
	}
}

/** A lightweight call used only to validate a key from the admin tab's "Test key" button. */
export async function testUnsplashKey(input: {
	accessKey: string;
}): Promise<{ message: string; ok: boolean }> {
	const response = await unsplashFetch(
		input.accessKey,
		`${API_BASE}/search/photos?query=test&per_page=1`
	);
	if (!response.ok) {
		return { message: await friendlyError(response), ok: false };
	}
	const remaining = response.headers.get("X-Ratelimit-Remaining");
	const limit = response.headers.get("X-Ratelimit-Limit");
	return {
		message:
			limit && remaining
				? `Connected — ${remaining}/${limit} requests left this hour.`
				: "Connected to Unsplash.",
		ok: true,
	};
}
