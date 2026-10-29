/**
 * Structured editing + resolution for a form's post-submit redirect URL.
 *
 * The stored value (`FormSettings.redirectUrl`) stays a single string with
 * OpnForm-compatible mention spans (see `./mentions`) — nothing new is added
 * to the schema. This module just lets the editor present that string as a
 * "base URL" plus a table of "name=value" query parameters, and lets the
 * server resolve it against real submission data.
 */

import { findMentions, mentionHtml, resolveMentions } from "./mentions";
import type { FormField } from "./types";

export interface RedirectParam {
	/** Query string parameter name, e.g. "name". Typed literally, never encoded here. */
	name: string;
	/** Raw value content: usually a single mention span, but may be literal text. */
	value: string;
}

export interface RedirectConfig {
	/** Everything before the first literal "?" (may itself contain mentions). */
	baseUrl: string;
	params: RedirectParam[];
}

// Same pattern as mentions.ts' internal MENTION_SPAN; duplicated (not exported
// there) so this module can find span boundaries without re-parsing attributes.
const MENTION_SPAN = /<span\b(?=[^>]*\bmention\b)[^>]*>.*?<\/span>/gis;

/** Splits `text` on literal occurrences of `separator`, never inside a mention span. */
function splitOutsideMentions(text: string, separator: string): string[] {
	const spans: [number, number][] = [];
	for (const match of text.matchAll(MENTION_SPAN)) {
		if (match.index !== undefined) {
			spans.push([match.index, match.index + match[0].length]);
		}
	}
	const insideSpan = (index: number) =>
		spans.some(([spanStart, spanEnd]) => index >= spanStart && index < spanEnd);

	const parts: string[] = [];
	let start = 0;
	for (let i = 0; i <= text.length - separator.length; i += 1) {
		if (insideSpan(i) || text.slice(i, i + separator.length) !== separator) {
			continue;
		}
		parts.push(text.slice(start, i));
		start = i + separator.length;
	}
	parts.push(text.slice(start));
	return parts;
}

/** Parses a stored `redirectUrl` into an editable base URL + query parameter list. */
export function parseRedirectUrl(
	raw: string | null | undefined
): RedirectConfig {
	const value = raw ?? "";
	if (!value.trim()) {
		return { baseUrl: "", params: [] };
	}
	const [baseUrl = "", ...queryParts] = splitOutsideMentions(value, "?");
	const query = queryParts.join("?");
	if (!query) {
		return { baseUrl, params: [] };
	}
	const params = splitOutsideMentions(query, "&")
		.filter((pair) => pair !== "")
		.map((pair) => {
			const [name = "", ...rest] = splitOutsideMentions(pair, "=");
			return { name, value: rest.join("=") };
		});
	return { baseUrl, params };
}

/**
 * Serializes an editable redirect config back into the stored string form.
 * Keeps every row as-is, including one the user just added and hasn't named
 * yet — `resolveRedirectUrl` is what drops nameless params from the final
 * URL, not this round-trip.
 */
export function buildRedirectUrl({ baseUrl, params }: RedirectConfig): string {
	if (params.length === 0) {
		return baseUrl;
	}
	const query = params.map((param) => `${param.name}=${param.value}`).join("&");
	return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${query}`;
}

/** The mention span to use as a parameter's value when it should "pass" a field's answer. */
export function fieldParamValue(target: { id: string; name: string }): string {
	return mentionHtml(target, "");
}

/**
 * The single field id a parameter value refers to, when it is *exactly* one
 * mention and nothing else (what the "field picker" builds). Null for a
 * literal value, a mix of text and mentions, or an empty value.
 */
export function paramFieldId(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}
	const mentions = findMentions(trimmed);
	const [only] = mentions;
	return mentions.length === 1 && only && trimmed === only.raw
		? only.fieldId
		: null;
}

export interface ResolveRedirectOptions {
	/** Extra values (computed variables) available to mentions, keyed by id. */
	computed?: Record<string, unknown>;
	/** Omit a parameter entirely when its resolved value is empty. Default true. */
	dropEmptyParams?: boolean;
	/** Formats a raw answer before it's encoded, e.g. file names to links. */
	format?: (fieldId: string, value: unknown) => unknown;
}

/**
 * Resolves a stored `redirectUrl` against real answers into a ready-to-use
 * URL, or null when there's no redirect or the result isn't a valid http(s)
 * URL. Used by the public submit flow and by the editor's live preview.
 */
export function resolveRedirectUrl(
	raw: string | null | undefined,
	values: Record<string, unknown>,
	options: ResolveRedirectOptions = {}
): string | null {
	if (!raw?.trim()) {
		return null;
	}
	const { computed, format, dropEmptyParams = true } = options;
	const { baseUrl, params } = parseRedirectUrl(raw);
	const resolveOne = (text: string) =>
		resolveMentions(text, values, { computed, format, mode: "url" });

	const resolvedBase = resolveOne(baseUrl).trim();
	const resolvedParams = params
		.map((param) => ({
			name: param.name.trim(),
			value: resolveOne(param.value),
		}))
		.filter(
			(param) => param.name !== "" && (!dropEmptyParams || param.value !== "")
		);

	const query = resolvedParams
		.map((param) => `${encodeURIComponent(param.name)}=${param.value}`)
		.join("&");
	const full = query
		? `${resolvedBase}${resolvedBase.includes("?") ? "&" : "?"}${query}`
		: resolvedBase;

	try {
		const parsed = new URL(full);
		return parsed.protocol === "http:" || parsed.protocol === "https:"
			? parsed.toString()
			: null;
	} catch {
		return null;
	}
}

const EXAMPLE_VALUES: Partial<Record<FormField["type"], unknown>> = {
	checkbox: true,
	date: "2026-01-15",
	email: "ada@example.com",
	multi_select: ["Option 1", "Option 2"],
	number: 42,
	phone_number: "+1 555 0100",
	rating: 5,
	scale: 8,
	select: "Option 1",
	slider: 50,
	text: "Ada Lovelace",
	url: "https://example.com",
};

/** A plausible example answer for a field, used by the redirect live preview. */
export function exampleFieldValue(
	field: Pick<FormField, "name" | "type">
): unknown {
	return EXAMPLE_VALUES[field.type] ?? field.name;
}
