import { Input } from "@StryveForms/ui/components/input";
import { PhoneInput } from "@StryveForms/ui/components/phone-input";
import { compositeInputClass, inputTheme } from "../theme";
import type { FieldComponentProps } from "../types";
import { toText } from "../value-utils";

export function PhoneField({
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
	if (field.use_simple_text_input) {
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
				onChange={(e) => onChange(e.target.value)}
				placeholder={field.placeholder}
				required={required}
				type="tel"
				value={toText(value)}
			/>
		);
	}
	return (
		<PhoneInput
			className={compositeInputClass(size, borderRadius)}
			disabled={disabled}
			id={id}
			invalid={Boolean(error)}
			onChange={(next) => onChange(next ?? "")}
			placeholder={field.placeholder}
			unavailableCountries={field.unavailable_countries}
			value={toText(value) || undefined}
		/>
	);
}
