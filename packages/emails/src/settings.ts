import { z } from "zod";

import {
	detectSocialNetwork,
	SOCIAL_NETWORK_IDS,
	SOCIAL_NETWORKS,
	type SocialNetworkId,
} from "./social";

/** Email-safe font stacks. "inter" falls back to system fonts most clients don't ship. */
export const EMAIL_FONT_FAMILIES = [
	"system",
	"helvetica",
	"georgia",
	"inter",
] as const;
export type EmailFontFamily = (typeof EMAIL_FONT_FAMILIES)[number];

export const EMAIL_FONT_STACKS: Record<EmailFontFamily, string> = {
	georgia: 'Georgia, "Times New Roman", serif',
	helvetica: "Helvetica, Arial, sans-serif",
	inter:
		'"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
	system:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

export const EMAIL_CORNER_RADII = ["none", "small", "large"] as const;
export type EmailCornerRadius = (typeof EMAIL_CORNER_RADII)[number];

export const EMAIL_CARD_RADIUS_PX: Record<EmailCornerRadius, string> = {
	large: "20px",
	none: "0px",
	small: "8px",
};

export const EMAIL_BUTTON_RADIUS_PX: Record<EmailCornerRadius, string> = {
	large: "12px",
	none: "0px",
	small: "6px",
};

export const EMAIL_HEADER_STYLES = ["logo", "logo-name", "banner"] as const;
export type EmailHeaderStyle = (typeof EMAIL_HEADER_STYLES)[number];

export const EMAIL_LOGO_ALIGNS = ["left", "center"] as const;
export type EmailLogoAlign = (typeof EMAIL_LOGO_ALIGNS)[number];

export const EMAIL_BUTTON_STYLES = ["filled", "outline"] as const;
export type EmailButtonStyle = (typeof EMAIL_BUTTON_STYLES)[number];

/** How the "turn dark mode support" is handled for the whole email. */
export const EMAIL_DARK_MODES = ["auto", "light-only"] as const;
export type EmailDarkMode = (typeof EMAIL_DARK_MODES)[number];

/** What each social link shows: just the icon, icon + label, or just the label. */
export const EMAIL_SOCIAL_DISPLAYS = ["icons", "icon-label", "label"] as const;
export type EmailSocialDisplay = (typeof EMAIL_SOCIAL_DISPLAYS)[number];

/** How the social icon badges are coloured. */
export const EMAIL_SOCIAL_ICON_STYLES = ["brand", "mono", "muted"] as const;
export type EmailSocialIconStyle = (typeof EMAIL_SOCIAL_ICON_STYLES)[number];

export const EMAIL_SOCIAL_ALIGNS = ["left", "center", "right"] as const;
export type EmailSocialAlign = (typeof EMAIL_SOCIAL_ALIGNS)[number];

export interface EmailSocialLink {
	label: string;
	network: SocialNetworkId;
	url: string;
}

/** The email wrapper's visual design: colours, typography, header, buttons, footer. */
export interface EmailSettings {
	accentColor: string;
	backgroundColor: string;
	buttonStyle: EmailButtonStyle;
	companyAddress: string | null;
	contentBackgroundColor: string;
	cornerRadius: EmailCornerRadius;
	/** Dark-mode-only overrides. `null` auto-derives from the light colour above. */
	darkAccentColor: string | null;
	darkBackgroundColor: string | null;
	darkContentBackgroundColor: string | null;
	darkHeadingColor: string | null;
	darkMutedColor: string | null;
	darkTextColor: string | null;
	/** "auto" renders dark-mode styles for clients that support it; "light-only" never does. */
	emailDarkMode: EmailDarkMode;
	fontFamily: EmailFontFamily;
	footerText: string | null;
	headerStyle: EmailHeaderStyle;
	headingColor: string;
	logoAlign: EmailLogoAlign;
	/** Logo shown instead of `logoUrl` when the client is in dark mode. */
	logoDarkUrl: string | null;
	logoUrl: string | null;
	logoWidth: number;
	mutedColor: string;
	showPoweredBy: boolean;
	socialAlign: EmailSocialAlign;
	socialDisplay: EmailSocialDisplay;
	socialIconColor: string;
	socialIconSize: number;
	socialIconStyle: EmailSocialIconStyle;
	socialLinks: EmailSocialLink[];
	textColor: string;
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
	accentColor: "#3B82F6",
	backgroundColor: "#f4f4f5",
	buttonStyle: "filled",
	companyAddress: null,
	contentBackgroundColor: "#ffffff",
	cornerRadius: "small",
	darkAccentColor: null,
	darkBackgroundColor: null,
	darkContentBackgroundColor: null,
	darkHeadingColor: null,
	darkMutedColor: null,
	darkTextColor: null,
	emailDarkMode: "auto",
	fontFamily: "system",
	footerText: null,
	headerStyle: "logo",
	headingColor: "#18181b",
	logoAlign: "left",
	logoDarkUrl: null,
	logoUrl: null,
	logoWidth: 140,
	mutedColor: "#71717a",
	showPoweredBy: true,
	socialAlign: "center",
	socialDisplay: "icon-label",
	socialIconColor: "#71717A",
	socialIconSize: 28,
	socialIconStyle: "brand",
	socialLinks: [],
	textColor: "#3f3f46",
};

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const hexColor = () => z.string().regex(HEX_COLOR, "Must be a hex colour");
const nullableHexColor = () => hexColor().nullable();

/** Validates with `new URL()` instead of zod's `.url()`, so `mailto:` links pass too. */
function isParseableUrl(value: string): boolean {
	try {
		const parsed = new URL(value);
		return Boolean(parsed.protocol);
	} catch {
		return false;
	}
}

const MAILTO_SCHEME = /^mailto:/i;
const HAS_URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const BARE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Adds `https://` to a bare domain/handle, and turns a bare email into `mailto:`. */
export function normalizeSocialUrl(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) {
		return trimmed;
	}
	if (MAILTO_SCHEME.test(trimmed)) {
		return trimmed;
	}
	if (HAS_URL_SCHEME.test(trimmed)) {
		return trimmed;
	}
	if (BARE_EMAIL.test(trimmed)) {
		return `mailto:${trimmed}`;
	}
	return `https://${trimmed}`;
}

