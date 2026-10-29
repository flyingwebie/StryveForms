import { type FormField, fieldOptions } from "@StryveForms/forms/types";
import { Button } from "@StryveForms/ui/components/button";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import { Input } from "@StryveForms/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Switch } from "@StryveForms/ui/components/switch";
import { CopyIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type PrefillValue = string | boolean | string[] | undefined;

function copy(text: string) {
	navigator.clipboard.writeText(text);
	toast.success("Copied to clipboard");
}

/** One row of the prefill builder: the right input depends on the field's type. */
function PrefillRow({
	field,
	onChange,
	value,
}: {
	field: FormField;
	onChange: (value: PrefillValue) => void;
	value: PrefillValue;
}) {
	if (field.type === "checkbox") {
		return (
			<Switch
				checked={value === true}
				onCheckedChange={(checked) => onChange(checked ? true : undefined)}
			/>
		);
	}
	if (field.type === "select") {
		const options = fieldOptions(field);
		return (
			<Select
				items={options.map((o) => ({ label: o.name, value: o.id }))}
				onValueChange={(next) => onChange(next ?? undefined)}
				value={typeof value === "string" ? value : null}
			>
				<SelectTrigger className="w-full">
					<SelectValue placeholder="Pick a value" />
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
	if (field.type === "multi_select") {
		const options = fieldOptions(field);
		const selected = Array.isArray(value) ? value : [];
		return (
			<div className="flex flex-wrap gap-3">
				{options.map((option) => (
					<label
						className="flex items-center gap-1.5 text-sm"
						htmlFor={`prefill-opt-${option.id}`}
						key={option.id}
					>
						<Checkbox
							checked={selected.includes(option.id)}
							id={`prefill-opt-${option.id}`}
							onCheckedChange={(checked) => {
								const next = checked
									? [...selected, option.id]
									: selected.filter((id) => id !== option.id);
								onChange(next.length > 0 ? next : undefined);
							}}
						/>
						{option.name}
					</label>
				))}
			</div>
		);
	}
	return (
		<Input
			onChange={(event) => onChange(event.target.value || undefined)}
			placeholder="Value"
			value={typeof value === "string" ? value : ""}
		/>
	);
}

/**
 * Builds a prefilled share link. Query params use the field's *id* (not its
 * label) as the key — that's what the public form reads to prefill answers,
 * array-valued fields (multi-select) repeat the key with a `[]` suffix.
 */
export function PrefillPanel({
	fields,
	shareUrl,
}: {
	fields: FormField[];
	shareUrl: string;
}) {
	const [values, setValues] = useState<Record<string, PrefillValue>>({});

	const link = useMemo(() => {
		const params = new URLSearchParams();
		for (const [id, value] of Object.entries(values)) {
			if (value === undefined || value === "") {
				continue;
			}
			if (Array.isArray(value)) {
				for (const item of value) {
					params.append(`${id}[]`, item);
				}
			} else {
				params.set(id, String(value));
			}
		}
		const query = params.toString();
		return query ? `${shareUrl}?${query}` : shareUrl;
	}, [values, shareUrl]);

	if (fields.length === 0) {
		return (
			<p className="py-6 text-center text-muted-foreground text-sm">
				This form has no fillable fields to prefill yet.
			</p>
		);
	}

	return (
		<div className="space-y-4">
			<p className="text-muted-foreground text-sm">
				Pick values below to pre-fill the form when it's opened from this link.
				Each parameter uses the field's id, not its label — the link still works
				if you rename a field later.
			</p>
			<div className="space-y-3">
				{fields.map((field) => (
					<div className="grid grid-cols-3 items-center gap-3" key={field.id}>
						<label
							className="truncate text-muted-foreground text-sm"
							htmlFor={`prefill-${field.id}`}
							title={`Param: ${field.id}`}
						>
							{field.name}
						</label>
						<div className="col-span-2" id={`prefill-${field.id}`}>
							<PrefillRow
								field={field}
								onChange={(value) =>
									setValues((prev) => ({ ...prev, [field.id]: value }))
								}
								value={values[field.id]}
							/>
						</div>
					</div>
				))}
			</div>
			<div className="flex gap-2">
				<Input className="font-mono text-xs" readOnly value={link} />
				<Button onClick={() => copy(link)} variant="outline">
					<CopyIcon /> Copy
				</Button>
			</div>
		</div>
	);
}
