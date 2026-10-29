import type { FormField } from "@StryveForms/forms/types";
import {
	Field,
	FieldDescription,
	FieldLabel,
	FieldSet,
} from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";
import { RichTextEditor } from "@StryveForms/ui/components/rich-text-editor";
import { Textarea } from "@StryveForms/ui/components/textarea";
import ImagePicker from "@/components/app/media/image-picker";
import { UploadButton } from "../../shared/upload-button";
import { useEditor } from "../../state/editor-context";

function MediaBlockPanel({
	accept,
	field,
	urlKey,
}: {
	accept: string;
	field: FormField;
	urlKey: "audio_block" | "image_block" | "video_block";
}) {
	const { updateField } = useEditor();
	return (
		<FieldSet>
			<Field>
				<FieldLabel htmlFor={`${field.id}-url`}>URL</FieldLabel>
				<Input
					id={`${field.id}-url`}
					onChange={(e) => updateField(field.id, { [urlKey]: e.target.value })}
					placeholder="https://…"
					value={(field[urlKey] as string | undefined) ?? ""}
				/>
				<FieldDescription>
					Link to an existing file, or upload one below instead.
				</FieldDescription>
			</Field>
			<UploadButton
				accept={accept}
				label="Upload file"
				onUploaded={(url) => updateField(field.id, { [urlKey]: url })}
			/>
		</FieldSet>
	);
}

/**
 * Image block: the same picker as every other image (upload, library,
 * Unsplash) plus alt text. The URL lives in `image_block` (OpnForm's key);
 * alt text and the Unsplash credit live in `image`.
 */
function ImageBlockPanel({ field }: { field: FormField }) {
	const { meta, updateField } = useEditor();
	const url = field.image_block as string | undefined;
	return (
		<FieldSet>
			<ImagePicker
				onChange={(picked) =>
					updateField(field.id, {
						image: picked
							? { ...field.image, credit: picked.credit, url: picked.url }
							: undefined,
						image_block: picked?.url ?? "",
					})
				}
				value={url ? { credit: field.image?.credit, url } : null}
				workspaceId={meta.workspaceId}
			/>
			{url ? (
				<Field>
					<FieldLabel htmlFor={`${field.id}-alt`}>Alt text</FieldLabel>
					<Input
						id={`${field.id}-alt`}
						onChange={(e) =>
							updateField(field.id, {
								image: { ...field.image, alt: e.target.value, url },
							})
						}
						placeholder="Describe the image for screen readers"
						value={field.image?.alt ?? ""}
					/>
				</Field>
			) : null}
		</FieldSet>
	);
}

export function ContentPanel({ field }: { field: FormField }) {
	const { updateField } = useEditor();

	if (field.type === "nf-text") {
		return (
			<FieldSet>
				<Field>
					<FieldLabel>Content</FieldLabel>
					<RichTextEditor
						minHeight={120}
						onChange={(html) => updateField(field.id, { content: html })}
						toolbar="full"
						value={field.content ?? ""}
					/>
					<FieldDescription>
						Shown as-is on the form; not an input, so it has no answer.
					</FieldDescription>
				</Field>
			</FieldSet>
		);
	}

	if (field.type === "nf-code") {
		return (
			<FieldSet>
				<Field>
					<FieldLabel htmlFor={`${field.id}-code`}>HTML</FieldLabel>
					<Textarea
						className="min-h-40 font-mono"
						id={`${field.id}-code`}
						onChange={(e) => updateField(field.id, { content: e.target.value })}
						value={field.content ?? ""}
					/>
					<FieldDescription>
						Raw HTML embedded in the form — use for widgets the other blocks
						don't cover.
					</FieldDescription>
				</Field>
			</FieldSet>
		);
	}

	if (field.type === "nf-image") {
		return <ImageBlockPanel field={field} />;
	}

	if (field.type === "nf-video") {
		return (
			<MediaBlockPanel accept="video/*" field={field} urlKey="video_block" />
		);
	}

	if (field.type === "nf-audio") {
		return (
			<MediaBlockPanel accept="audio/*" field={field} urlKey="audio_block" />
		);
	}

	if (field.type === "nf-page-break") {
		return (
			<FieldSet className="grid grid-cols-2 gap-2">
				<Field>
					<FieldLabel htmlFor={`${field.id}-next`}>Next button</FieldLabel>
					<Input
						id={`${field.id}-next`}
						onChange={(e) =>
							updateField(field.id, { next_btn_text: e.target.value })
						}
						placeholder="Next"
						value={field.next_btn_text ?? ""}
					/>
					<FieldDescription>Default label: Next.</FieldDescription>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${field.id}-prev`}>Previous button</FieldLabel>
					<Input
						id={`${field.id}-prev`}
						onChange={(e) =>
							updateField(field.id, { previous_btn_text: e.target.value })
						}
						placeholder="Previous"
						value={field.previous_btn_text ?? ""}
					/>
					<FieldDescription>Default label: Previous.</FieldDescription>
				</Field>
			</FieldSet>
		);
	}

	return null;
}
