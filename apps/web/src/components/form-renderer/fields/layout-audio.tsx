import type { FormField } from "@StryveForms/forms/types";
import { fieldWidthClass } from "../field-wrapper";

export function LayoutAudio({ field }: { field: FormField }) {
	const src = field.audio_block;
	if (!src) {
		return null;
	}
	return (
		<div className={fieldWidthClass(field)}>
			{/** biome-ignore lint/a11y/useMediaCaption: audio has no text track to caption */}
			<audio className="w-full" controls src={src} />
		</div>
	);
}
