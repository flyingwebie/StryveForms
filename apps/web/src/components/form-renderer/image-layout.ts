import type { BlockImage } from "@StryveForms/forms/types";

/** Current focused-mode question image layouts. */
export const FOCUSED_IMAGE_LAYOUTS = [
	"stack",
	"split-left",
	"split-right",
	"wallpaper",
] as const;

export type FocusedImageLayout = (typeof FOCUSED_IMAGE_LAYOUTS)[number];

/** Maps an older `BlockImage.layout` value onto the current 4-layout set. */
const LEGACY_LAYOUT_MAP: Record<string, FocusedImageLayout> = {
	background: "wallpaper",
	between: "stack",
	"left-small": "split-left",
	"left-split": "split-left",
	"right-small": "split-right",
	"right-split": "split-right",
};

/** Normalizes any stored `image.layout` (current or legacy) to the current set. Defaults to "stack" once an image URL exists. */
export function normalizeImageLayout(
	layout: BlockImage["layout"] | undefined
): FocusedImageLayout {
	if (!layout) {
		return "stack";
	}
	if ((FOCUSED_IMAGE_LAYOUTS as readonly string[]).includes(layout)) {
		return layout as FocusedImageLayout;
	}
	return LEGACY_LAYOUT_MAP[layout] ?? "stack";
}
