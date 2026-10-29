/**
 * Tiny inline-SVG mockups used by the design tab's illustrated option
 * pickers. Structural lines use the muted-foreground token; accent bits
 * (buttons, selected states) use `fill-primary` so previews always match
 * the instance/workspace brand color, never a hard-coded hex.
 */

const FRAME = "h-7 w-11 shrink-0";

export function PresentationPreview({
	variant,
}: {
	variant: "classic" | "focused";
}) {
	if (variant === "focused") {
		return (
			<svg aria-hidden="true" className={FRAME} fill="none" viewBox="0 0 44 28">
				<rect
					className="stroke-muted-foreground/40"
					height="26"
					rx="3"
					width="42"
					x="1"
					y="1"
				/>
				<rect
					className="fill-muted-foreground/30"
					height="2"
					rx="1"
					width="20"
					x="12"
					y="9"
				/>
				<rect
					className="fill-muted-foreground/20"
					height="4"
					rx="1.5"
					width="26"
					x="9"
					y="14"
				/>
				<rect
					className="fill-primary"
					height="3"
					rx="1.5"
					width="10"
					x="17"
					y="21"
				/>
			</svg>
		);
	}
	return (
		<svg aria-hidden="true" className={FRAME} fill="none" viewBox="0 0 44 28">
			<rect
				className="stroke-muted-foreground/40"
				height="26"
				rx="3"
				width="42"
				x="1"
				y="1"
			/>
			<rect
				className="fill-muted-foreground/30"
				height="2"
				rx="1"
				width="14"
				x="5"
				y="5"
			/>
			<rect
				className="fill-muted-foreground/15"
				height="3"
				rx="1"
				width="34"
				x="5"
				y="10"
			/>
			<rect
				className="fill-muted-foreground/15"
				height="3"
				rx="1"
				width="34"
				x="5"
				y="15"
			/>
			<rect
				className="fill-primary"
				height="3"
				rx="1.5"
				width="10"
				x="5"
				y="21"
			/>
		</svg>
	);
}

const THEME_LOOK: Record<
	"default" | "simple" | "notion" | "minimal" | "transparent",
	{ border: boolean; dashed: boolean; filled: boolean; rounded: number }
> = {
	default: { border: true, dashed: false, filled: true, rounded: 3 },
	minimal: { border: false, dashed: false, filled: false, rounded: 0 },
	notion: { border: true, dashed: false, filled: false, rounded: 1 },
	simple: { border: true, dashed: false, filled: false, rounded: 3 },
	transparent: { border: true, dashed: true, filled: false, rounded: 3 },
};

export function ThemePreview({
	variant,
}: {
	variant: keyof typeof THEME_LOOK;
}) {
	const look = THEME_LOOK[variant];
	return (
		<svg aria-hidden="true" className={FRAME} fill="none" viewBox="0 0 44 28">
			{look.border ? (
				<rect
					className="stroke-muted-foreground/40"
					height="26"
					rx="3"
					strokeDasharray={look.dashed ? "2 2" : undefined}
					width="42"
					x="1"
					y="1"
				/>
			) : null}
			<rect
				className="fill-muted-foreground/30"
				height="2"
				rx="1"
				width="16"
				x="6"
				y="6"
			/>
			{look.filled ? (
				<rect
					className="fill-muted-foreground/10 stroke-muted-foreground/30"
					height="6"
					rx={look.rounded}
					width="32"
					x="6"
					y="11"
				/>
			) : (
				<line
					className="stroke-muted-foreground/30"
					x1="6"
					x2="38"
					y1="15"
					y2="15"
				/>
			)}
			<rect
				className="fill-primary"
				height="3"
				rx={look.rounded}
				width="10"
				x="6"
				y="21"
			/>
		</svg>
	);
}

export function RadiusPreview({
	variant,
}: {
	variant: "none" | "small" | "full";
}) {
	const rx = { full: 10, none: 0, small: 4 }[variant];
	return (
		<svg aria-hidden="true" className={FRAME} fill="none" viewBox="0 0 44 28">
			<rect
				className="fill-primary/15 stroke-primary"
				height="20"
				rx={rx}
				width="34"
				x="5"
				y="4"
			/>
		</svg>
	);
}