/** The fully-resolved shape saved to the database: every link has a network and a label. */
export const emailSocialLinkSchema = z.object({
	label: z.string().min(1).max(60),
	network: z.enum(SOCIAL_NETWORK_IDS),
	url: z.string().max(500).refine(isParseableUrl, "Must be a valid URL"),
});

const draftSocialLinkSchema = z.object({
	label: z.string().max(60).optional(),
	network: z.enum(SOCIAL_NETWORK_IDS).optional(),
	url: z.string().max(500),
});

/**
 * Accepts the admin UI's draft rows — which may include a row the user added
 * but never filled in — normalises each URL (adding `https://` when missing),
 * drops any row left without a URL, and fills in the auto-detected network
 * and a default label for the rest. This runs before `.url()`-style
 * validation, so an empty row never produces a validation error.
 */
export const emailSocialLinksInputSchema = z
	.array(draftSocialLinkSchema)
	.max(10)
	.transform((links) =>
		links
			.map((link) => ({ ...link, url: normalizeSocialUrl(link.url) }))
			.filter((link) => link.url.length > 0)
			.map((link) => {
				const network = link.network ?? detectSocialNetwork(link.url);
				return {
					label: link.label?.trim() || SOCIAL_NETWORKS[network].label,
					network,
					url: link.url,
				};
			})
	)
	.pipe(z.array(emailSocialLinkSchema).max(10));

/** Validates a (possibly partial) draft of `EmailSettings`, e.g. from the admin UI. */
export const emailSettingsSchema = z
	.object({
		accentColor: hexColor(),
		backgroundColor: hexColor(),
		buttonStyle: z.enum(EMAIL_BUTTON_STYLES),
		companyAddress: z.string().max(500).nullable(),
		contentBackgroundColor: hexColor(),
		cornerRadius: z.enum(EMAIL_CORNER_RADII),
		darkAccentColor: nullableHexColor(),
		darkBackgroundColor: nullableHexColor(),
		darkContentBackgroundColor: nullableHexColor(),
		darkHeadingColor: nullableHexColor(),
		darkMutedColor: nullableHexColor(),
		darkTextColor: nullableHexColor(),
		emailDarkMode: z.enum(EMAIL_DARK_MODES),
		fontFamily: z.enum(EMAIL_FONT_FAMILIES),
		footerText: z.string().max(2000).nullable(),
		headerStyle: z.enum(EMAIL_HEADER_STYLES),
		headingColor: hexColor(),
		logoAlign: z.enum(EMAIL_LOGO_ALIGNS),
		logoDarkUrl: z.string().max(2000).nullable(),
		logoUrl: z.string().max(2000).nullable(),
		logoWidth: z.number().int().min(24).max(400),
		mutedColor: hexColor(),
		showPoweredBy: z.boolean(),
		socialAlign: z.enum(EMAIL_SOCIAL_ALIGNS),
		socialDisplay: z.enum(EMAIL_SOCIAL_DISPLAYS),
		socialIconColor: hexColor(),
		socialIconSize: z.number().int().min(16).max(64),
		socialIconStyle: z.enum(EMAIL_SOCIAL_ICON_STYLES),
		socialLinks: emailSocialLinksInputSchema,
		textColor: hexColor(),
	})
	.partial();

/** Fills in every unset key with its default. */
export function resolveEmailSettings(
	overrides?: Partial<EmailSettings> | null
): EmailSettings {
	return { ...DEFAULT_EMAIL_SETTINGS, ...(overrides ?? {}) };
}

/** Shallow-merges a settings draft over a base, skipping `undefined` overrides. */
export function mergeEmailSettings<T extends Partial<EmailSettings>>(
	base: T,
	overrides?: Partial<EmailSettings> | null
): T {
	if (!overrides) {
		return base;
	}
	const result: Record<string, unknown> = { ...base };
	for (const [key, value] of Object.entries(overrides)) {
		if (value !== undefined) {
			result[key] = value;
		}
	}
	return result as T;
}
