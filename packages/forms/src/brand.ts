/**
 * Workspace brand guideline.
 *
 * A workspace defines its brand once (colour, font, logo, shape…). Forms that
 * follow the workspace brand inherit every brand key, except the keys listed in
 * the form's `brandOverrides`, which keep the form's own value. Forms that don't
 * follow the brand (e.g. imported from OpnForm) keep all of their own values.
 */
import { z } from "zod";

import {
	BACKGROUND_IMAGE_FITS,
	BORDER_RADII,
	CLASSIC_LAYOUTS,
	type ClassicLayout,
	DARK_MODES,
	FRAME_SHADOWS,
	imageCreditSchema,
	LAYOUTS,
	LOGO_ALIGNMENTS,
	SIZES,
	THEMES,
	WIDTHS,
} from "./settings";

/** Design settings a workspace brand can set for its forms. */
export const BRAND_KEYS = [
	"color",
	"fontFamily",
	"theme",
	"borderRadius",
	"size",
	"darkMode",
	"uppercaseLabels",
	"logoPicture",
	"width",
	/** Logo shown when the resolved colour scheme is dark; falls back to `logoPicture`. */
	"logoPictureDark",
	/** "framed": the form sits inside a bordered card. "frameless": no card at all. */
	"layout",
	/** Colour behind the form, outside the card. */
	"pageBackgroundColor",
	/** Card background colour (only visible when `layout` is "framed"). */
	"frameBackgroundColor",
	/** Card border colour. */
	"frameBorderColor",
	/** Card border width, in pixels. */
	"frameBorderWidth",
	/** Card drop shadow strength. */
	"frameShadow",
	/** Full-bleed image behind the page. */
	"backgroundImage",
	"backgroundImageFit",
	"backgroundImagePositionX",
	"backgroundImagePositionY",
	/** Dark overlay over the background image, for text legibility (0-100). */
	"backgroundOverlayOpacity",
	/** Blur applied to the background image, in pixels. */
	"backgroundOverlayBlur",
	/** Attribution for `backgroundImage`, when picked from Unsplash. */
	"backgroundImageCredit",
	/** Banner image shown above the form. */
	"headerImage",
	/** Header image height, in pixels. */
	"headerImageHeight",
	/** Attribution for `headerImage`, when picked from Unsplash. */
	"headerImageCredit",
	/** Hides the "Powered by StryveForms" badge. */
	"noBranding",
	/**
	 * Classic layout preset: "card" | "card-on-background" |
	 * "header-image" | "card-with-header". See `resolveClassicLayout` below
	 * for how older forms (saved before this existed) are migrated onto one
	 * of these on read.
	 */
	"classicLayout",
	/** Shows the resolved brand logo above the Classic layout. Defaults to true. */
	"showBrandLogo",
	/** Brand logo position above the form: "left" | "center" | "right". */
	"logoAlignment",
	/** Dark-scheme page background; light colours are never reused in dark mode. */
	"pageBackgroundColorDark",
	/** Dark-scheme card background. */
	"frameBackgroundColorDark",
	/** Dark-scheme card border colour. */
	"frameBorderColorDark",
] as const;

