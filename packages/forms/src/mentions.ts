/**
 * Mentions are inline references to an answer inside rich text, e.g. a
 * thank-you message or email subject. The markup is OpnForm-compatible:
 *
 *   <span mention="true" mention-field-id="ID" mention-field-name="Name"
 *         mention-fallback="text" contenteditable="false">Name</span>
 */

const MENTION_SPAN = /<span\b(?=[^>]*\bmention\b)[^>]*>.*?<\/span>/gis;
const TAGS = /<[^>]+>/g;
const BLOCK_END = /<\/(p|div|h[1-6]|li|tr)>|<br\s*\/?>/gi;
const SPACES = /[ \t]+/g;
const BLANK_LINES = /\n{3,}/g;

function attribute(html: string, name: string): string | null {
	const match = html.match(new RegExp(`${name}=(["'])(.*?)\\1`, "i"));
	return match?.[2] === undefined ? null : decodeEntities(match[2]);
}

const ENTITIES: Record<string, string> = {
	"&amp;": "&",
	"&#39;": "'",
	"&gt;": ">",
	"&lt;": "<",
	"&nbsp;": " ",
	"&quot;": '"',
};
const ENTITY = /&(amp|lt|gt|quot|#39|nbsp);/g;

export function decodeEntities(text: string): string {
	return text.replace(ENTITY, (m) => ENTITIES[m] ?? m);
}

export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function stripHtml(html: string): string {
	return decodeEntities(
		html
			.replace(BLOCK_END, "\n")
			.replace(TAGS, "")
			.replace(SPACES, " ")
			.replace(BLANK_LINES, "\n\n")
	).trim();
}

export interface ParsedMention {
	fallback: string | null;
	fieldId: string;
	fieldName: string | null;
	raw: string;
}

export function findMentions(html: string): ParsedMention[] {
	return [...html.matchAll(MENTION_SPAN)].flatMap(([raw]) => {
		const fieldId = attribute(raw, "mention-field-id");
		if (!fieldId) {
			return [];
		}
		return [
			{
				fallback: attribute(raw, "mention-fallback"),
				fieldId,
				fieldName: attribute(raw, "mention-field-name"),
				raw,
			},
		];
	});
}

export function mentionHtml(
	field: { id: string; name: string },
	fallback = ""
): string {
	const name = escapeHtml(field.name);
	return `<span mention="true" mention-field-id="${escapeHtml(field.id)}" mention-field-name="${name}" mention-fallback="${escapeHtml(fallback)}" contenteditable="false">${name}</span>`;
}

function isBlank(value: unknown): boolean {
	return (
		value === undefined ||
		value === null ||
		value === "" ||
		(Array.isArray(value) && value.length === 0)
	);
}

/** Display text for a value inside a mention: arrays joined, booleans as Yes/No. */
export function mentionText(value: unknown): string {
	if (Array.isArray(value)) {
		return value.map((v) => mentionText(v)).join(", ");
	}
	if (typeof value === "boolean") {
		return value ? "Yes" : "No";
	}
	if (value !== null && typeof value === "object") {
		return Object.entries(value as Record<string, unknown>)
			.map(([k, v]) => `${k}: ${mentionText(v)}`)
			.join(", ");
	}
	return value === undefined || value === null ? "" : String(value);
}

export interface ResolveOptions {
	/** Extra values (computed variables) used when no answer matches the id. */
	computed?: Record<string, unknown>;
	/** Formats a raw answer for display, e.g. turning file names into links. */
	format?: (fieldId: string, value: unknown) => unknown;
	/**
	 * html: returns HTML with mentions replaced by escaped text (default).
	 * text: returns plain text (subjects, sender names, recipients).
	 * url: like text, but each value is URL-encoded (redirect URLs).
	 */
	mode?: "html" | "text" | "url";
}

/**
 * Replaces mention spans with answer values. A mention with no answer and no
 * fallback is removed, like OpnForm's server-side parser.
 */
export function resolveMentions(
	content: string | null | undefined,
	values: Record<string, unknown>,
	options: ResolveOptions = {}
): string {
	if (!content) {
		return "";
	}
	const { computed = {}, format, mode = "html" } = options;
	const replaced = content.replace(MENTION_SPAN, (raw) => {
		const fieldId = attribute(raw, "mention-field-id");
		if (!fieldId) {
			return raw;
		}
		const fallback = attribute(raw, "mention-fallback");
		let value = fieldId in values ? values[fieldId] : computed[fieldId];
		if (format && !isBlank(value)) {
			value = format(fieldId, value);
		}
		let text: string;
		if (isBlank(value)) {
			if (fallback === null || fallback === "") {
				return "";
			}
			text = fallback;
		} else if (mode === "url" && Array.isArray(value)) {
			return value.map((v) => encodeURIComponent(mentionText(v))).join(",+");
		} else {
			text = mentionText(value);
		}
		if (mode === "url") {
			return encodeURIComponent(text);
		}
		return mode === "html" ? escapeHtml(text) : text;
	});
	return mode === "html" ? replaced : stripHtml(replaced);
}

/**
 * Resolves a logic condition's comparison value. A value that is a single
 * mention keeps the referenced answer's type (number, array…).
 */
export function resolveConditionValue(
	value: unknown,
	values: Record<string, unknown>
): unknown {
	if (typeof value !== "string" || !value.includes("mention-field-id")) {
		return value;
	}
	const mentions = findMentions(value);
	if (mentions.length === 0) {
		return value;
	}
	const [first] = mentions;
	if (
		mentions.length === 1 &&
		first &&
		stripHtml(value.replace(MENTION_SPAN, "")) === ""
	) {
		const resolved = values[first.fieldId];
		if (resolved !== undefined && resolved !== null) {
			return resolved;
		}
		return first.fallback || null;
	}
	return resolveMentions(value, values, { mode: "text" });
}
