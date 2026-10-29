/** @jsxImportSource react */
import {
	Body,
	Container,
	Head,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type { ReactNode } from "react";

import { autoDarkColor } from "../color";
import type { EmailSettings } from "../settings";
import { socialIconPath } from "../social";
import {
	EmailThemeProvider,
	type ResolvedEmailTheme,
	resolveTheme,
} from "./theme";

/**
 * Branding resolved for a single email: the wrapper's visual settings plus
 * the sender's name/url, which aren't part of the saved `EmailSettings`.
 */
export interface EmailBranding extends Partial<EmailSettings> {
	appName?: string;
	appUrl?: string;
}

const DEFAULT_APP_URL = "https://www.gnu.org/licenses/agpl-3.0.html";
const DARK_BORDER = autoDarkColor("#d4d4d8", 30, 6);

/**
 * Dark-mode CSS for clients that support it: the standard `prefers-color-scheme`
 * media query (Apple Mail, iOS/Android Mail, Gmail apps, Outlook.com, Thunderbird)
 * plus the `[data-ogsc]` attribute some of those same clients add to the body
 * when their own dark-mode toggle fires instead of (or in addition to) the
 * media query. Outlook desktop ignores both, so the inline styles elsewhere in
 * this layout (always the light palette) are its fallback — never broken, just
 * not dark.
 */
function buildDarkModeCss(theme: ResolvedEmailTheme): string {
	if (!theme.darkModeEnabled) {
		return "";
	}
	const { dark } = theme;
	const rules = `
.sf-body { background-color: ${dark.backgroundColor} !important; }
.sf-card { background-color: ${dark.contentBackgroundColor} !important; }
.sf-heading { color: ${dark.headingColor} !important; }
.sf-text, .sf-text a { color: ${dark.textColor} !important; }
.sf-muted, .sf-muted a { color: ${dark.mutedColor} !important; }
.sf-panel { background-color: ${dark.backgroundColor} !important; }
.sf-border-top { border-top-color: ${DARK_BORDER} !important; }
.sf-accent-bg { background-color: ${dark.accentColor} !important; }
.sf-btn-fill { background-color: ${dark.accentColor} !important; }
.sf-btn-outline { border-color: ${dark.accentColor} !important; color: ${dark.accentColor} !important; }
.sf-logo-light { display: none !important; }
.sf-logo-dark { display: inline-block !important; }
`;
	return `
@media (prefers-color-scheme: dark) {
${rules}
}
[data-ogsc] { }
${rules.replace(/^\.(sf-[\w-]+)/gm, "[data-ogsc] .$1")}
`;
}

/** Renders the light logo, plus (when set) a hidden dark variant the CSS swaps in. */
function Logo({
	appName,
	maxHeight,
	theme,
}: {
	appName: string;
	maxHeight: string;
	theme: ResolvedEmailTheme;
}) {
	if (!theme.logoUrl) {
		return null;
	}
	const hasDarkLogo = Boolean(theme.logoDarkUrl);
	const common = {
		alt: appName,
		style: {
			display: "inline-block",
			height: "auto",
			maxHeight,
			width: `${theme.logoWidth}px`,
		},
	};
	if (!hasDarkLogo) {
		return <Img {...common} src={theme.logoUrl} />;
	}
	return (
		<>
			<Img {...common} className="sf-logo-light" src={theme.logoUrl} />
			<Img
				{...common}
				className="sf-logo-dark"
				src={theme.logoDarkUrl ?? theme.logoUrl}
				style={{ ...common.style, display: "none" }}
			/>
		</>
	);
}

function EmailHeader({
	appName,
	theme,
}: {
	appName: string;
	theme: ResolvedEmailTheme;
}) {
	const align = theme.logoAlign === "center" ? "center" : "left";

	if (theme.headerStyle === "banner") {
		return (
			<Section
				className="sf-accent-bg"
				style={{
					backgroundColor: theme.accentColor,
					padding: "28px 32px",
					textAlign: align,
				}}
			>
				{theme.logoUrl ? (
					<Logo appName={appName} maxHeight="40px" theme={theme} />
				) : (
					<Text
						style={{
							color: "#ffffff",
							fontFamily: theme.fontStack,
							fontSize: "18px",
							fontWeight: 700,
							margin: 0,
						}}
					>
						{appName}
					</Text>
				)}
			</Section>
		);
	}

	if (!(theme.logoUrl || theme.headerStyle === "logo-name")) {
		return null;
	}

	return (
		<Section style={{ padding: "32px 32px 0", textAlign: align }}>
			<Logo appName={appName} maxHeight="48px" theme={theme} />
			{theme.headerStyle === "logo-name" ? (
				<Text
					className="sf-heading"
					style={{
						color: theme.headingColor,
						display: theme.logoUrl ? "inline-block" : "block",
						fontFamily: theme.fontStack,
						fontSize: "16px",
						fontWeight: 600,
						margin: theme.logoUrl ? "0 0 0 10px" : 0,
						verticalAlign: "middle",
					}}
				>
					{appName}
				</Text>
			) : null}
		</Section>
	);
}

/** One social link: an icon badge, a label, or both, depending on `socialDisplay`. */
function SocialLink({
	appUrl,
	link,
	theme,
}: {
	appUrl: string;
	link: EmailSettings["socialLinks"][number];
	theme: ResolvedEmailTheme;
}) {
	const showIcon = theme.socialDisplay !== "label";
	const showLabel = theme.socialDisplay !== "icons";
	const iconSrc = `${appUrl}${socialIconPath(
		link.network,
		theme.socialIconStyle,
		theme.socialIconSize,
		theme.socialIconColor
	)}`;
	return (
		<Link
			href={link.url}
			style={{
				display: "inline-block",
				margin: "0 6px",
				textDecoration: "none",
				verticalAlign: "middle",
			}}
		>
			{showIcon ? (
				<Img
					alt={link.label}
					height={theme.socialIconSize}
					src={iconSrc}
					style={{
						borderRadius: "9999px",
						display: showLabel ? "inline-block" : "block",
						verticalAlign: "middle",
					}}
					width={theme.socialIconSize}
				/>
			) : null}
			{showLabel ? (
				<span
					className="sf-muted"
					style={{
						color: theme.mutedColor,
						fontFamily: theme.fontStack,
						fontSize: "12px",
						marginLeft: showIcon ? "6px" : 0,
						verticalAlign: "middle",
					}}
				>
					{link.label}
				</span>
			) : null}
		</Link>
	);
}

function EmailFooter({
	appName,
	appUrl,
	theme,
}: {
	appName: string;
	appUrl: string;
	theme: ResolvedEmailTheme;
}) {
	const hasContent =
		theme.showPoweredBy ||
		Boolean(theme.footerText) ||
		Boolean(theme.companyAddress) ||
		theme.socialLinks.length > 0;
	if (!hasContent) {
		return null;
	}
	const mutedStyle = {
		color: theme.mutedColor,
		fontFamily: theme.fontStack,
		fontSize: "12px",
	};
	return (
		<Section
			style={{
				margin: "20px auto 0",
				maxWidth: "600px",
				padding: "0 32px",
				textAlign: "center" as const,
			}}
		>
			{theme.footerText ? (
				<Text
					className="sf-muted"
					style={{
						...mutedStyle,
						margin: "0 0 4px",
						whiteSpace: "pre-wrap" as const,
					}}
				>
					{theme.footerText}
				</Text>
			) : null}
			{theme.companyAddress ? (
				<Text className="sf-muted" style={{ ...mutedStyle, margin: "0 0 4px" }}>
					{theme.companyAddress}
				</Text>
			) : null}
			{theme.socialLinks.length > 0 ? (
				<Section
					style={{
						margin: "0 0 8px",
						textAlign: theme.socialAlign as "left" | "center" | "right",
					}}
				>
					{theme.socialLinks.map((link) => (
						<SocialLink
							appUrl={appUrl}
							key={link.url}
							link={link}
							theme={theme}
						/>
					))}
				</Section>
			) : null}
			{theme.showPoweredBy ? (
				<Text className="sf-muted" style={{ ...mutedStyle, margin: 0 }}>
					Sent with{" "}
					<Link
						href={appUrl}
						style={{ ...mutedStyle, textDecoration: "underline" }}
					>
						{appName}
					</Link>
					, the open-source form builder.
				</Text>
			) : null}
		</Section>
	);
}

export function EmailLayout({
	branding = {},
	children,
	preview,
}: {
	branding?: EmailBranding;
	children: ReactNode;
	preview?: string;
}) {
	const theme = resolveTheme(branding);
	const appName = branding.appName ?? "StryveForms";
	const appUrl = branding.appUrl ?? DEFAULT_APP_URL;
	const darkCss = buildDarkModeCss(theme);

	return (
		<Html lang="en">
			<Head>
				{theme.darkModeEnabled ? (
					<>
						<meta content="light dark" name="color-scheme" />
						<meta content="light dark" name="supported-color-schemes" />
						{/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS built from hex colours resolved above, never from user-entered HTML */}
						<style dangerouslySetInnerHTML={{ __html: darkCss }} />
					</>
				) : null}
			</Head>
			{preview ? <Preview>{preview}</Preview> : null}
			<Body
				className="sf-body"
				style={{
					backgroundColor: theme.backgroundColor,
					fontFamily: theme.fontStack,
					margin: 0,
					padding: "24px 0",
				}}
			>
				<Container
					className="sf-card"
					style={{
						backgroundColor: theme.contentBackgroundColor,
						borderRadius: theme.cardRadius,
						margin: "0 auto",
						maxWidth: "600px",
						overflow: "hidden",
					}}
				>
					<EmailHeader appName={appName} theme={theme} />
					<Section style={{ padding: "32px" }}>
						<EmailThemeProvider theme={theme}>{children}</EmailThemeProvider>
					</Section>
				</Container>
				<EmailFooter appName={appName} appUrl={appUrl} theme={theme} />
			</Body>
		</Html>
	);
}
