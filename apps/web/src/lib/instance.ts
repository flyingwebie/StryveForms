/**
 * Instance-wide branding and access settings (name, logo, colors, sign-up
 * rules). Fetched once in the root route and cached by react-query, so any
 * component can read it live via `useInstance()`.
 */
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/utils/trpc";

/** The project's own site, always credited in the footer even when white-labelled. */
export const STRYVEFORMS_URL = "https://stryveforms.com";

export const DEFAULT_HERO_TITLE = "Build forms people love to fill";
export const DEFAULT_HERO_SUBTITLE =
	"Create forms, collect submissions and automate your workflow.";

export function useInstance() {
	const trpc = useTRPC();
	const { data } = useQuery(trpc.instance.public.queryOptions());
	return data;
}

const HEX_COLOR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Picks black or white text for readable contrast on a hex background. */
export function readableForeground(hex: string): string {
	const match = HEX_COLOR.exec(hex.trim());
	if (!match) {
		return "#ffffff";
	}
	let [, value] = match;
	if (value.length === 3) {
		value = value
			.split("")
			.map((c) => c + c)
			.join("");
	}
	const r = Number.parseInt(value.slice(0, 2), 16);
	const g = Number.parseInt(value.slice(2, 4), 16);
	const b = Number.parseInt(value.slice(4, 6), 16);
	// Relative luminance (sRGB, perceptual weighting).
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.6 ? "#0a0a0a" : "#ffffff";
}
