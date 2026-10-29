import type { FormField, SelectOption } from "@StryveForms/forms/types";
import { fieldOptions } from "@StryveForms/forms/types";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldSet,
} from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@StryveForms/ui/components/native-select";

import { useEditor } from "../../state/editor-context";
import { OptionListEditor } from "../option-list-editor";

const DISPLAY_MODES = [
	{ label: "Text only", value: "text_only" },
	{ label: "Text and image", value: "text_and_image" },
	{ label: "Image only", value: "image_only" },
];

const IMAGE_SIZES = [
	{ label: "Small", value: "sm" },
	{ label: "Medium", value: "md" },
	{ label: "Large", value: "lg" },
];

export function SelectPanel({ field }: { field: FormField }) {
	const { updateField } = useEditor();
	const isMulti = field.type === "multi_select";
	const options = fieldOptions(field);

	function setOptions(next: SelectOption[]) {
		updateField(
			field.id,
			isMulti
				? { multi_select: { options: next } }
				: { select: { options: next } }
		);
	}

	return (
		<FieldSet>
			<OptionListEditor
				onChange={setOptions}
				options={options}
				withImages={field.option_display_mode !== "text_only"}
			/>
			<FieldSet className="grid grid-cols-2 gap-2">
				<Field>
					<FieldLabel htmlFor={`${field.id}-display-mode`}>
						Display as
					</FieldLabel>
					<NativeSelect
						id={`${field.id}-display-mode`}
						onChange={(e) =>
							updateField(field.id, {
								option_display_mode: e.target.value as never,
							})
						}
						value={field.option_display_mode ?? "text_only"}
					>
						{DISPLAY_MODES.map((mode) => (
							<NativeSelectOption key={mode.value} value={mode.value}>
								{mode.label}
							</NativeSelectOption>
						))}
					</NativeSelect>
					<FieldDescription>Text, an image, or both.</FieldDescription>
				</Field>
				{field.option_display_mode === "text_only" ? null : (
					<Field>
						<FieldLabel htmlFor={`${field.id}-image-size`}>
							Image size
						</FieldLabel>
						<NativeSelect
							id={`${field.id}-image-size`}
							onChange={(e) =>
								updateField(field.id, {
									option_image_size: e.target.value as never,
								})
							}
							value={field.option_image_size ?? "md"}
						>
							{IMAGE_SIZES.map((size) => (
								<NativeSelectOption key={size.value} value={size.value}>
									{size.label}
								</NativeSelectOption>
							))}
						</NativeSelect>
						<FieldDescription>Size of each option's image.</FieldDescription>
					</Field>
				)}
			</FieldSet>
			{!isMulti && (
				<Field orientation="horizontal">
					<Checkbox
						checked={!field.without_dropdown}
						id={`${field.id}-dropdown`}
						onCheckedChange={(checked) =>
							updateField(field.id, { without_dropdown: checked !== true })
						}
					/>
					<FieldContent>
						<FieldLabel htmlFor={`${field.id}-dropdown`}>
							Show as a dropdown
						</FieldLabel>
						<FieldDescription>
							Unchecked: every option shows as its own radio button instead.
						</FieldDescription>
					</FieldContent>
				</Field>
			)}
			<Field orientation="horizontal">
				<Checkbox
					checked={Boolean(field.allow_creation)}
					id={`${field.id}-allow-creation`}
					onCheckedChange={(checked) =>
						updateField(field.id, { allow_creation: checked === true })
					}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${field.id}-allow-creation`}>
						Let respondents add their own option
					</FieldLabel>
					<FieldDescription>
						Adds a "type to add a new option" row, like a tag input.
					</FieldDescription>
				</FieldContent>
			</Field>
			<Field orientation="horizontal">
				<Checkbox
					checked={Boolean(field.shuffle_options)}
					id={`${field.id}-shuffle`}
					onCheckedChange={(checked) =>
						updateField(field.id, { shuffle_options: checked === true })
					}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${field.id}-shuffle`}>
						Shuffle option order
					</FieldLabel>
					<FieldDescription>
						Randomizes the order per respondent, to reduce order bias.
					</FieldDescription>
				</FieldContent>
			</Field>
			{isMulti && (
				<FieldSet className="grid grid-cols-2 gap-2">
					<Field>
						<FieldLabel htmlFor={`${field.id}-min-selection`}>
							Min selections
						</FieldLabel>
						<Input
							id={`${field.id}-min-selection`}
							onChange={(e) =>
								updateField(field.id, {
									min_selection: e.target.value ? Number(e.target.value) : null,
								})
							}
							type="number"
							value={field.min_selection ?? ""}
						/>
						<FieldDescription>Fewest options required.</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${field.id}-max-selection`}>
							Max selections
						</FieldLabel>
						<Input
							id={`${field.id}-max-selection`}
							onChange={(e) =>
								updateField(field.id, {
									max_selection: e.target.value ? Number(e.target.value) : null,
								})
							}
							type="number"
							value={field.max_selection ?? ""}
						/>
						<FieldDescription>Most options allowed.</FieldDescription>
					</Field>
				</FieldSet>
			)}
		</FieldSet>
	);
}
