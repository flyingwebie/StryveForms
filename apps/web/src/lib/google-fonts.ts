import { useEffect } from "react";

export type FontCategory =
	| "Sans serif"
	| "Serif"
	| "Display"
	| "Handwriting"
	| "Monospace";

export interface GoogleFont {
	category: FontCategory;
	family: string;
}

/**
 * Curated Google Fonts that read well in forms. Any other Google Fonts family
 * can still be typed into the picker; these are just the suggestions.
 */
export const GOOGLE_FONTS: GoogleFont[] = [
	...[
		"Inter",
		"Roboto",
		"Open Sans",
		"Lato",
		"Montserrat",
		"Poppins",
		"Source Sans 3",
		"Nunito",
		"Nunito Sans",
		"Raleway",
		"Work Sans",
		"DM Sans",
		"Manrope",
		"Plus Jakarta Sans",
		"Outfit",
		"Figtree",
		"Geist",
		"IBM Plex Sans",
		"Rubik",
		"Karla",
		"Mulish",
		"Barlow",
		"Space Grotesk",
		"Lexend",
		"Urbanist",
	].map((family) => ({ category: "Sans serif" as const, family })),
	...[
		"Playfair Display",
		"Merriweather",
		"Lora",
		"Libre Baskerville",
		"Source Serif 4",
		"EB Garamond",
		"Crimson Pro",
		"DM Serif Display",
		"Fraunces",
		"Instrument Serif",
		"Cormorant Garamond",
		"PT Serif",
	].map((family) => ({ category: "Serif" as const, family })),
	...[
		"Bricolage Grotesque",
		"Syne",
		"Archivo",
		"Oswald",
		"Bebas Neue",
		"Abril Fatface",
	].map((family) => ({ category: "Display" as const, family })),
	...["Caveat", "Dancing Script", "Patrick Hand", "Kalam"].map((family) => ({
		category: "Handwriting" as const,
		family,
	})),
	...["JetBrains Mono", "IBM Plex Mono", "Space Mono", "Geist Mono"].map(
		(family) => ({ category: "Monospace" as const, family })
	),
];

export const FONT_CATEGORIES: FontCategory[] = [
	"Sans serif",
	"Serif",
	"Display",
	"Handwriting",
	"Monospace",
];

/** Older names Google Fonts has since renamed: we load the new family for them. */
const RENAMED: Record<string, string> = {
	"Source Sans Pro": "Source Sans 3",
	"Source Serif Pro": "Source Serif 4",
};

const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2";
const FAMILY_NAME = /^[A-Za-z0-9 ]{1,60}$/;

/** True when `family` looks like a Google Fonts family name we can request. */
export function isLoadableFontName(family: string): boolean {
	return FAMILY_NAME.test(family.trim());
}

function familyParam(family: string, weights: boolean): string {
	const name = (RENAMED[family] ?? family).trim().replaceAll(" ", "+");
	// Full weight range so labels, inputs and bold headings all render in the
	// font; Google ignores weights a family doesn't have.
	return weights ? `family=${name}:wght@400;500;600;700` : `family=${name}`;
}

/** Stylesheet URL for one family (400–700), or null for an unusable name. */
export function googleFontCssUrl(
	family: string | null | undefined
): string | null {
	if (!(family && isLoadableFontName(family))) {
		return null;
	}
	return `${GOOGLE_FONTS_CSS}?${familyParam(family, true)}&display=swap`;
}

/**
 * One small request that loads every family only for the characters of its
 * own name (`text=`), so the picker can show each option in its own font.
 */
export function googleFontsPreviewCssUrl(families: string[]): string | null {
	const loadable = families.filter(isLoadableFontName);
	if (loadable.length === 0) {
		return null;
	}
	const chars = Array.from(new Set(`${loadable.join("")}Aa`)).join("");
	const params = loadable.map((family) => familyParam(family, false)).join("&");
	return `${GOOGLE_FONTS_CSS}?${params}&text=${encodeURIComponent(chars)}&display=swap`;
}

/** CSS `font-family` value for a chosen font, with the renamed family as a fallback. */
export function fontFamilyValue(family: string): string {
	const renamed = RENAMED[family];
	return renamed
		? `"${family}", "${renamed}", ui-sans-serif, system-ui, sans-serif`
		: `"${family}", ui-sans-serif, system-ui, sans-serif`;
}

/** Adds a stylesheet `<link>` to the document head once per URL. */
export function ensureStylesheet(href: string | null) {
	if (!href || typeof document === "undefined") {
		return;
	}
	const id = `gf-${href.length}-${hash(href)}`;
	if (document.getElementById(id)) {
		return;
	}
	const link = document.createElement("link");
	link.id = id;
	link.rel = "stylesheet";
	link.href = href;
	document.head.appendChild(link);
}

function hash(value: string): string {
	let h = 0;
	for (const char of value) {
		h = (h * 31 + char.charCodeAt(0)) % 2_147_483_647;
	}
	return h.toString(36);
}

/** Loads a Google Font (400–700) into the page when `family` is set. */
export function useGoogleFont(family: string | null | undefined) {
	useEffect(() => {
		ensureStylesheet(googleFontCssUrl(family));
	}, [family]);
}
