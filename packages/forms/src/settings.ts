import { z } from "zod";

/* Enums, identical to OpnForm's Form model constants. */
export const THEMES = [
	"default",
	"simple",
	"notion",
	"minimal",
	"transparent",
] as const;
export const SIZES = ["sm", "md", "lg"] as const;
export const BORDER_RADII = ["none", "small", "full"] as const;
export const DARK_MODES = ["auto", "light", "dark"] as const;
export const WIDTHS = ["centered", "full"] as const;
/** "framed": the form sits inside a bordered card. "frameless": no card at all. */
export const LAYOUTS = ["framed", "frameless"] as const;
/**
 * Classic-style presentation presets, replacing the raw
 * `layout`/`backgroundImage`/`headerImage` combination with four curated,
 * Google-Forms-style choices shown as picker cards in the Design tab:
 * - "card": framed, no top image.
 * - "card-on-background": framed card over a full-page background image.
 * - "header-image": frameless, with a banner image on top.
 * - "card-with-header": framed, with a banner image on top.
 * See `@StryveForms/forms/brand`'s `resolveClassicLayout` for how older
 * forms (saved before this preset existed) are migrated onto one of these
 * on read.
 */
export const CLASSIC_LAYOUTS = [
	"card",
	"card-on-background",
	"header-image",
	"card-with-header",
] as const;
export type ClassicLayout = (typeof CLASSIC_LAYOUTS)[number];

/** Where the brand logo sits above the form. Unset: centred in a card, left on a frameless Focused screen. */
export const LOGO_ALIGNMENTS = ["left", "center", "right"] as const;
export type LogoAlignment = (typeof LOGO_ALIGNMENTS)[number];

/**
 * Attribution for a photo picked from Unsplash (T's `ImagePicker`,
 * `PickedImage.credit` — see apps/web/src/components/app/media/README.md).
 * Mirrors `BlockImage.credit` in `@StryveForms/forms/types`. Undefined/null
 * for an uploaded or workspace-library image — no attribution owed.
 */
export const imageCreditSchema = z.object({
	name: z.string().max(200),
	source: z.literal("unsplash"),
	url: z.string().max(2000),
});
export type ImageCredit = z.infer<typeof imageCreditSchema>;
export const FRAME_SHADOWS = ["none", "sm", "md", "lg"] as const;
export const BACKGROUND_IMAGE_FITS = ["cover", "contain"] as const;
export const FOCUSED_IMAGE_LAYOUTS = [
	"none",
	"stack",
	"split-left",
	"split-right",
	"wallpaper",
] as const;
export const VISIBILITIES = ["public", "draft", "closed"] as const;
export const PRESENTATION_STYLES = ["classic", "focused"] as const;
export const RETENTION_UNITS = ["day", "week", "month", "year"] as const;
export const CAPTCHA_PROVIDERS = [
	"recaptcha",
	"hcaptcha",
	"turnstile",
] as const;
export const ANALYTICS_PROVIDERS = [
	"meta_pixel",
	"google_analytics",
	"gtm",
] as const;
export const LANGUAGES = [
	"ar",
	"bn",
	"ca",
	"cs",
	"de",
	"en",
	"es",
	"eu",
	"fr",
	"gl",
	"hi",
	"hu",
	"it",
	"ja",
	"jv",
	"ko",
	"mr",
	"nl",
	"pa",
	"pl",
	"pt",
	"ru",
	"sk",
	"sr",
	"sv",
	"ta",
	"te",
	"tr",
	"uk",
	"ur",
	"vi",
	"zh",
] as const;

export const DEFAULT_COLOR = "#3B82F6";
export const DEFAULT_SUBMITTED_TEXT =
	"<p>Amazing, we saved your answers. Thank you for your time and have a great day!</p>";
export const DEFAULT_MAX_SUBMISSIONS_TEXT =
	"<p>This form has now reached the maximum number of allowed submissions and is now closed.</p>";

const TRACKING_ID = /^[A-Za-z0-9\-_.]+$/;
const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const MAX_FIELDS = 1000;

const looseObject = z.record(z.string(), z.unknown());

/** A field is validated loosely so OpnForm-specific keys survive round trips. */
export const fieldSchema = z
	.object({
		id: z.string().min(1).max(255),
		name: z.string().max(500),
		type: z.string().min(1).max(50),
	})
	.passthrough();

export const computedVariableSchema = z.object({
	formula: z.string().max(2000),
	id: z.string().regex(/^cv_/),
	name: z.string().min(1).max(100),
	result_type: z.enum(["auto", "number", "text"]).optional(),
});