export type BrandKey = (typeof BRAND_KEYS)[number];

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export const workspaceBrandSchema = z
	.object({
		color: z.string().regex(HEX_COLOR),
		fontFamily: z.string().max(100).nullable(),
		theme: z.enum(THEMES),
		borderRadius: z.enum(BORDER_RADII),
		size: z.enum(SIZES),
		darkMode: z.enum(DARK_MODES),
		uppercaseLabels: z.boolean(),
		logoPicture: z.string().max(2000).nullable(),
		width: z.enum(WIDTHS),
		logoPictureDark: z.string().max(2000).nullable(),
		layout: z.enum(LAYOUTS),
		pageBackgroundColor: z.string().max(30).nullable(),
		frameBackgroundColor: z.string().max(30).nullable(),
		frameBorderColor: z.string().max(30).nullable(),
		frameBorderWidth: z.number().min(0).max(12),
		frameShadow: z.enum(FRAME_SHADOWS),
		backgroundImage: z.string().max(2000).nullable(),
		backgroundImageFit: z.enum(BACKGROUND_IMAGE_FITS),
		backgroundImagePositionX: z.number().min(0).max(100),
		backgroundImagePositionY: z.number().min(0).max(100),
		backgroundOverlayOpacity: z.number().min(0).max(100),
		backgroundOverlayBlur: z.number().min(0).max(40),
		backgroundImageCredit: imageCreditSchema.nullable(),
		headerImage: z.string().max(2000).nullable(),
		headerImageHeight: z.number().min(60).max(480),
		headerImageCredit: imageCreditSchema.nullable(),
		noBranding: z.boolean(),
		classicLayout: z.enum(CLASSIC_LAYOUTS),
		showBrandLogo: z.boolean(),
		logoAlignment: z.enum(LOGO_ALIGNMENTS),
		pageBackgroundColorDark: z.string().max(30).nullable(),
		frameBackgroundColorDark: z.string().max(30).nullable(),
		frameBorderColorDark: z.string().max(30).nullable(),
	})
	.partial();

/**
 * The 23 brand keys that aren't real form columns: they live in the form's
 * `settings` jsonb blob (see `@StryveForms/forms/settings`'s `settings` field)
 * instead of their own DB column, so adding them needed no migration. Kept as
 * a loose string array (not re-deriving from BRAND_KEYS) so the list is
 * explicit about which keys need that special nested storage.
 */
export const NESTED_BRAND_KEYS = [
	"logoPictureDark",
	"layout",
	"pageBackgroundColor",
	"frameBackgroundColor",
	"frameBorderColor",
	"frameBorderWidth",
	"frameShadow",
	"backgroundImage",
	"backgroundImageFit",
	"backgroundImagePositionX",
	"backgroundImagePositionY",
	"backgroundOverlayOpacity",
	"backgroundOverlayBlur",
	"backgroundImageCredit",
	"headerImage",
	"headerImageHeight",
	"headerImageCredit",
	"classicLayout",
	"showBrandLogo",
	"logoAlignment",
	"pageBackgroundColorDark",
	"frameBackgroundColorDark",
	"frameBorderColorDark",
] as const satisfies readonly BrandKey[];

type NestedBrandKey = (typeof NESTED_BRAND_KEYS)[number];

/**
 * Pulls the nested brand-extra keys back out of a form's `settings` jsonb
 * blob as a flat partial, ready to merge alongside the form's real brand
 * columns before calling `applyWorkspaceBrand` (see
 * `@StryveForms/api/lib/serialize`'s `toPublicFormDto`). Typed to only the
 * nested keys (not all of `BrandKey`) so spreading the result onto a
 * strongly-typed DTO doesn't widen the DTO's own existing brand fields
 * (color, theme, …) to `unknown`.
 */
export function extractNestedBrandValues(
	settings: Record<string, unknown> | null | undefined
): Partial<Record<NestedBrandKey, unknown>> {
	const nested = settings ?? {};
	const result: Partial<Record<NestedBrandKey, unknown>> = {};
	for (const key of NESTED_BRAND_KEYS) {
		if (nested[key] !== undefined) {
			result[key] = nested[key];
		}
	}
	return result;
}

/** Brand values set on a workspace. Unset keys don't affect forms. */
export type WorkspaceBrand = z.infer<typeof workspaceBrandSchema>;

export const brandOverridesSchema = z.array(z.enum(BRAND_KEYS)).max(20);

export interface FormBrandLink {
	/** Keys the form sets itself even though it follows the workspace brand. */
	brandOverrides: readonly string[];
	/** Whether the form follows its workspace brand. */
	useWorkspaceBrand: boolean;
}

/** True when the form's value for `key` comes from the workspace brand. */
export function isBrandInherited(
	key: BrandKey,
	link: FormBrandLink,
	brand: WorkspaceBrand | null | undefined
): boolean {
	return (
		link.useWorkspaceBrand &&
		!link.brandOverrides.includes(key) &&
		brand?.[key] !== undefined
	);
}

/**
 * Returns the form's design values with the workspace brand applied.
 * Values the form overrides (or that the brand leaves unset) are kept.
 */
