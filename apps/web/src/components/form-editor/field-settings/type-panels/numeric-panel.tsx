import type { FormField } from "@StryveForms/forms/types";
import {
	Field,
	FieldDescription,
	FieldLabel,
	FieldSet,
} from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";

import { useEditor } from "../../state/editor-context";

/** Options for `rating`, `scale`, and `slider` numeric-range answers. */
export function NumericPanel({ field }: { field: FormField }) {
	const { updateField } = useEditor();

	if (field.type === "rating") {
		return (
			<FieldSet>
				<Field>
					<FieldLabel htmlFor={`${field.id}-rating-max`}>Max rating</FieldLabel>
					<Input
						id={`${field.id}-rating-max`}
						max={10}
						min={1}
						onChange={(e) =>
							updateField(field.id, {
								rating_max_value: Number(e.target.value),
							})
						}
						type="number"
						value={field.rating_max_value ?? 5}
					/>
					<FieldDescription>
						Highest number of stars a respondent can give, from 1.
					</FieldDescription>
				</Field>
			</FieldSet>
		);
	}

	const prefix = field.type === "scale" ? "scale" : "slider";
	const min = (field[`${prefix}_min_value`] as number | undefined) ?? 0;
	const max = (field[`${prefix}_max_value`] as number | undefined) ?? 5;
	const step = (field[`${prefix}_step_value`] as number | undefined) ?? 1;

	return (
		<FieldSet className="grid grid-cols-3 gap-2">
			<Field>
				<FieldLabel htmlFor={`${field.id}-min`}>Min</FieldLabel>
				<Input
					id={`${field.id}-min`}
					onChange={(e) =>
						updateField(field.id, {
							[`${prefix}_min_value`]: Number(e.target.value),
						})
					}
					type="number"
					value={min}
				/>
				<FieldDescription>Lowest allowed value.</FieldDescription>
			</Field>
			<Field>
				<FieldLabel htmlFor={`${field.id}-max`}>Max</FieldLabel>
				<Input
					id={`${field.id}-max`}
					onChange={(e) =>
						updateField(field.id, {
							[`${prefix}_max_value`]: Number(e.target.value),
						})
					}
					type="number"
					value={max}
				/>
				<FieldDescription>Highest allowed value.</FieldDescription>
			</Field>
			<Field>
				<FieldLabel htmlFor={`${field.id}-step`}>Step</FieldLabel>
				<Input
					id={`${field.id}-step`}
					onChange={(e) =>
						updateField(field.id, {
							[`${prefix}_step_value`]: Number(e.target.value),
						})
					}
					type="number"
					value={step}
				/>
				<FieldDescription>Amount per increment.</FieldDescription>
			</Field>
		</FieldSet>
	);
}
