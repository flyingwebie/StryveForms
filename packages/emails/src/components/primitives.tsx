/** @jsxImportSource react */
import { Button, Heading, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

import { useEmailTheme } from "./theme";

export function EmailHeading({ children }: { children: ReactNode }) {
	const theme = useEmailTheme();
	return (
		<Heading
			as="h1"
			className="sf-heading"
			style={{
				color: theme.headingColor,
				fontFamily: theme.fontStack,
				fontSize: "22px",
				margin: "0 0 16px",
			}}
		>
			{children}
		</Heading>
	);
}

export function Paragraph({ children }: { children: ReactNode }) {
	const theme = useEmailTheme();
	return (
		<Text
			className="sf-text"
			style={{
				color: theme.textColor,
				fontFamily: theme.fontStack,
				fontSize: "15px",
				lineHeight: "24px",
				margin: "0 0 16px",
			}}
		>
			{children}
		</Text>
	);
}

export function ActionButton({
	children,
	href,
}: {
	children: ReactNode;
	href: string;
}) {
	const theme = useEmailTheme();
	const filled = theme.buttonStyle !== "outline";
	return (
		<Section style={{ margin: "24px 0" }}>
			<Button
				className={filled ? "sf-btn-fill" : "sf-btn-outline"}
				href={href}
				style={{
					backgroundColor: filled ? theme.accentColor : "transparent",
					border: filled ? "none" : `2px solid ${theme.accentColor}`,
					borderRadius: theme.buttonRadius,
					color: filled ? "#ffffff" : theme.accentColor,
					display: "inline-block",
					fontFamily: theme.fontStack,
					fontSize: "15px",
					fontWeight: 600,
					padding: filled ? "12px 20px" : "10px 18px",
					textDecoration: "none",
				}}
			>
				{children}
			</Button>
		</Section>
	);
}

export function Panel({ children }: { children: ReactNode }) {
	const theme = useEmailTheme();
	return (
		<Section
			className="sf-panel"
			style={{
				backgroundColor: theme.backgroundColor,
				borderRadius: theme.buttonRadius,
				margin: "0 0 16px",
				padding: "12px 16px",
			}}
		>
			<Text
				className="sf-text"
				style={{
					color: theme.textColor,
					fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
					fontSize: "13px",
					margin: 0,
					whiteSpace: "pre-wrap",
					wordBreak: "break-all",
				}}
			>
				{children}
			</Text>
		</Section>
	);
}

/** Renders HTML that has already been sanitised on the server. */
export function RawHtml({ html }: { html: string }) {
	const theme = useEmailTheme();
	return (
		<div
			className="sf-text"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: callers pass sanitised HTML only
			dangerouslySetInnerHTML={{ __html: html }}
			style={{ color: theme.textColor, fontFamily: theme.fontStack }}
		/>
	);
}