/**
 * Brand keys a form sets itself while following its workspace brand.
 * Kept as a loose string array here (not importing from `./brand`) to avoid
 * a circular import, since `./brand` imports the enums above from this file.
 */
const formBrandOverridesSchema = z.array(z.string().max(50)).max(20);

/** Every editable setting of a form (everything except identity and ownership). */
export const formSettingsSchema = z.object({
	title: z.string().min(1).max(255),
	visibility: z.enum(VISIBILITIES),
	tags: z.array(z.string().max(100)).max(50),
	properties: z.array(fieldSchema).max(MAX_FIELDS),
	computedVariables: z.array(computedVariableSchema).max(500),

	language: z.enum(LANGUAGES),
	fontFamily: z.string().max(100).nullable(),
	customDomain: z.string().max(253).nullable(),
	size: z.enum(SIZES),
	borderRadius: z.enum(BORDER_RADII),
	theme: z.enum(THEMES),
	presentationStyle: z.enum(PRESENTATION_STYLES),
	width: z.enum(WIDTHS),
	layoutRtl: z.boolean(),
	coverPicture: z.string().max(2000).nullable(),
	coverSettings: z
		.object({
			brightness: z.number().int().min(-100).max(100).nullable().optional(),
			focal_point: z
				.object({
					x: z.number().min(0).max(100),
					y: z.number().min(0).max(100),
				})
				.nullable()
				.optional(),
		})
		.nullable(),
	logoPicture: z.string().max(2000).nullable(),
	darkMode: z.enum(DARK_MODES),
	color: z.string().regex(HEX_COLOR),
	uppercaseLabels: z.boolean(),
	/** Follows the workspace brand guideline for the keys it doesn't override. */
	useWorkspaceBrand: z.boolean(),
	/** Brand keys this form sets itself even though it follows the workspace brand. */
	brandOverrides: formBrandOverridesSchema,
	noBranding: z.boolean(),
	transparentBackground: z.boolean(),
	translations: z
		.object({ focused_next_button_text: z.string().max(50).optional() })
		.passthrough(),
	/**
	 * Grab-bag jsonb column. `auto_next`/`navigation_arrows` are focused-mode
	 * behaviour flags; the rest are round-5 brand/layout settings (see
	 * `@StryveForms/forms/brand`'s `NESTED_BRAND_KEYS`) that don't have their
	 * own DB column, so they're nested here instead — each still follows the
	 * same workspace-brand "set in brand / each form decides" pattern as the
	 * real columns above.
	 */
	settings: z
		.object({
			auto_next: z.boolean().optional(),
			navigation_arrows: z.boolean().optional(),
			logoPictureDark: z.string().max(2000).nullable().optional(),
			layout: z.enum(LAYOUTS).optional(),
			pageBackgroundColor: z.string().max(30).nullable().optional(),
			frameBackgroundColor: z.string().max(30).nullable().optional(),
			frameBorderColor: z.string().max(30).nullable().optional(),
			/** Dark-scheme counterparts of the three colours above. */
			pageBackgroundColorDark: z.string().max(30).nullable().optional(),
			frameBackgroundColorDark: z.string().max(30).nullable().optional(),
			frameBorderColorDark: z.string().max(30).nullable().optional(),
			frameBorderWidth: z.number().min(0).max(12).optional(),
			frameShadow: z.enum(FRAME_SHADOWS).optional(),
			backgroundImage: z.string().max(2000).nullable().optional(),
			backgroundImageFit: z.enum(BACKGROUND_IMAGE_FITS).optional(),
			backgroundImagePositionX: z.number().min(0).max(100).optional(),
			backgroundImagePositionY: z.number().min(0).max(100).optional(),
			backgroundOverlayOpacity: z.number().min(0).max(100).optional(),
			backgroundOverlayBlur: z.number().min(0).max(40).optional(),
			/** Attribution for `backgroundImage`, when picked from Unsplash. */
			backgroundImageCredit: imageCreditSchema.nullable().optional(),
			headerImage: z.string().max(2000).nullable().optional(),
			headerImageHeight: z.number().min(60).max(480).optional(),
			/** Attribution for `headerImage`, when picked from Unsplash. */
			headerImageCredit: imageCreditSchema.nullable().optional(),
			/** Form-level default image layout for newly-added focused-mode questions. */
			focusedImageLayoutDefault: z.enum(FOCUSED_IMAGE_LAYOUTS).optional(),
			/** Round-7 Classic layout preset. See `CLASSIC_LAYOUTS` above. */
			classicLayout: z.enum(CLASSIC_LAYOUTS).optional(),
			/** Shows the resolved brand logo for the Classic layout. Defaults to true. */
			showBrandLogo: z.boolean().optional(),
			/** Brand logo position: left / center / right. */
			logoAlignment: z.enum(LOGO_ALIGNMENTS).optional(),
		})
		.passthrough(),

	customCode: z.string().max(100_000).nullable(),
	customCss: z.string().max(100_000).nullable(),

	submitButtonText: z.string().max(50).nullable(),
	databaseFieldsUpdate: z.array(z.string()).nullable(),
	clearEmptyFieldsOnUpdate: z.boolean(),
	reFillable: z.boolean(),
	reFillButtonText: z.string().max(50).nullable(),
	submittedText: z.string().max(10_000).nullable(),
	redirectUrl: z.string().max(2000).nullable(),
	useCaptcha: z.boolean(),
	captchaProvider: z.enum(CAPTCHA_PROVIDERS),
	closesAt: z.string().datetime({ offset: true }).nullable(),
	closedText: z.string().max(10_000).nullable(),
	maxSubmissionsCount: z.number().int().min(1).nullable(),
	maxSubmissionsReachedText: z.string().max(10_000).nullable(),
	editableSubmissions: z.boolean(),
	editableSubmissionsButtonText: z.string().max(50).nullable(),
	/** Shows a "Download PDF" button on the respondent success screen. */
	pdfDownloadEnabled: z.boolean(),
	pdfDownloadButtonText: z.string().max(100).nullable(),
	confettiOnSubmission: z.boolean(),
	showProgressBar: z.boolean(),
	autoSave: z.boolean(),
	autoFocus: z.boolean(),
	enablePartialSubmissions: z.boolean(),
	enableIpTracking: z.boolean(),
	submissionRetentionValue: z.number().int().min(1).max(3650).nullable(),
	submissionRetentionUnit: z.enum(RETENTION_UNITS).nullable(),

	canBeIndexed: z.boolean(),
	seoMeta: z
		.object({
			page_description: z.string().max(500).nullable().optional(),
			page_favicon: z.string().max(2000).nullable().optional(),
			page_thumbnail: z.string().max(2000).nullable().optional(),
			page_title: z.string().max(200).nullable().optional(),
		})
		.passthrough(),
	analytics: z
		.object({
			provider: z.enum(ANALYTICS_PROVIDERS).nullable().optional(),
			tracking_id: z.string().max(50).regex(TRACKING_ID).nullable().optional(),
		})
		.passthrough(),
});

