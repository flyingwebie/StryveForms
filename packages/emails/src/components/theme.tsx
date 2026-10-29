/** @jsxImportSource react */
import { createContext, type ReactNode, useContext } from "react";

import { autoDarkColor } from "../color";
import {
	DEFAULT_EMAIL_SETTINGS,
	EMAIL_BUTTON_RADIUS_PX,
	EMAIL_CARD_RADIUS_PX,
	EMAIL_FONT_STACKS,
	type EmailSettings,
	resolveEmailSettings,
} from "../settings";

/** Dark-mode counterparts of the light colours, explicit or auto-derived. */
export interface ResolvedDarkPalette {
	accentColor: string;
	backgroundColor: string;
	contentBackgroundColor: string;
	headingColor: string;
	mutedColor: string;
	textColor: string;
}

export interface ResolvedEmailTheme extends EmailSettings {
	buttonRadius: string;
	cardRadius: string;
	/** Resolved dark palette; only meaningful when `darkModeEnabled` is true. */
	dark: ResolvedDarkPalette;
	/** False when `emailDarkMode` is "light-only" — no dark CSS is emitted at all. */
	darkModeEnabled: boolean;
	fontStack: string;
}

export function resolveTheme(
	settings?: Partial<EmailSettings> | null
): ResolvedEmailTheme {
	const resolved = resolveEmailSettings(settings);
	const dark: ResolvedDarkPalette = {
		accentColor: resolved.darkAccentColor ?? resolved.accentColor,
		backgroundColor:
			resolved.darkBackgroundColor ??
			autoDarkColor(resolved.backgroundColor, 10),
		contentBackgroundColor:
			resolved.darkContentBackgroundColor ??
			autoDarkColor(resolved.contentBackgroundColor, 16),
		headingColor:
			resolved.darkHeadingColor ?? autoDarkColor(resolved.headingColor, 96, 6),
		mutedColor:
			resolved.darkMutedColor ?? autoDarkColor(resolved.mutedColor, 64, 10),
		textColor:
			resolved.darkTextColor ?? autoDarkColor(resolved.textColor, 88, 8),
	};
	return {
		...resolved,
		buttonRadius: EMAIL_BUTTON_RADIUS_PX[resolved.cornerRadius],
		cardRadius: EMAIL_CARD_RADIUS_PX[resolved.cornerRadius],
		dark,
		darkModeEnabled: resolved.emailDarkMode !== "light-only",
		fontStack: EMAIL_FONT_STACKS[resolved.fontFamily],
	};
}

const defaultTheme = resolveTheme(DEFAULT_EMAIL_SETTINGS);

const EmailThemeContext = createContext<ResolvedEmailTheme>(defaultTheme);

/** Makes the resolved email theme available to `EmailHeading`, `Paragraph`, etc. below it. */
export function EmailThemeProvider({
	children,
	theme,
}: {
	children: ReactNode;
	theme: ResolvedEmailTheme;
}) {
	return (
		<EmailThemeContext.Provider value={theme}>
			{children}
		</EmailThemeContext.Provider>
	);
}

export function useEmailTheme(): ResolvedEmailTheme {
	return useContext(EmailThemeContext);
}
