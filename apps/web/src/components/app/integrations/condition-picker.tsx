import type { FormField } from "@StryveForms/forms/types";
import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { XIcon } from "lucide-react";

export interface SimpleCondition {
	fieldId: string;
	operator: string;
	value: string;
}

const OPERATORS = [
	{ label: "equals", needsValue: true, value: "equals" },
	{ label: "does not equal", needsValue: true, value: "does_not_equal" },
	{ label: "contains", needsValue: true, value: "contains" },
	{ label: "does not contain", needsValue: true, value: "does_not_contain" },
	{ label: "is empty", needsValue: false, value: "is_empty" },
	{ label: "is not empty", needsValue: false, value: "is_not_empty" },
];

/** A single "only send if <field> <operator> <value>" condition. */
export default function ConditionPicker({
	condition,
	fields,
	onChange,
}: {
	condition: SimpleCondition | null;
	fields: FormField[];
	onChange: (condition: SimpleCondition | null) => void;
}) {
	if (!condition) {
		return (
			<Button
				onClick={() =>
					onChange({
						fieldId: fields[0]?.id ?? "",
						operator: "equals",
						value: "",
					})
				}
				size="sm"
				variant="outline"
			>
				Only send if…
			</Button>
		);
	}

	const needsValue =
		OPERATORS.find((o) => o.value === condition.operator)?.needsValue ?? true;

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Select
				items={fields.map((field) => ({ label: field.name, value: field.id }))}
				onValueChange={(fieldId) =>
					onChange({ ...condition, fieldId: fieldId ?? "" })
				}
				value={condition.fieldId}
			>
				<SelectTrigger className="w-40">
					<SelectValue placeholder="Field" />
				</SelectTrigger>
				<SelectContent>
					{fields.map((field) => (
						<SelectItem key={field.id} value={field.id}>
							{field.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				items={OPERATORS}
				onValueChange={(operator) =>
					onChange({ ...condition, operator: operator ?? "equals" })
				}
				value={condition.operator}
			>
				<SelectTrigger className="w-40">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{OPERATORS.map((op) => (
						<SelectItem key={op.value} value={op.value}>
							{op.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{needsValue ? (
				<Input
					className="w-40"
					onChange={(event) =>
						onChange({ ...condition, value: event.target.value })
					}
					placeholder="Value"
					value={condition.value}
				/>
			) : null}
			<Button onClick={() => onChange(null)} size="icon-sm" variant="ghost">
				<XIcon />
			</Button>
		</div>
	);
}

export function conditionToLogic(
	condition: SimpleCondition | null,
	fields: FormField[]
) {
	if (!condition) {
		return null;
	}
	const field = fields.find((f) => f.id === condition.fieldId);
	if (!field) {
		return null;
	}
	return {
		identifier: "condition-1",
		value: {
			operator: condition.operator,
			property_meta: { id: field.id, type: field.type },
			value: condition.value,
		},
	};
}

export function logicToCondition(logic: unknown): SimpleCondition | null {
	if (!logic || typeof logic !== "object") {
		return null;
	}
	const value = (logic as { value?: unknown }).value as
		| { operator?: string; property_meta?: { id?: string }; value?: unknown }
		| undefined;
	if (!(value?.property_meta?.id && value.operator)) {
		return null;
	}
	return {
		fieldId: value.property_meta.id,
		operator: value.operator,
		value: typeof value.value === "string" ? value.value : "",
	};
}
