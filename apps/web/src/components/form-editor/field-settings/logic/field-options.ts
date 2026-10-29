import type {
	ComputedVariable,
	FormField,
	SelectOption,
} from "@StryveForms/forms/types";
import { fieldOptions } from "@StryveForms/forms/types";

/** A pickable target for a condition: a form field, or a computed variable. */
export interface FieldOption {
	id: string;
	name: string;
	options?: SelectOption[];
	resultType?: string;
	type: string;
}

export function buildFieldOptions(
	fields: FormField[],
	computedVariables: ComputedVariable[],
	excludeFieldId?: string
): FieldOption[] {
	const fieldOpts: FieldOption[] = fields
		.filter(
			(field) => field.id !== excludeFieldId && field.type !== "nf-page-break"
		)
		.map((field) => ({
			id: field.id,
			name: field.name,
			options:
				field.type === "select" || field.type === "multi_select"
					? fieldOptions(field)
					: undefined,
			type: field.type,
		}));
	const variableOpts: FieldOption[] = computedVariables.map((variable) => ({
		id: variable.id,
		name: variable.name,
		resultType: variable.result_type,
		type: "computed",
	}));
	return [...fieldOpts, ...variableOpts];
}
