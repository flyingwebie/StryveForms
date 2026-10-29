import type { FormField } from "@StryveForms/forms/types";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldSet,
} from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";

import { useEditor } from "../../state/editor-context";

export function FilesPanel({ field }: { field: FormField }) {
	const { updateField } = useEditor();

	return (
		<FieldSet>
			<Field orientation="horizontal">
				<Checkbox
					checked={Boolean(field.multiple)}
					id={`${field.id}-multiple`}
					onCheckedChange={(checked) =>
						updateField(field.id, { multiple: checked === true })
					}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${field.id}-multiple`}>
						Allow multiple files
					</FieldLabel>
					<FieldDescription>
						Lets respondents attach more than one file.
					</FieldDescription>
				</FieldContent>
			</Field>
			<Field orientation="horizontal">
				<Checkbox
					checked={Boolean(field.camera_upload)}
					id={`${field.id}-camera`}
					onCheckedChange={(checked) =>
						updateField(field.id, { camera_upload: checked === true })
					}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${field.id}-camera`}>
						Allow capturing from camera
					</FieldLabel>
					<FieldDescription>
						Adds a "take a photo" option on devices with a camera.
					</FieldDescription>
				</FieldContent>
			</Field>
			<Field>
				<FieldLabel htmlFor={`${field.id}-allowed-types`}>
					Allowed file types
				</FieldLabel>
				<Input
					id={`${field.id}-allowed-types`}
					onChange={(e) =>
						updateField(field.id, { allowed_file_types: e.target.value })
					}
					placeholder=".pdf,.png,.jpg"
					value={field.allowed_file_types ?? ""}
				/>
				<FieldDescription>
					Comma-separated extensions. Leave empty to allow any file.
				</FieldDescription>
			</Field>
			<Field>
				<FieldLabel htmlFor={`${field.id}-max-size`}>
					Max file size (MB)
				</FieldLabel>
				<Input
					id={`${field.id}-max-size`}
					onChange={(e) =>
						updateField(field.id, {
							max_file_size: e.target.value
								? Number(e.target.value)
								: undefined,
						})
					}
					type="number"
					value={field.max_file_size ?? ""}
				/>
				<FieldDescription>
					Largest a single upload can be. Leave blank for the account default.
				</FieldDescription>
			</Field>
		</FieldSet>
	);
}
