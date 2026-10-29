import { Input } from "@StryveForms/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";

import type { FieldOption } from "./field-options";
import type { OperatorValueKind } from "./operators";

function OptionValueInput({
	onChange,
	options,
	value,
}: {
	onChange: (value: unknown) => void;
	options: FieldOption["options"];
	value: unknown;
}) {
	if (!options || options.length === 0) {
		return (
			<Input
				className="w-40"
				onChange={(e) => onChange(e.target.value)}
				placeholder="Value"
				value={typeof value === "string" ? value : ""}
			/>
		);
	}
	const items = Object.fromEntries(
		options.map((option) => [option.name, option.name])
	);
	return (
		<Select
			items={items}
			onValueChange={onChange}
			value={typeof value === "string" ? value : undefined}
		>
			<SelectTrigger className="w-40">
				<SelectValue placeholder="Choose option" />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.id} value={option.name}>
						{option.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function OptionsValueInput({
	onChange,
	options,
	value,
}: {
	onChange: (value: unknown) => void;
	options: FieldOption["options"];
	value: unknown;
}) {
	const selected = Array.isArray(value) ? value.map(String) : [];
	if (!options || options.length === 0) {
		return (
			<Input
				className="w-40"
				onChange={(e) => onChange(e.target.value)}
				placeholder="Value"
				value={typeof value === "string" ? value : ""}
			/>
		);
	}
	return (
		<div className="flex flex-wrap gap-2">
			{options.map((option) => {
				const checked = selected.includes(option.name);
				return (
					<button
						className={`rounded-lg border px-2 py-1 text-xs ${
							checked
								? "border-primary bg-primary/10 text-primary"
								: "border-input text-muted-foreground"
						}`}
						key={option.id}
						onClick={() =>
							onChange(
								checked
									? selected.filter((name) => name !== option.name)
									: [...selected, option.name]
							)
						}
						type="button"
					>
						{option.name}
					</button>
				);
			})}
		</div>
	);
}

export function ConditionValueInput({
	onChange,
	targetField,
	value,
	valueKind,
}: {
	onChange: (value: unknown) => void;
	targetField: FieldOption | undefined;
	value: unknown;
	valueKind: OperatorValueKind;
}) {
	if (valueKind === "none") {
		return null;
	}
	if (valueKind === "number") {
		return (
			<Input
				className="w-28"
				onChange={(e) =>
					onChange(e.target.value === "" ? "" : Number(e.target.value))
				}
				type="number"
				value={
					typeof value === "number" || typeof value === "string" ? value : ""
				}
			/>
		);
	}
	if (valueKind === "date") {
		return (
			<Input
				onChange={(e) => onChange(e.target.value)}
				type="date"
				value={typeof value === "string" ? value : ""}
			/>
		);
	}
	if (valueKind === "option") {
		return (
			<OptionValueInput
				onChange={onChange}
				options={targetField?.options}
				value={value}
			/>
		);
	}
	if (valueKind === "options") {
		return (
			<OptionsValueInput
				onChange={onChange}
				options={targetField?.options}
				value={value}
			/>
		);
	}
	return (
		<Input
			className="w-40"
			onChange={(e) => onChange(e.target.value)}
			placeholder="Value"
			value={typeof value === "string" ? value : ""}
		/>
	);
}