export type FormSettings = z.infer<typeof formSettingsSchema>;

/** Settings for a brand-new form (same defaults as OpnForm's create flow). */
export function defaultFormSettings(): FormSettings {
	return {
		title: "My form",
		visibility: "public",
		tags: [],
		properties: [],
		computedVariables: [],
		language: "en",
		fontFamily: null,
		customDomain: null,
		size: "md",
		borderRadius: "small",
		theme: "default",
		presentationStyle: "classic",
		width: "centered",
		layoutRtl: false,
		coverPicture: null,
		coverSettings: null,
		logoPicture: null,
		darkMode: "auto",
		color: DEFAULT_COLOR,
		uppercaseLabels: false,
		useWorkspaceBrand: true,
		brandOverrides: [],
		noBranding: false,
		transparentBackground: false,
		translations: {},
		settings: {},
		customCode: null,
		customCss: null,
		submitButtonText: null,
		databaseFieldsUpdate: null,
		clearEmptyFieldsOnUpdate: false,
		reFillable: false,
		reFillButtonText: null,
		submittedText: DEFAULT_SUBMITTED_TEXT,
		redirectUrl: null,
		useCaptcha: false,
		captchaProvider: "hcaptcha",
		closesAt: null,
		closedText: null,
		maxSubmissionsCount: null,
		maxSubmissionsReachedText: DEFAULT_MAX_SUBMISSIONS_TEXT,
		editableSubmissions: false,
		editableSubmissionsButtonText: "Edit submission",
		pdfDownloadEnabled: false,
		pdfDownloadButtonText: null,
		confettiOnSubmission: false,
		showProgressBar: false,
		autoSave: true,
		autoFocus: true,
		enablePartialSubmissions: false,
		enableIpTracking: false,
		submissionRetentionValue: null,
		submissionRetentionUnit: null,
		canBeIndexed: true,
		seoMeta: {},
		analytics: {},
	};
}

export const formUpdateSchema = formSettingsSchema.partial();
export type FormUpdate = z.infer<typeof formUpdateSchema>;

/** Generic JSON object schema used for integration data. */
export const jsonObjectSchema = looseObject;
