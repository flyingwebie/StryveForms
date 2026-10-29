import { Input } from "@StryveForms/ui/components/input";
import { inputTheme } from "../theme";
import type { FieldComponentProps } from "../types";
import { toText } from "../value-utils";

export function EmailField({
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
			inputMode="email"
			maxLength={field.max_char_limit}
			onChange={(e) => onChange(e.target.value)}
			placeholder={field.placeholder}
			required={required}
			type="email"
			value={toText(value)}
		/>
	);
}
