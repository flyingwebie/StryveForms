import type { FormField } from "@StryveForms/forms/types";
import { fieldOptions } from "@StryveForms/forms/types";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import { Input } from "@StryveForms/ui/components/input";
import { PhoneInput } from "@StryveForms/ui/components/phone-input";
import { RichTextEditor } from "@StryveForms/ui/components/rich-text-editor";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Textarea } from "@StryveForms/ui/components/textarea";

function MultiSelectInput({
	field,
	onChange,
	value,
}: {
	field: FormField;
	onChange: (value: unknown) => void;
	value: unknown;
}) {
	const options = fieldOptions(field);
	const selected = Array.isArray(value) ? (value as string[]) : [];
	return (
		<div className="space-y-1">
			{options.map((option) => {
				const checked = selected.includes(option.id);
				const inputId = `msel-${field.id}-${option.id}`;
				return (
					<div className="flex items-center gap-2 text-sm" key={option.id}>
						<Checkbox
							checked={checked}
							id={inputId}
							onCheckedChange={(c) =>
								onChange(
									c === true
										? [...selected, option.id]
										: selected.filter((id) => id !== option.id)
								)
							}
						/>
						<label htmlFor={inputId}>{option.name}</label>
					</div>
				);
			})}
		</div>
	);
}

function SingleSelectInput({
	field,
	onChange,
	value,
}: {
	field: FormField;
	onChange: (value: unknown) => void;
	value: unknown;
}) {
	const options = fieldOptions(field);
	return (
		<Select
			items={options.map((option) => ({
				label: option.name,
				value: option.id,
			}))}
			onValueChange={onChange}
			value={typeof value === "string" ? value : ""}
		>
			<SelectTrigger className="w-full">
				<SelectValue placeholder="Select an option" />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.id} value={option.id}>
						{option.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

/** A simple, type-appropriate input for editing one submission answer. */
export default function SubmissionFieldInput({
	field,
	onChange,
	value,
}: {
	field: FormField;
	onChange: (value: unknown) => void;
	value: unknown;
}) {
	switch (field.type) {
		case "checkbox":
			return (
				<Checkbox
					checked={value === true}
					onCheckedChange={(c) => onChange(c === true)}
				/>
			);
		case "number":
		case "rating":
		case "scale":
		case "slider":
			return (
				<Input
					onChange={(event) =>
						onChange(
							event.target.value === "" ? null : Number(event.target.value)
						)
					}
					type="number"
					value={value === undefined || value === null ? "" : String(value)}
				/>
			);
		case "date":
			return (
				<Input
					onChange={(event) => onChange(event.target.value)}
					type={field.with_time ? "datetime-local" : "date"}
					value={typeof value === "string" ? value : ""}
				/>
			);
		case "phone_number":
			return (
				<PhoneInput
					onChange={(v) => onChange(v ?? "")}
					value={typeof value === "string" ? value : undefined}
				/>
			);
		case "rich_text":
			return (
				<RichTextEditor
					onChange={onChange}
					toolbar="basic"
					value={typeof value === "string" ? value : ""}
				/>
			);
		case "select":
			return (
				<SingleSelectInput field={field} onChange={onChange} value={value} />
			);
		case "multi_select":
			return (
				<MultiSelectInput field={field} onChange={onChange} value={value} />
			);
		case "files":
		case "signature":
		case "matrix":
			return (
				<p className="text-muted-foreground text-sm">
					This answer type can't be edited here yet.
				</p>
			);
		default:
			if (field.multi_lines) {
				return (
					<Textarea
						onChange={(event) => onChange(event.target.value)}
						value={typeof value === "string" ? value : ""}
					/>
				);
			}
			return (
				<Input
					onChange={(event) => onChange(event.target.value)}
					value={typeof value === "string" ? value : ""}
				/>
			);
	}
}
