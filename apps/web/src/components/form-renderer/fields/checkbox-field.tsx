import { Checkbox } from "@StryveForms/ui/components/checkbox";
import { Switch } from "@StryveForms/ui/components/switch";
import type { FieldComponentProps } from "../types";

function isChecked(value: unknown): boolean {
	return value === true || value === "true" || value === 1 || value === "1";
}

/** Checkbox, toggle switch (`use_toggle_switch`), or a large focused-mode toggle button. */
export function CheckboxField({
	disabled,
	field,
	id,
	onChange,
	required,
	value,
}: FieldComponentProps) {
	const checked = isChecked(value);

	if (field.use_focused_toggle) {
		return (
			<button
				aria-pressed={checked}
				className={`w-full rounded-lg border px-4 py-3 text-left font-medium transition-colors ${checked ? "border-[var(--color-form)] bg-[color-mix(in_srgb,var(--bg-form-color)_12%,transparent)]" : "border-neutral-300 dark:border-neutral-600"}`}
				disabled={disabled}
				id={id}
				onClick={() => onChange(!checked)}
				type="button"
			>
				{checked ? "Yes" : "No"}
			</button>
		);
	}

	if (field.use_toggle_switch) {
		return (
			<div className="flex items-center gap-2">
				<Switch
					checked={checked}
					disabled={disabled}
					id={id}
					onCheckedChange={onChange}
					required={required}
				/>
			</div>
		);
	}

	return (
		<Checkbox
			checked={checked}
			disabled={disabled}
			id={id}
			onCheckedChange={onChange}
			required={required}
		/>
	);
}
