import { customAlphabet, nanoid } from "nanoid";

const slugSuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);
const NON_SLUG_CHARS = /[^a-z0-9]+/g;
const EDGE_DASHES = /(^-|-$)/g;
const COMBINING_MARKS = /[̀-ͯ]/g;
const MAX_SLUG_BASE = 60;

export function newId(): string {
	return nanoid(21);
}

/** Long, unguessable id for public links (editable submissions, invites). */
export function newPublicId(): string {
	return crypto.randomUUID();
}

export function slugify(text: string): string {
	return text
		.normalize("NFKD")
		.replace(COMBINING_MARKS, "")
		.toLowerCase()
		.replace(NON_SLUG_CHARS, "-")
		.replace(EDGE_DASHES, "")
		.slice(0, MAX_SLUG_BASE);
}

/** Same scheme as OpnForm: `title + random 6 chars`, never regenerated on update. */
export function formSlug(title: string): string {
	const base = slugify(title) || "form";
	return `${base}-${slugSuffix()}`;
}
