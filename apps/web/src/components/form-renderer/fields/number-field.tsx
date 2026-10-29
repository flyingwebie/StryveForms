import { Input } from "@StryveForms/ui/components/input";
import { inputTheme } from "../theme";
import type { FieldComponentProps } from "../types";
import { toNumberInputValue } from "../value-utils";

export function NumberField({
	borderRadius,
	disabled,
	error,
	field,
	id,
	onChange,
	required,
	size,
	theme,
	value,
}: FieldComponentProps) {
	return (
		<Input
			aria-invalid={Boolean(error)}
			className={inputTheme({
				borderRadius,
				hasError: Boolean(error),
				size,
				theme,
			})}
			disabled={disabled}
			id={id}
			inputMode="decimal"
			onChange={(e) =>
				onChange(e.target.value === "" ? undefined : Number(e.target.value))
			}
			placeholder={field.placeholder}
			required={required}
			type="number"
			value={toNumberInputValue(value)}
		/>
	);
}
