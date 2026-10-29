/**
 * Shared "icon" value format for the `icon` text columns on workspace,
 * folder and template rows: either a raw emoji character (e.g. "🚀"), or
 * `lucide:<icon-name>` for a Lucide icon that gets tinted with the owning
 * entity's colour. Every picker and renderer should go through these
 * helpers so the stored format stays consistent.
 */

export type ParsedIcon =
	| { kind: "emoji"; value: string }
	| { kind: "lucide"; name: string }
	| { kind: "none" };

const LUCIDE_PREFIX = "lucide:";

/** Reads a stored `icon` column value into its emoji / lucide / none form. */
export function parseIconValue(raw: string | null | undefined): ParsedIcon {
	if (!raw) {
		return { kind: "none" };
	}
	if (raw.startsWith(LUCIDE_PREFIX)) {
		const name = raw.slice(LUCIDE_PREFIX.length).trim();
		return name ? { kind: "lucide", name } : { kind: "none" };
	}
	return { kind: "emoji", value: raw };
}

/** Builds the value to store for a chosen Lucide icon name. */
export function toLucideIconValue(name: string): string {
	return `${LUCIDE_PREFIX}${name}`;
}

/** True when a stored `icon` value is a Lucide icon rather than an emoji. */
export function isLucideIconValue(raw: string | null | undefined): boolean {
	return Boolean(raw?.startsWith(LUCIDE_PREFIX));
}
