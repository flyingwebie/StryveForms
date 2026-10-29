import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import type { CSSProperties, ReactNode } from "react";

import { parseIconValue } from "./icon-value";

export interface EntityIconProps {
	className?: string;
	/** Tint applied to a Lucide icon (ignored for emoji, which keep their own colours). */
	color?: string | null;
	/** Rendered when `icon` is unset. Defaults to nothing. */
	fallback?: ReactNode;
	/** The stored `icon` value: a plain emoji, or "lucide:<name>". */
	icon?: string | null;
	/** Icon/font size in px. Default 16. */
	size?: number;
	style?: CSSProperties;
}

/**
 * Renders a workspace/folder/template icon: an emoji as text, or a Lucide
 * icon (lazily loaded, one chunk per icon name) tinted with `color`. Use
 * everywhere one of these icons shows up so emoji and Lucide icons always
 * render consistently.
 */
export default function EntityIcon({
	className,
	color,
	fallback = null,
	icon,
	size = 16,
	style,
}: EntityIconProps) {
	const value = parseIconValue(icon);

	if (value.kind === "lucide") {
		return (
			<DynamicIcon
				className={className}
				name={value.name as IconName}
				size={size}
				style={color ? { color, ...style } : style}
			/>
		);
	}

	if (value.kind === "emoji") {
		return (
			<span
				className={className}
				style={{ fontSize: size, lineHeight: 1, ...style }}
			>
				{value.value}
			</span>
		);
	}

	return fallback;
}
