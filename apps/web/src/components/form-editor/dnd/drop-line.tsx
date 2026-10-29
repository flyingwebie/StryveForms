import type { DropIndicator } from "./drop-position";

const SIDE_CLASS: Record<string, string> = {
	"horizontal-after": "-right-[7px] inset-y-1 w-1",
	"horizontal-before": "-left-[7px] inset-y-1 w-1",
	"vertical-after": "-bottom-[7px] inset-x-1 h-1",
	"vertical-before": "-top-[7px] inset-x-1 h-1",
};

/**
 * Thin highlighted bar on the edge of a canvas/list block showing exactly
 * where a drag will land: top/bottom for a stacked drop, left/right when
 * dropping beside a same-row block in the 12-col grid.
 */
export function DropLine({ indicator }: { indicator: DropIndicator }) {
	return (
		<div
			aria-hidden
			className={`pointer-events-none absolute z-30 rounded-full bg-primary shadow-[0_0_0_2px_var(--color-background)] ${SIDE_CLASS[`${indicator.axis}-${indicator.position}`]}`}
		/>
	);
}
