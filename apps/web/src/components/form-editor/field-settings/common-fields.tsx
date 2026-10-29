import { findDuplicateFieldIds } from "@StryveForms/forms/field-ids";
import { usesFieldWidths } from "@StryveForms/forms/presentation";
import type {
	FieldAlign,
	FieldWidth,
	FormField,
} from "@StryveForms/forms/types";
import { Badge } from "@StryveForms/ui/components/badge";
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
import { RichTextEditor } from "@StryveForms/ui/components/rich-text-editor";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { useEditor } from "../state/editor-context";

const WIDTHS: { label: string; value: FieldWidth }[] = [
	{ label: "Full", value: "full" },
	{ label: "3/4", value: "3/4" },
	{ label: "2/3", value: "2/3" },
	{ label: "1/2", value: "1/2" },
	{ label: "1/3", value: "1/3" },
	{ label: "1/4", value: "1/4" },
];

const ALIGNS: { label: string; value: FieldAlign }[] = [
	{ label: "Left", value: "left" },
	{ label: "Center", value: "center" },
	{ label: "Right", value: "right" },
	{ label: "Justify", value: "justify" },
];

function VisibilityFields({ field }: { field: FormField }) {
	const { updateField } = useEditor();
	return (
		<FieldSet className="flex flex-col gap-3">
			<Field orientation="horizontal">
				<Checkbox
					checked={Boolean(field.required)}
					disabled={Boolean(field.hidden)}
					id={`${field.id}-required`}
					onCheckedChange={(checked) =>
						updateField(field.id, { required: checked === true })
					}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${field.id}-required`}>Required</FieldLabel>
					<FieldDescription>Must be answered to submit.</FieldDescription>
				</FieldContent>
			</Field>
			<Field orientation="horizontal">
				<Checkbox
					checked={Boolean(field.hidden)}
					id={`${field.id}-hidden`}
					onCheckedChange={(checked) =>
						updateField(field.id, { hidden: checked === true })
					}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${field.id}-hidden`}>Hidden</FieldLabel>
					<FieldDescription>
						Removed from the form. Logic can still show it.
					</FieldDescription>
				</FieldContent>
			</Field>
			<Field orientation="horizontal">
				<Checkbox
					checked={Boolean(field.disabled)}
					disabled={Boolean(field.hidden)}
					id={`${field.id}-disabled`}
					onCheckedChange={(checked) =>
						updateField(field.id, { disabled: checked === true })
					}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${field.id}-disabled`}>Disabled</FieldLabel>
					<FieldDescription>Visible, but can't be edited.</FieldDescription>
				</FieldContent>
			</Field>
		</FieldSet>
	);
}

/**
 * The "Field ID" box: the key this answer is stored under in submission
 * data, URL pre-fill parameters, webhook payloads, mentions and logic. New
 * fields auto-slug it from the label until it's hand-edited; editing an
 * existing field's id is allowed but warned, since it's live-wired into
 * every one of those places (the rename is propagated automatically, but
 * an already-collected submission or an external integration that stored
 * the old id won't be).
 */
function FieldIdSettings({ field }: { field: FormField }) {
	const { isExistingField, meta, renameFieldId, state } = useEditor();
	const [draft, setDraft] = useState(field.id);
	const existing = isExistingField(field.id);
	const duplicates = findDuplicateFieldIds(
		state.settings.properties as FormField[]
	);
	const isDuplicate = duplicates.includes(field.id);

	// The field prop is the source of truth (e.g. after an undo); keep the
	// draft in sync whenever it changes from outside this input.
	if (draft !== field.id && document.activeElement?.id !== `${field.id}-id`) {
		setDraft(field.id);
	}

	return (
		<Field>
			<FieldLabel htmlFor={`${field.id}-id`}>
				Field ID
				{isDuplicate ? (
					<Badge className="ml-2" variant="destructive">
						Duplicate
					</Badge>
				) : null}
			</FieldLabel>
			<Input
				aria-invalid={isDuplicate}
				id={`${field.id}-id`}
				onBlur={() => renameFieldId(field.id, draft)}
				onChange={(e) => setDraft(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.currentTarget.blur();
					}
				}}
				value={draft}
			/>
			{isDuplicate ? (
				<FieldDescription className="flex items-center gap-1.5 text-destructive">
					<TriangleAlertIcon className="size-3.5 shrink-0" />
					Another field already uses this id. The form can't be saved until
					every field has a unique one.
				</FieldDescription>
			) : null}
			<FieldDescription>
				{existing ? (
					<span className="flex items-start gap-1.5">
						<TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
						<span>
							Used as the key in submission data, URL pre-fill links, webhook
							payloads, mentions and logic
							{meta.submissionsCount > 0
								? ` — this form already has ${meta.submissionsCount} submission${meta.submissionsCount === 1 ? "" : "s"}`
								: ""}
							. Renaming it updates every reference inside this form, but not
							data already collected or external integrations that stored the
							old id.
						</span>
					</span>
				) : (
					"Auto-generated from the label. Used as the key in submission data, URL pre-fill links, webhook payloads, mentions and logic — edit it now while it's still free to change."
				)}
			</FieldDescription>
		</Field>
	);
}

export function CommonFieldSettings({
	field,
	showPlaceholder = false,
}: {
	field: FormField;
	showPlaceholder?: boolean;
}) {
	const { state, updateField } = useEditor();
	// Focused forms show every question full width, so width doesn't apply.
	const showWidth = usesFieldWidths(state.settings.presentationStyle);

	return (
		<FieldSet>
			<Field>
				<FieldLabel htmlFor={`${field.id}-name`}>Label</FieldLabel>
				<Input
					id={`${field.id}-name`}
					onChange={(e) => updateField(field.id, { name: e.target.value })}
					value={field.name}
				/>
			</Field>
			<FieldIdSettings field={field} />
			<Field orientation="horizontal">
				<Checkbox
					checked={Boolean(field.hide_field_name)}
					id={`${field.id}-hide-label`}
					onCheckedChange={(checked) =>
						updateField(field.id, { hide_field_name: checked === true })
					}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${field.id}-hide-label`}>Hide label</FieldLabel>
					<FieldDescription>
						Keeps the input but removes its visible label text.
					</FieldDescription>
				</FieldContent>
			</Field>
			{showPlaceholder ? (
				<Field>
					<FieldLabel htmlFor={`${field.id}-placeholder`}>
						Placeholder
					</FieldLabel>
					<Input
						id={`${field.id}-placeholder`}
						onChange={(e) =>
							updateField(field.id, { placeholder: e.target.value })
						}
						value={field.placeholder ?? ""}
					/>
				</Field>
			) : null}
			<Field>
				<FieldLabel>Help text</FieldLabel>
				<RichTextEditor
					minHeight={48}
					onChange={(html) => updateField(field.id, { help: html })}
					placeholder="Shown next to the field"
					toolbar="basic"
					value={field.help ?? ""}
				/>
				<FieldDescription>
					<label className="flex items-center gap-2">
						<input
							checked={field.help_position === "above_input"}
							onChange={(e) =>
								updateField(field.id, {
									help_position: e.target.checked
										? "above_input"
										: "below_input",
								})
							}
							type="checkbox"
						/>
						Show above the field instead of below
					</label>
				</FieldDescription>
			</Field>
			<VisibilityFields field={field} />
			<FieldSet className={showWidth ? "grid grid-cols-2 gap-2" : undefined}>
				{showWidth ? (
					<Field>
						<FieldLabel htmlFor={`${field.id}-width`}>Width</FieldLabel>
						<NativeSelect
							id={`${field.id}-width`}
							onChange={(e) =>
								updateField(field.id, { width: e.target.value as FieldWidth })
							}
							value={field.width ?? "full"}
						>
							{WIDTHS.map((w) => (
								<NativeSelectOption key={w.value} value={w.value}>
									{w.label}
								</NativeSelectOption>
							))}
						</NativeSelect>
						<FieldDescription>
							Columns out of 12 this field spans on its row; narrower widths sit
							side by side with neighbours when there's room.
						</FieldDescription>
					</Field>
				) : null}
				<Field>
					<FieldLabel htmlFor={`${field.id}-align`}>Align</FieldLabel>
					<NativeSelect
						id={`${field.id}-align`}
						onChange={(e) =>
							updateField(field.id, { align: e.target.value as FieldAlign })
						}
						value={field.align ?? "left"}
					>
						{ALIGNS.map((a) => (
							<NativeSelectOption key={a.value} value={a.value}>
								{a.label}
							</NativeSelectOption>
						))}
					</NativeSelect>
					<FieldDescription>
						Horizontal text alignment of the field's label and content.
					</FieldDescription>
				</Field>
			</FieldSet>
			<Field>
				<FieldContent>
					<FieldDescription>
						Pre-fill this field for respondents (also accepts a URL query
						parameter with the field's id).
					</FieldDescription>
				</FieldContent>
				<Input
					onChange={(e) => updateField(field.id, { prefill: e.target.value })}
					placeholder="Default value"
					value={typeof field.prefill === "string" ? field.prefill : ""}
				/>
			</Field>
		</FieldSet>
	);
}
