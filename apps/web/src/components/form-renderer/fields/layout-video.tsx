import type { FormField } from "@StryveForms/forms/types";
import { fieldWidthClass } from "../field-wrapper";

const YOUTUBE = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/;
const VIMEO = /vimeo\.com\/(\d+)/;

function embedUrl(url: string): { kind: "embed" | "file"; src: string } {
	const youtube = url.match(YOUTUBE);
	if (youtube) {
		return {
			kind: "embed",
			src: `https://www.youtube.com/embed/${youtube[1]}`,
		};
	}
	const vimeo = url.match(VIMEO);
	if (vimeo) {
		return { kind: "embed", src: `https://player.vimeo.com/video/${vimeo[1]}` };
	}
	return { kind: "file", src: url };
}

/** `nf-video` (`video_block`): YouTube/Vimeo embed, or a plain `<video>` for a direct file URL. */
export function LayoutVideo({ field }: { field: FormField }) {
	const url = field.video_block;
	if (!url) {
		return null;
	}
	const { kind, src } = embedUrl(url);
	return (
		<div className={fieldWidthClass(field)}>
			{kind === "embed" ? (
				<iframe
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowFullScreen
					className="aspect-video w-full rounded-lg"
					src={src}
					title={field.name || "Video"}
				/>
			) : (
				<video className="aspect-video w-full rounded-lg" controls src={src}>
					<track kind="captions" />
				</video>
			)}
		</div>
	);
}
