import type { ConditionLeaf } from "@StryveForms/forms/logic";
import { Button } from "@StryveForms/ui/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Trash2Icon } from "lucide-react";

import { ConditionValueInput } from "./condition-value-input";
import type { FieldOption } from "./field-options";
import { type OperatorContext, operatorsForFieldType } from "./operators";

export function ConditionLeafRow({
	context,
	fieldOptions,
	leaf,
	onChange,
	onRemove,
}: {
	context: OperatorContext;
	fieldOptions: FieldOption[];
	leaf: ConditionLeaf;
	onChange: (leaf: ConditionLeaf) => void;
	onRemove: () => void;
}) {
	const targetId = leaf.value?.property_meta.id;
	const target = fieldOptions.find((f) => f.id === targetId);
	const operators = target ? operatorsForFieldType(target.type, context) : [];
	const selectedOperator = operators.find(
		(op) => op.value === leaf.value?.operator
	);
	const fieldItems = Object.fromEntries(
		fieldOptions.map((option) => [
			option.id,
			`${option.name}${option.type === "computed" ? " (variable)" : ""}`,
		])
	);
	const operatorItems = Object.fromEntries(
		operators.map((op) => [op.value, op.label])
	);

	function setField(fieldId: string | null) {
		const next = fieldOptions.find((f) => f.id === fieldId);
		if (!next) {
			return;
		}
		const [firstOperator] = operatorsForFieldType(next.type, context);
		onChange({
			identifier: `${fieldId}-${Date.now()}`,
			value: {
				operator: firstOperator?.value ?? "equals",
				property_meta: {
					id: next.id,
					type: next.type,
					...(next.resultType ? { result_type: next.resultType } : {}),
				},
				value: undefined,
			},
		});
	}

	function setOperator(operator: string | null) {
		if (!(leaf.value && operator)) {
			return;
		}
		onChange({ ...leaf, value: { ...leaf.value, operator, value: undefined } });
	}

	function setValue(value: unknown) {
		if (!leaf.value) {
			return;
		}
		onChange({ ...leaf, value: { ...leaf.value, value } });
	}

	return (
		<div className="flex flex-wrap items-center gap-2 rounded-lg border border-input border-dashed p-2">
			<Select
				items={fieldItems}
				onValueChange={setField}
				value={targetId ?? undefined}
			>
				<SelectTrigger
					className="w-44"
					size="sm"
					title="The field (or computed variable) this condition checks."
				>
					<SelectValue placeholder="Choose a field" />
				</SelectTrigger>
				<SelectContent>
					{fieldOptions.map((option) => (
						<SelectItem key={option.id} value={option.id}>
							{option.name}
							{option.type === "computed" ? " (variable)" : ""}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{target && (
				<Select
					items={operatorItems}
					onValueChange={setOperator}
					value={leaf.value?.operator}
				>
					<SelectTrigger
						className="w-44"
						size="sm"
						title="How the field's answer is compared to the value."
					>
						<SelectValue placeholder="Choose an operator" />
					</SelectTrigger>
					<SelectContent>
						{operators.map((op) => (
							<SelectItem key={op.value} value={op.value}>
								{op.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
			{target && selectedOperator ? (
				<ConditionValueInput
					onChange={setValue}
					targetField={target}
					value={leaf.value?.value}
					valueKind={selectedOperator.valueKind}
				/>
			) : null}
			<Button
				onClick={onRemove}
				size="icon-sm"
				title="Remove this condition"
				type="button"
				variant="ghost"
			>
				<Trash2Icon />
			</Button>
		</div>
	);
}
