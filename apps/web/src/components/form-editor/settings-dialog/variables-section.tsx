import { validateComputedVariables } from "@StryveForms/forms/computed";
import type { ComputedVariable, FormField } from "@StryveForms/forms/types";
import { Button } from "@StryveForms/ui/components/button";
import { FieldDescription } from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";
import { Textarea } from "@StryveForms/ui/components/textarea";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { nanoid } from "nanoid";
import { useMemo } from "react";

import { useEditor } from "../state/editor-context";
import { SettingsSection } from "./settings-row";

const FUNCTION_NAMES = [
	"SUM",
	"AVERAGE",
	"MIN",
	"MAX",
	"ROUND",
	"IF",
	"AND",
	"OR",
	"NOT",
	"CONCAT",
	"UPPER",
	"LOWER",
	"LEN",
	"ISBLANK",
	"COALESCE",
	"SWITCH",
];

function VariableRow({
	errors,
	fieldIds,
	variable,
}: {
	errors: string[];
	fieldIds: string[];
	variable: ComputedVariable;
}) {
	const { patch, state } = useEditor();
	const variables = state.settings.computedVariables;

	function update(patchValue: Partial<ComputedVariable>) {
		patch({
			computedVariables: variables.map((v) =>
				v.id === variable.id ? { ...v, ...patchValue } : v
			),
		});
	}

	function remove() {
		patch({
			computedVariables: variables.filter((v) => v.id !== variable.id),
		});
	}

	return (
		<div className="flex flex-col gap-2 rounded-lg border border-primary/30 p-3">
			<div className="flex items-center gap-2">
				<Input
					className="flex-1 font-medium"
					onChange={(e) => update({ name: e.target.value })}
					placeholder="Variable name"
					value={variable.name}
				/>
				<Button onClick={remove} size="icon-xs" type="button" variant="ghost">
					<Trash2Icon />
				</Button>
			</div>
			<Textarea
				className="min-h-16 font-mono"
				onChange={(e) => update({ formula: e.target.value })}
				placeholder={`SUM({${fieldIds[0] ?? "field_id"}}, 10)`}
				value={variable.formula}
			/>
			<div className="flex flex-wrap items-center gap-1.5">
				<span className="text-muted-foreground text-xs">Functions</span>
				{FUNCTION_NAMES.map((name) => (
					<span
						className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
						key={name}
					>
						{name}
					</span>
				))}
			</div>
			{errors.length > 0 ? (
				<FieldDescription className="text-destructive">
					{errors.join(" ")}
				</FieldDescription>
			) : null}
		</div>
	);
}

export function VariablesSection() {
	const { patch, readOnly, state } = useEditor();
	const properties = state.settings.properties as FormField[];
	const variables = state.settings.computedVariables;
	const fieldIds = properties.map((f) => f.id);

	const errorsByVariable = useMemo(() => {
		const errors = validateComputedVariables(variables, fieldIds);
		const map = new Map<string, string[]>();
		for (const error of errors) {
			map.set(error.id, [...(map.get(error.id) ?? []), error.message]);
		}
		return map;
	}, [variables, fieldIds]);

	function addVariable() {
		const id = `cv_${nanoid(8)}`;
		patch({
			computedVariables: [
				...variables,
				{ formula: "", id, name: `Variable ${variables.length + 1}` },
			],
		});
	}

	return (
		<fieldset className="flex flex-col gap-8" disabled={readOnly}>
			<SettingsSection
				description={
					<>
						Reference a field or another variable with{" "}
						<code>
							{"{"}field_id{"}"}
						</code>
						. Available functions: {FUNCTION_NAMES.join(", ")}.
					</>
				}
				title="Variables"
			>
				<div className="flex items-center justify-end">
					<Button
						onClick={addVariable}
						size="sm"
						type="button"
						variant="outline"
					>
						<PlusIcon /> Add variable
					</Button>
				</div>
				<div className="flex flex-col gap-2 pt-3">
					{variables.map((variable) => (
						<VariableRow
							errors={errorsByVariable.get(variable.id) ?? []}
							fieldIds={fieldIds}
							key={variable.id}
							variable={variable}
						/>
					))}
				</div>
			</SettingsSection>
		</fieldset>
	);
}
