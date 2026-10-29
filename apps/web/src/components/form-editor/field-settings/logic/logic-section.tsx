import { isLayoutType } from "@StryveForms/forms/blocks";
import type { LogicAction } from "@StryveForms/forms/logic";
import type { FormField } from "@StryveForms/forms/types";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldSet,
} from "@StryveForms/ui/components/field";

import { useEditor } from "../../state/editor-context";
import { ConditionTree } from "./condition-tree";
import { buildFieldOptions } from "./field-options";
import { allowedActionsFor } from "./operators";

export function LogicSection({ field }: { field: FormField }) {
	const { state, updateField } = useEditor();
	const properties = state.settings.properties as FormField[];
	const fieldOptions = buildFieldOptions(
		properties,
		state.settings.computedVariables,
		field.id
	);
	const logic = field.logic ?? { actions: [], conditions: null };
	const isLayoutBlock = isLayoutType(field.type);
	const actions = allowedActionsFor(field, { isLayoutBlock });
	const actionHint: Record<string, string> = {
		"disable-block": "Field stays visible but respondents can't edit it.",
		"enable-block": "Re-enables a field that starts disabled.",
		"hide-block": "Field (and its answer) is removed from the live form.",
		"make-it-optional": "Respondents can submit without answering it.",
		"require-answer": "Respondents must answer before submitting.",
		"show-block": "Reveals a field that starts hidden.",
	};

	function toggleAction(action: string, checked: boolean) {
		const nextActions = checked
			? [...logic.actions, action as LogicAction]
			: logic.actions.filter((a) => a !== action);
		updateField(field.id, { logic: { ...logic, actions: nextActions } });
	}

	return (
		<FieldSet>
			<FieldContent>
				<p className="text-muted-foreground text-xs">
					When the conditions below are met, perform these actions on this
					field.
				</p>
			</FieldContent>
			<ConditionTree
				fieldOptions={fieldOptions}
				onChange={(conditions) =>
					updateField(field.id, { logic: { ...logic, conditions } })
				}
				value={logic.conditions}
			/>
			{logic.conditions ? (
				<FieldSet className="gap-3">
					{actions.map((action) => (
						<Field key={action.value} orientation="horizontal">
							<Checkbox
								checked={logic.actions.includes(action.value as LogicAction)}
								id={`action-${action.value}`}
								onCheckedChange={(checked) =>
									toggleAction(action.value, checked === true)
								}
							/>
							<FieldContent>
								<FieldLabel htmlFor={`action-${action.value}`}>
									{action.label}
								</FieldLabel>
								<FieldDescription>{actionHint[action.value]}</FieldDescription>
							</FieldContent>
						</Field>
					))}
				</FieldSet>
			) : null}
		</FieldSet>
	);
}
