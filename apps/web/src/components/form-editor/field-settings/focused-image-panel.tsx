import type { FormField } from "@StryveForms/forms/types";
import { FieldLabel, FieldSet } from "@StryveForms/ui/components/field";
import { ImageLayoutEditor } from "../shared/image-layout-editor";
import { useEditor } from "../state/editor-context";

/** OpnForm's focused-mode per-question illustration: upload, layout, focal point, alt text. */
export function FocusedImagePanel({ field }: { field: FormField }) {
	const { meta, updateField } = useEditor();
	const image = field.image ?? {};

	function patchImage(patch: Partial<typeof image>) {
		updateField(field.id, { image: { ...image, ...patch } });
	}

	return (
		<FieldSet>
			<FieldLabel>Question image</FieldLabel>
			<p className="text-muted-foreground text-xs">
				Shown only in focused mode (one question at a time). A page with several
				questions uses the Pages tab's page image instead.
			</p>
			<ImageLayoutEditor
				idPrefix={field.id}
				image={image}
				onChange={patchImage}
				workspaceId={meta.workspaceId}
			/>
		</FieldSet>
	);
}
