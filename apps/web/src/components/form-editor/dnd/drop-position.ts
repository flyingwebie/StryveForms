/**
 * Decides whether a drag should land before or after the block it's
 * hovering, from the dragged element's current rect vs. the hovered
 * block's rect (both `ClientRect`-shaped: top/left/width/height).
 * In the 12-col canvas grid, two short fields can sit side by side, so
 * "before/after" sometimes means left/right instead of top/bottom —
 * `resolveDropPosition` picks the axis that matches how the two rects
 * actually relate on screen.
 */

export type DropAxis = "horizontal" | "vertical";
export type DropPosition = "after" | "before";

export interface DropIndicator {
	axis: DropAxis;
	position: DropPosition;
}

interface Rect {
	height: number;
	left: number;
	top: number;
	width: number;
}

function verticalOverlap(a: Rect, b: Rect): number {
	return Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
}

/** True when the two rects overlap vertically enough to be on the same visual row. */
function isSameRow(active: Rect, over: Rect): boolean {
	const overlap = verticalOverlap(active, over);
	return overlap > Math.min(active.height, over.height) * 0.5;
}

export function resolveDropPosition(active: Rect, over: Rect): DropIndicator {
	if (isSameRow(active, over)) {
		const activeCenterX = active.left + active.width / 2;
		const overCenterX = over.left + over.width / 2;
		return {
			axis: "horizontal",
			position: activeCenterX < overCenterX ? "before" : "after",
		};
	}
	const activeCenterY = active.top + active.height / 2;
	const overCenterY = over.top + over.height / 2;
	return {
		axis: "vertical",
		position: activeCenterY < overCenterY ? "before" : "after",
	};
}

/**
 * Splice-insertion index for `position` relative to the item at
 * `overIndex`, adjusted for `fromIndex` (the dragged item's own index)
 * already being removed from the array first — pass `fromIndex: -1` for
 * an item not yet in the array (e.g. a new block from the palette).
 */
export function insertionIndex(
	overIndex: number,
	position: DropPosition,
	fromIndex: number
): number {
	let target = overIndex + (position === "after" ? 1 : 0);
	if (fromIndex !== -1 && fromIndex < target) {
		target -= 1;
	}
	return target;
}
