import type { FormField } from "@StryveForms/forms/types";
import { fieldWidthClass } from "../field-wrapper";
import { ImageCredit } from "../image-credit";

/** `nf-image` (`image_block`): a standalone image, honoring the field's own alt text, focal point, brightness and Unsplash credit via `image`. */
export function LayoutImage({ field }: { field: FormField }) {
	const src = field.image_block;
	if (!src) {
		return null;
	}
	const brightness = field.image?.brightness;
	const focal = field.image?.focal_point;
	return (
		<div className={`relative ${fieldWidthClass(field)}`}>
			<img
				alt={field.image?.alt || field.name || ""}
				className="h-auto w-full rounded-lg object-cover"
				height={400}
				src={src}
				style={{
					filter:
						typeof brightness === "number"
							? `brightness(${1 + brightness / 100})`
							: undefined,
					objectPosition: focal ? `${focal.x}% ${focal.y}%` : undefined,
				}}
				width={800}
			/>
			<ImageCredit credit={field.image?.credit} />
		</div>
	);
}
