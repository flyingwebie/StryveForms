import type { FieldWidth } from "@StryveForms/forms/types";

/** Ordered largest → smallest, matching the 12-col grid spans the renderer uses. */
export const WIDTH_SEQUENCE: FieldWidth[] = [
	"full",
	"3/4",
	"2/3",
	"1/2",
	"1/3",
	"1/4",
];

export const SPAN_BY_WIDTH: Record<FieldWidth, number> = {
	"1/2": 6,
	"1/3": 4,
	"1/4": 3,
	"2/3": 8,
	"3/4": 9,
	full: 12,
};

const WIDTH_BY_SPAN = new Map<number, FieldWidth>(
	WIDTH_SEQUENCE.map((width) => [SPAN_BY_WIDTH[width], width])
);

const ALLOWED_SPANS = WIDTH_SEQUENCE.map((width) => SPAN_BY_WIDTH[width]);

/** Snaps an arbitrary column count to the nearest width the renderer supports. */
export function nearestAllowedSpan(span: number): number {
	return ALLOWED_SPANS.reduce((closest, candidate) =>
		Math.abs(candidate - span) < Math.abs(closest - span) ? candidate : closest
	);
}

export function widthForSpan(span: number): FieldWidth {
	return WIDTH_BY_SPAN.get(nearestAllowedSpan(span)) ?? "full";
}

/** Width label shown in the live resize badge, e.g. "1/2". */
export function widthLabel(width: FieldWidth): string {
	return width === "full" ? "Full" : width;
}

export function nextWidth(current: FieldWidth): FieldWidth {
	const index = WIDTH_SEQUENCE.indexOf(current);
	return WIDTH_SEQUENCE[(index + 1) % WIDTH_SEQUENCE.length] ?? "full";
}
