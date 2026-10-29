import type { PublicFormDto } from "@StryveForms/api/lib/serialize";
import { useEffect, useState } from "react";
import { tv } from "tailwind-variants";
import { fontFamilyValue } from "@/lib/google-fonts";

export type FormTheme = PublicFormDto["theme"];
export type FormSize = PublicFormDto["size"];
export type FormBorderRadius = PublicFormDto["borderRadius"];
export type ResolvedScheme = "light" | "dark";

const HEX_DIGITS = /^[0-9a-f]{6}$/i;

function expandHex(hex: string): string {
	const stripped = hex.replace("#", "");
	if (stripped.length === 3) {
		return stripped
			.split("")
			.map((c) => c + c)
			.join("");
	}
	return stripped.slice(0, 6);
}

function hexToRgb(hex: string): [number, number, number] {
	const expanded = expandHex(hex);
	if (!HEX_DIGITS.test(expanded)) {
		return [59, 130, 246]; // falls back to the OpnForm default blue
	}
	const num = Number.parseInt(expanded, 16);
	const r = Math.floor(num / 65_536) % 256;
	const g = Math.floor(num / 256) % 256;
	const b = num % 256;
	return [r, g, b];
}

function srgbChannel(value: number): number {
	const v = value / 255;
	return v <= 0.039_28 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance (0–1) of a hex colour. */
function relativeLuminance(hex: string): number {
	const [r, g, b] = hexToRgb(hex);
	return (
		0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b)
	);
}

/** Dark text on light accents, white text on dark/saturated accents. */
export function contrastingTextColor(color: string): string {
	return relativeLuminance(color) > 0.45 ? "#171717" : "#ffffff";
}

/**
 * CSS custom properties the whole form tree reads from. `--color-form` /
 * `--bg-form-color` are OpnForm-style tokens used directly in this renderer's
 * own classes; `--primary` / `--primary-foreground` / `--ring` are what the
 * shared shadcn primitives (Button, Checkbox, RadioGroup, Switch, Slider,
 * Progress…) read, so overriding them here is what makes those components
 * pick up the form's accent colour instead of rendering in shadcn's default
 * near-black.
 */
export function formColorVars(color: string): React.CSSProperties {
	return {
		"--bg-form-color": color,
		"--color-form": color,
		"--primary": color,
		"--primary-foreground": contrastingTextColor(color),
		"--ring": color,
	} as React.CSSProperties;
}

export const surfaceTheme = tv({
	base: "text-neutral-700 dark:text-neutral-300",
	variants: {
		theme: {
			default: "bg-white shadow-xs dark:bg-neutral-900",
			minimal: "bg-neutral-50 dark:bg-neutral-950",
			notion: "bg-[#fffefc] dark:bg-neutral-900",
			simple: "bg-white dark:bg-neutral-900",
			transparent: "bg-transparent",
		},
		borderRadius: {
			full: "rounded-[28px]",
			none: "rounded-none",
			small: "rounded-xl",
		},
		transparentBackground: {
			true: "bg-transparent shadow-none",
		},
	},
	defaultVariants: { borderRadius: "small", theme: "default" },
});

/** Text input / textarea / native select look, matching OpnForm's `text-input.theme.js`. */
export const inputTheme = tv({
	base: [
		// `h-auto` overrides shadcn's own `h-8` on Input/NativeSelect, so the
		// size variants' padding below actually grows the control instead of
		// being clipped inside a fixed 32px box.
		"h-auto w-full appearance-none border bg-white text-neutral-700 outline-none transition-colors",
		"placeholder-neutral-400 disabled:cursor-not-allowed disabled:opacity-75",
		"dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder-neutral-500",
	],
	variants: {
		theme: {
			default:
				"border-neutral-300 shadow-xs focus:border-transparent focus:ring-2 focus:ring-[var(--color-form)] dark:border-neutral-600",
			minimal:
				"border-2 border-transparent bg-neutral-100 focus:border-[var(--color-form)] focus:ring-0 dark:bg-neutral-800",
			notion:
				"border-neutral-300 bg-[#fbfbfa] focus:border-transparent focus:ring-2 focus:ring-[var(--color-form)]/40 dark:border-neutral-600 dark:bg-neutral-800",
			simple:
				"border-neutral-300 focus:border-transparent focus:ring-2 focus:ring-[var(--color-form)] dark:border-neutral-600",
			transparent:
				"!rounded-none !px-0 border-0 bg-transparent shadow-[inset_0_-1px_0_0_rgb(212,212,212)] focus:shadow-[inset_0_-2px_0_0_var(--color-form)] focus:ring-0 dark:shadow-[inset_0_-1px_0_0_rgb(82,82,82)]",
		},
		size: {
			lg: "px-5 py-3 text-lg",
			md: "px-4 py-2 text-base",
			sm: "px-3 py-1.5 text-sm",
		},
		borderRadius: {
			full: "rounded-[20px]",
			none: "rounded-none",
			small: "rounded-lg",
		},
		hasError: {
			true: "!border-transparent !ring-2 !ring-red-500",
		},
	},
	defaultVariants: {
		borderRadius: "small",
		hasError: false,
		size: "md",
		theme: "default",
	},
});