export function SizePreview({ variant }: { variant: "sm" | "md" | "lg" }) {
	const scale = { lg: 1.25, md: 1, sm: 0.75 }[variant];
	const h = 8 * scale;
	const w = 30 * scale;
	const y = 14 - h / 2;
	const x = 22 - w / 2;
	return (
		<svg aria-hidden="true" className={FRAME} fill="none" viewBox="0 0 44 28">
			<rect
				className="fill-primary"
				height={h}
				rx={h / 2}
				width={w}
				x={x}
				y={y}
			/>
		</svg>
	);
}

export function WidthPreview({ variant }: { variant: "centered" | "full" }) {
	const width = variant === "full" ? 38 : 24;
	const x = (44 - width) / 2;
	return (
		<svg aria-hidden="true" className={FRAME} fill="none" viewBox="0 0 44 28">
			<rect
				className="stroke-muted-foreground/25"
				height="26"
				rx="2"
				width="42"
				x="1"
				y="1"
			/>
			<rect
				className="fill-muted-foreground/10 stroke-muted-foreground/40"
				height="18"
				rx="2"
				width={width}
				x={x}
				y="5"
			/>
		</svg>
	);
}

export function LayoutPreview({
	variant,
}: {
	variant: "framed" | "frameless";
}) {
	return (
		<svg aria-hidden="true" className={FRAME} fill="none" viewBox="0 0 44 28">
			{variant === "framed" ? (
				<rect
					className="fill-muted-foreground/10 stroke-muted-foreground/40"
					height="22"
					rx="3"
					width="36"
					x="4"
					y="3"
				/>
			) : (
				<rect
					className="stroke-muted-foreground/25"
					height="22"
					rx="3"
					strokeDasharray="2 2"
					width="36"
					x="4"
					y="3"
				/>
			)}
			<rect
				className="fill-muted-foreground/30"
				height="2"
				rx="1"
				width="16"
				x="10"
				y="9"
			/>
			<rect
				className="fill-primary"
				height="3"
				rx="1.5"
				width="10"
				x="10"
				y="18"
			/>
		</svg>
	);
}

/**
 * Round-7 Classic layout presets: "card" (framed, no top image),
 * "card-on-background" (framed card floating over a full-page image),
 * "header-image" (frameless, Google-Forms-style banner), and
 * "card-with-header" (framed card with a banner above it).
 */
export function ClassicLayoutPreview({
	variant,
}: {
	variant: "card" | "card-on-background" | "header-image" | "card-with-header";
}) {
	if (variant === "card-on-background") {
		return (
			<svg aria-hidden="true" className={FRAME} fill="none" viewBox="0 0 44 28">
				<rect
					className="fill-muted-foreground/20"
					height="26"
					rx="3"
					width="42"
					x="1"
					y="1"
				/>
				<rect
					className="fill-background stroke-muted-foreground/40"
					height="18"
					rx="2"
					width="26"
					x="9"
					y="5"
				/>
				<rect
					className="fill-muted-foreground/30"
					height="2"
					rx="1"
					width="12"
					x="13"
					y="10"
				/>
				<rect
					className="fill-primary"
					height="3"
					rx="1.5"
					width="8"
					x="13"
					y="16"
				/>
			</svg>
		);
	}
	if (variant === "header-image") {
		return (
			<svg aria-hidden="true" className={FRAME} fill="none" viewBox="0 0 44 28">
				<rect
					className="fill-muted-foreground/25"
					height="10"
					rx="1.5"
					width="42"
					x="1"
					y="1"
				/>
				<rect
					className="fill-muted-foreground/30"
					height="2"
					rx="1"
					width="16"
					x="4"
					y="15"
				/>
				<rect
					className="fill-primary"
					height="3"
					rx="1.5"
					width="10"
					x="4"
					y="21"
				/>
			</svg>
		);
	}
	if (variant === "card-with-header") {
		return (
			<svg aria-hidden="true" className={FRAME} fill="none" viewBox="0 0 44 28">
				<rect
					className="stroke-muted-foreground/40"
					height="26"
					rx="3"
					width="42"
					x="1"
					y="1"
				/>
				<rect
					className="fill-muted-foreground/25"
					height="8"
					rx="1.5"
					width="36"
					x="4"
					y="4"
				/>
				<rect
					className="fill-muted-foreground/30"
					height="2"
					rx="1"
					width="16"
					x="4"
					y="16"
				/>
				<rect
					className="fill-primary"
					height="3"
					rx="1.5"
					width="10"
					x="4"
					y="21"
				/>
			</svg>
		);
	}
	// "card": framed, no top image.
	return (
		<svg aria-hidden="true" className={FRAME} fill="none" viewBox="0 0 44 28">
			<rect
				className="stroke-muted-foreground/40"
				height="22"
				rx="3"
				width="36"
				x="4"
				y="3"
			/>
			<rect
				className="fill-muted-foreground/30"
				height="2"
				rx="1"
				width="16"
				x="10"
				y="9"
			/>
			<rect
				className="fill-primary"
				height="3"
				rx="1.5"
				width="10"
				x="10"
				y="18"
			/>
		</svg>
	);
}

