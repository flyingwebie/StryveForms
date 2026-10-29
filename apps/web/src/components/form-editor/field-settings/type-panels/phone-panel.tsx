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

export function PhonePanel({ field }: { field: FormField }) {
	const { updateField } = useEditor();

	return (
		<FieldSet>
			<Field orientation="horizontal">
				<Checkbox
					checked={Boolean(field.use_simple_text_input)}
					id={`${field.id}-simple-input`}
					onCheckedChange={(checked) =>
						updateField(field.id, { use_simple_text_input: checked === true })
					}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${field.id}-simple-input`}>
						Use a plain text input instead of a phone picker
					</FieldLabel>
					<FieldDescription>
						Skips the country-code dropdown and formatting.
					</FieldDescription>
				</FieldContent>
			</Field>
			{!field.use_simple_text_input && (
				<Field>
					<FieldLabel htmlFor={`${field.id}-unavailable-countries`}>
						Unavailable countries
					</FieldLabel>
					<Input
						id={`${field.id}-unavailable-countries`}
						onChange={(e) =>
							updateField(field.id, {
								unavailable_countries: e.target.value
									.split(",")
									.map((c) => c.trim().toUpperCase())
									.filter(Boolean),
							})
						}
						placeholder="US, CA"
						value={(field.unavailable_countries ?? []).join(", ")}
					/>
					<FieldDescription>
						Comma-separated ISO country codes to hide from the picker.
					</FieldDescription>
				</Field>
			)}
		</FieldSet>
	);
}
