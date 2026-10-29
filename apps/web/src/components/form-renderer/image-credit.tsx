import type { BlockImage } from "@StryveForms/forms/types";

const UNSPLASH_URL =
	"https://unsplash.com/?utm_source=stryveforms&utm_medium=referral";

/**
 * "Photo by {name} on Unsplash" attribution — required by the Unsplash API
 * guideline (see apps/web/src/components/app/media/README.md) wherever an
 * image with `credit` (the shared `ImagePicker`) is shown. Absent for
 * an uploaded/library image (`credit` is undefined). Positioned absolute:
 * the caller must wrap it in a `relative`- (or otherwise positioned-)
 * element.
 */
export function ImageCredit({ credit }: { credit: BlockImage["credit"] }) {
	if (!credit) {
		return null;
	}
	return (
		<p className="absolute right-1.5 bottom-1.5 z-10 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white leading-tight">
			Photo by{" "}
			<a
				className="underline"
				href={credit.url}
				rel="noopener noreferrer"
				target="_blank"
			>
				{credit.name}
			</a>{" "}
			on{" "}
			<a
				className="underline"
				href={UNSPLASH_URL}
				rel="noopener noreferrer"
				target="_blank"
			>
				Unsplash
			</a>
		</p>
	);
}