/** Round-5 focused-mode per-question image layouts. */
export function ImageLayoutPreview({
	variant,
}: {
	variant: "stack" | "split-left" | "split-right" | "wallpaper";
}) {
	if (variant === "wallpaper") {
		return (
			<svg aria-hidden="true" className={FRAME} fill="none" viewBox="0 0 44 28">
				<rect
					className="fill-muted-foreground/25"
					height="26"
					rx="3"
					width="42"
					x="1"
					y="1"
				/>
				<rect
					className="fill-black/30"
					height="26"
					rx="3"
					width="42"
					x="1"
					y="1"
				/>
				<rect
					className="fill-white"
					height="3"
					rx="1.5"
					width="14"
					x="15"
					y="12"
				/>
			</svg>
		);
	}
	if (variant === "split-left" || variant === "split-right") {
		const imageX = variant === "split-left" ? 1 : 23;
		const textX = variant === "split-left" ? 25 : 5;
		return (
			<svg aria-hidden="true" className={FRAME} fill="none" viewBox="0 0 44 28">
				<rect
					className="stroke-muted-foreground/40"
					height="26"
					rx="3"
					width="42"
					x="1"
					y="1"
				/>
				<rect
					className="fill-muted-foreground/25"
					height="26"
					width="20"
					x={imageX}
					y="1"
				/>
				<rect
					className="fill-muted-foreground/30"
					height="2"
					rx="1"
					width="12"
					x={textX}
					y="10"
				/>
				<rect
					className="fill-primary"
					height="3"
					rx="1.5"
					width="10"
					x={textX}
					y="16"
				/>
			</svg>
		);
	}
	// "stack": image above the question.
	return (
		<svg aria-hidden="true" className={FRAME} fill="none" viewBox="0 0 44 28">
			<rect
				className="stroke-muted-foreground/40"
				height="26"
				rx="3"
				width="42"
				x="1"
				y="1"
			/>
			<rect
				className="fill-muted-foreground/25"
				height="12"
				rx="1.5"
				width="36"
				x="4"
				y="3"
			/>
			<rect
				className="fill-muted-foreground/30"
				height="2"
				rx="1"
				width="16"
				x="4"
				y="18"
			/>
			<rect
				className="fill-primary"
				height="3"
				rx="1.5"
				width="10"
				x="4"
				y="23"
			/>
		</svg>
	);
}

export function DarkModePreview({
	variant,
}: {
	variant: "auto" | "light" | "dark";
}) {
	return (
		<svg aria-hidden="true" className={FRAME} fill="none" viewBox="0 0 44 28">
			<rect
				className="stroke-muted-foreground/40"
				height="26"
				rx="3"
				width="42"
				x="1"
				y="1"
			/>
			{variant !== "dark" && (
				<rect
					className="fill-white"
					height="24"
					rx="2"
					width={variant === "auto" ? 20 : 40}
					x="2"
					y="2"
				/>
			)}
			{variant !== "light" && (
				<rect
					className="fill-slate-900"
					height="24"
					rx="2"
					width={variant === "auto" ? 20 : 40}
					x={variant === "auto" ? 22 : 2}
					y="2"
				/>
			)}
			<rect
				className="fill-primary"
				height="3"
				rx="1.5"
				width="8"
				x="6"
				y="19"
			/>
			<rect
				className="fill-primary"
				height="3"
				rx="1.5"
				width="8"
				x="30"
				y="19"
			/>
		</svg>
	);
}