export function applyWorkspaceBrand<
	T extends Partial<Record<BrandKey, unknown>>,
>(form: T, link: FormBrandLink, brand: WorkspaceBrand | null | undefined): T {
	if (!(link.useWorkspaceBrand && brand)) {
		return form;
	}
	const result: Record<string, unknown> = { ...form };
	for (const key of BRAND_KEYS) {
		if (isBrandInherited(key, link, brand)) {
			result[key] = brand[key];
		}
	}
	return result as T;
}

/** Plain-language name for each Classic layout preset, for picker cards and read-only summaries. */
export const CLASSIC_LAYOUT_LABELS: Record<ClassicLayout, string> = {
	card: "Card",
	"card-on-background": "Card on background image",
	"card-with-header": "Card with header image",
	"header-image": "Header image",
};

/** One-line plain-language description of each Classic layout preset. */
export const CLASSIC_LAYOUT_DESCRIPTIONS: Record<ClassicLayout, string> = {
	card: "The form sits in a framed card, with no image on top.",
	"card-on-background":
		"The framed card floats over a full-page background image.",
	"card-with-header":
		"A framed card with a banner image above it, like a card with a header photo.",
	"header-image":
		"No card at all — just a banner image above the form, Google Forms style.",
};

/**
 * The form's single "top image" concept, unifying the legacy `coverPicture`
 * field (saved by early forms, but never actually rendered on the public
 * page) with the newer `headerImage` nested brand key. Migration-on-read:
 * new writes always go to `headerImage`; `coverPicture` is only ever read
 * here as a fallback for forms saved before `headerImage` existed.
 */
export function resolveTopImage(form: {
	coverPicture?: string | null;
	headerImage?: string | null;
}): string | null {
	return form.headerImage || form.coverPicture || null;
}

/**
 * Migrates a form's (or brand's) older `layout` ("framed"/"frameless") +
 * `backgroundImage`/`headerImage` combination onto one of the four curated
 * Classic layout presets (see `CLASSIC_LAYOUTS`), so forms saved before the
 * picker existed keep rendering exactly as before — this is read-only
 * migration, nothing is written back automatically.
 *
 * Priority, when `classicLayout` itself isn't set yet:
 * 1. `classicLayout` explicit value, if present — always wins.
 * 2. `layout: "frameless"` → "header-image" (frameless is the Google-Forms
 *    preset's whole identity, whether or not a banner is uploaded yet).
 * 3. A `backgroundImage` on an otherwise-framed form → "card-on-background".
 * 4. A top image (`headerImage` or legacy `coverPicture`) → "card-with-header".
 * 5. Otherwise → "card".
 *
 * Known trade-off: a pre-existing *frameless* form that also had a
 * `backgroundImage` set (an unusual combination the old free-form controls
 * allowed, but the new picker doesn't offer) migrates to "header-image" and
 * so stops showing that background image. This is the only old combination
 * the four curated presets can't represent exactly.
 */
export function resolveClassicLayout(form: {
	backgroundImage?: string | null;
	classicLayout?: ClassicLayout | null;
	coverPicture?: string | null;
	headerImage?: string | null;
	layout?: "framed" | "frameless" | null;
}): ClassicLayout {
	if (form.classicLayout) {
		return form.classicLayout;
	}
	if (form.layout === "frameless") {
		return "header-image";
	}
	if (form.backgroundImage) {
		return "card-on-background";
	}
	if (resolveTopImage(form)) {
		return "card-with-header";
	}
	return "card";
}

/** Whether the given Classic layout preset renders the form inside a framed card. */
export function isClassicLayoutFramed(layout: ClassicLayout): boolean {
	return layout !== "header-image";
}

/** Whether the given Classic layout preset shows a full-page background image. */
export function classicLayoutShowsBackgroundImage(
	layout: ClassicLayout
): boolean {
	return layout === "card-on-background";
}

/** Whether the given Classic layout preset shows a top banner image. */
export function classicLayoutShowsHeaderImage(layout: ClassicLayout): boolean {
	return layout === "header-image" || layout === "card-with-header";
}