export const labelTheme = tv({
	base: "inline align-baseline text-neutral-700 dark:text-neutral-300",
	variants: {
		theme: {
			default: "font-semibold",
			minimal: "font-medium text-neutral-600 dark:text-neutral-400",
			notion: "font-semibold",
			simple: "font-semibold",
			transparent: "font-semibold",
		},
		size: {
			lg: "text-base",
			md: "text-sm",
			sm: "text-xs",
		},
		uppercase: {
			true: "uppercase",
		},
	},
	defaultVariants: { size: "md", theme: "default" },
});

export const choiceOptionTheme = tv({
	base: "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
	variants: {
		selected: {
			true: "border-[var(--color-form)] bg-[color-mix(in_srgb,var(--bg-form-color)_10%,transparent)]",
			false:
				"border-neutral-300 hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-800",
		},
	},
});

/** Lettered indicator badge for a focused-mode choice option (A/B/C…): filled accent when selected. */
export const choiceLetterTheme = tv({
	base: "flex size-6 shrink-0 items-center justify-center rounded-md font-medium text-xs transition-colors",
	variants: {
		selected: {
			true: "bg-[var(--color-form)] text-[var(--primary-foreground)]",
			false:
				"bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
		},
	},
});

/** Outlined keyboard-shortcut hint pill ("A", "Press Enter ↵"…) used in focused mode. */
export const kbdHintTheme =
	"shrink-0 rounded-md border border-neutral-300 px-1.5 py-0.5 font-mono text-[11px] text-neutral-400 dark:border-neutral-600 dark:text-neutral-500";

export const submitButtonTheme = tv({
	base: "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-form)] px-5 py-3 font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
});

/** Height/radius for composite controls that can't take `inputTheme` directly (PhoneInput's own wrapper). */
export function compositeInputClass(
	size: FormSize,
	borderRadius: FormBorderRadius
): string {
	const height = { lg: "h-12", md: "h-10", sm: "h-9" }[size];
	const radius = {
		full: "rounded-[20px]",
		none: "rounded-none",
		small: "rounded-lg",
	}[borderRadius];
	return `${height} ${radius}`;
}

/** Previous/secondary button: accent-coloured outline instead of a filled fill. */
export const outlineButtonTheme = tv({
	base: "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-form)] px-5 py-3 font-semibold text-[var(--color-form)] transition-colors hover:bg-[color-mix(in_srgb,var(--bg-form-color)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-50",
});

/**
 * The "Notion" theme is monochrome (black/white controls, no brand colour) —
 * everything else uses the form's own accent. Feeding this into
 * {@link formColorVars} instead of `form.color` makes every component that
 * reads `--color-form`/`--primary` (buttons, radios, stars, focus rings…)
 * switch automatically, with no per-component theme branching needed.
 */
export function effectiveAccentColor(
	theme: FormTheme,
	color: string,
	scheme: ResolvedScheme
): string {
	if (theme !== "notion") {
		return color;
	}
	return scheme === "dark" ? "#f5f5f5" : "#171717";
}

/** Font stack for `settings.fontFamily` (a Google Fonts family, loaded by `useGoogleFont`). */
export function fontFamilyStack(fontFamily: string | null): string | undefined {
	if (!fontFamily) {
		return;
	}
	return fontFamilyValue(fontFamily);
}

/**
 * Resolves `form.darkMode` ("auto" | "light" | "dark") to the scheme this
 * respondent actually sees, independent of whatever dark-mode class the host
 * page happens to have — so an embedded or standalone form always picks the
 * correct light/dark logo and colours, even inside a light-themed host page.
 * "auto" follows the OS `prefers-color-scheme` media query live.
 */
export function useResolvedColorScheme(
	darkMode: PublicFormDto["darkMode"]
): ResolvedScheme {
	const [scheme, setScheme] = useState<ResolvedScheme>(
		darkMode === "dark" ? "dark" : "light"
	);
	useEffect(() => {
		if (darkMode !== "auto") {
			setScheme(darkMode === "dark" ? "dark" : "light");
			return;
		}
		if (typeof window === "undefined") {
			return;
		}
		const query = window.matchMedia("(prefers-color-scheme: dark)");
		const update = () => setScheme(query.matches ? "dark" : "light");
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, [darkMode]);
	return scheme;
}

/**
 * Inline `box-shadow` value for a "none"|"sm"|"md"|"lg" frame shadow setting.
 * Set as an inline style (not a Tailwind class) so it reliably overrides the
 * per-theme shadow in `surfaceTheme` regardless of generated CSS order.
 */
export const FRAME_SHADOW_VALUE: Record<string, string> = {
	lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
	md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
	none: "none",
	sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
};
