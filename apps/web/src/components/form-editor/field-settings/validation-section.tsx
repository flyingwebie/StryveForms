import type { FormField } from "@StryveForms/forms/types";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldSet,
} from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";

import { useEditor } from "../state/editor-context";
import { ConditionTree } from "./logic/condition-tree";
import { buildFieldOptions } from "./logic/field-options";

export function ValidationSection({ field }: { field: FormField }) {
	const { state, updateField } = useEditor();
	const properties = state.settings.properties as FormField[];
	const fieldOptions = buildFieldOptions(
		properties,
		state.settings.computedVariables,
		field.id
	);
	const validation = field.validation ?? {
		error_conditions: { conditions: null },
		error_message: "",
	};

	return (
		<FieldSet>
			<FieldContent>
				<FieldDescription>
					Reject an answer unless these conditions are met, and show a custom
					error message.
				</FieldDescription>
			</FieldContent>
			<ConditionTree
				context="validation"
				fieldOptions={fieldOptions}
				onChange={(conditions) =>
					updateField(field.id, {
						validation: {
							...validation,
							error_conditions: { conditions },
						},
					})
				}
				value={validation.error_conditions.conditions ?? null}
			/>
			<Field>
				<FieldLabel htmlFor="validation-error-message">
					Error message
				</FieldLabel>
				<Input
					id="validation-error-message"
					onChange={(e) =>
						updateField(field.id, {
							validation: { ...validation, error_message: e.target.value },
						})
					}
					placeholder="This answer isn't valid."
					value={validation.error_message}
				/>
				<FieldDescription>
					Shown under the field when the conditions above aren't met.
				</FieldDescription>
			</Field>
		</FieldSet>
	);
}
