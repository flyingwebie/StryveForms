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

/** Options for `text`, `rich_text`, `email`, `url` (text-shaped answers). */
export function TextPanel({ field }: { field: FormField }) {
	const { updateField } = useEditor();
	const isPlainText = field.type === "text";

	return (
		<FieldSet>
			{isPlainText && (
				<FieldSet className="gap-3">
					<Field orientation="horizontal">
						<Checkbox
							checked={Boolean(field.multi_lines)}
							id={`${field.id}-multiline`}
							onCheckedChange={(checked) =>
								updateField(field.id, { multi_lines: checked === true })
							}
						/>
						<FieldContent>
							<FieldLabel htmlFor={`${field.id}-multiline`}>
								Multiple lines
							</FieldLabel>
							<FieldDescription>
								Renders a textarea instead of a single-line input.
							</FieldDescription>
						</FieldContent>
					</Field>
					<Field orientation="horizontal">
						<Checkbox
							checked={Boolean(field.secret_input)}
							id={`${field.id}-secret`}
							onCheckedChange={(checked) =>
								updateField(field.id, { secret_input: checked === true })
							}
						/>
						<FieldContent>
							<FieldLabel htmlFor={`${field.id}-secret`}>
								Password field (hide characters)
							</FieldLabel>
							<FieldDescription>
								Masks what's typed. The answer is still stored as plain text.
							</FieldDescription>
						</FieldContent>
					</Field>
				</FieldSet>
			)}
			{field.type === "url" && (
				<Field orientation="horizontal">
					<Checkbox
						checked={Boolean(field.file_upload)}
						id={`${field.id}-file-upload`}
						onCheckedChange={(checked) =>
							updateField(field.id, { file_upload: checked === true })
						}
					/>
					<FieldContent>
						<FieldLabel htmlFor={`${field.id}-file-upload`}>
							Let respondents upload a file instead of a link
						</FieldLabel>
						<FieldDescription>
							The stored answer becomes the uploaded file's link.
						</FieldDescription>
					</FieldContent>
				</Field>
			)}
			<Field>
				<FieldLabel htmlFor={`${field.id}-mask`}>Input mask</FieldLabel>
				<Input
					id={`${field.id}-mask`}
					onChange={(e) =>
						updateField(field.id, { input_mask: e.target.value })
					}
					placeholder="e.g. 999-999-9999"
					value={field.input_mask ?? ""}
				/>
				<FieldDescription>
					9 = digit, a = letter, * = either, ? makes the previous character
					optional.
				</FieldDescription>
			</Field>
			{field.input_mask ? (
				<Field>
					<FieldLabel htmlFor={`${field.id}-slot-char`}>
						Placeholder character
					</FieldLabel>
					<Input
						id={`${field.id}-slot-char`}
						maxLength={1}
						onChange={(e) =>
							updateField(field.id, { slot_char: e.target.value })
						}
						value={field.slot_char ?? "_"}
					/>
					<FieldDescription>
						Shown in the mask's empty slots before the respondent types.
					</FieldDescription>
				</Field>
			) : null}
			<Field>
				<FieldLabel htmlFor={`${field.id}-max-chars`}>
					Max characters
				</FieldLabel>
				<Input
					id={`${field.id}-max-chars`}
					onChange={(e) =>
						updateField(field.id, {
							max_char_limit: e.target.value
								? Number(e.target.value)
								: undefined,
						})
					}
					type="number"
					value={field.max_char_limit ?? ""}
				/>
				<FieldDescription>
					Longest answer allowed. Leave blank for no limit.
				</FieldDescription>
			</Field>
			<Field orientation="horizontal">
				<Checkbox
					checked={Boolean(field.show_char_limit)}
					id={`${field.id}-show-limit`}
					onCheckedChange={(checked) =>
						updateField(field.id, { show_char_limit: checked === true })
					}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${field.id}-show-limit`}>
						Show character counter
					</FieldLabel>
					<FieldDescription>
						Shows a live count below the input as the respondent types.
					</FieldDescription>
				</FieldContent>
			</Field>
			{isPlainText && (
				<FieldSet className="gap-3">
					<Field orientation="horizontal">
						<Checkbox
							checked={Boolean(field.generates_uuid)}
							id={`${field.id}-uuid`}
							onCheckedChange={(checked) =>
								updateField(field.id, { generates_uuid: checked === true })
							}
						/>
						<FieldContent>
							<FieldLabel htmlFor={`${field.id}-uuid`}>
								Auto-generate a UUID
							</FieldLabel>
							<FieldDescription>
								Fills the field with a random unique id on load, hidden from the
								respondent.
							</FieldDescription>
						</FieldContent>
					</Field>
					<Field orientation="horizontal">
						<Checkbox
							checked={Boolean(field.generates_auto_increment_id)}
							id={`${field.id}-auto-increment`}
							onCheckedChange={(checked) =>
								updateField(field.id, {
									generates_auto_increment_id: checked === true,
								})
							}
						/>
						<FieldContent>
							<FieldLabel htmlFor={`${field.id}-auto-increment`}>
								Auto-increment id
							</FieldLabel>
							<FieldDescription>
								Fills the field with a number that counts up by one per
								submission.
							</FieldDescription>
						</FieldContent>
					</Field>
				</FieldSet>
			)}
		</FieldSet>
	);
}
