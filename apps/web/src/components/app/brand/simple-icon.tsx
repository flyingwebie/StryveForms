import type { SVGProps } from "react";

/** Draws a 24×24 brand mark path (from simple-icons, CC0) in the current colour. */
export function SimpleIcon({
	path,
	...props
}: SVGProps<SVGSVGElement> & { path: string }) {
	return (
		<svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" {...props}>
			<path d={path} />
		</svg>
	);
}

/** LinkedIn's mark (no longer shipped by simple-icons). */
export const LINKEDIN_PATH =
	"M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452z";
