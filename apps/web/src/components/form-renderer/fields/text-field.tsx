import { matchesInputMask } from "@StryveForms/forms/validation";
import { Input } from "@StryveForms/ui/components/input";
import { Textarea } from "@StryveForms/ui/components/textarea";
import { useId } from "react";
import { inputTheme } from "../theme";
import type { FieldComponentProps } from "../types";
import { toText } from "../value-utils";

/** Plain text field: single line, multi-line, password (secret_input), input mask, char counter. */
export function TextField({
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
	const text = toText(value);
	const counterId = useId();
	const maskBad =
		Boolean(field.input_mask) &&
		text.length > 0 &&
		!matchesInputMask(String(field.input_mask), text);
	const hasError = Boolean(error) || maskBad;
	const className = inputTheme({ borderRadius, hasError, size, theme });

	if (field.multi_lines) {
		return (
			<div className="flex flex-col gap-1">
				<Textarea
					aria-describedby={field.show_char_limit ? counterId : undefined}
					aria-invalid={hasError}
					className={className}
					disabled={disabled}
					id={id}
					maxLength={field.max_char_limit}
					onChange={(e) => onChange(e.target.value)}
					placeholder={field.placeholder}
					required={required}
					value={text}
				/>
				{field.show_char_limit && field.max_char_limit ? (
					<span className="self-end text-neutral-400 text-xs" id={counterId}>
						{text.length} / {field.max_char_limit}
					</span>
				) : null}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-1">
			<Input
				aria-describedby={field.show_char_limit ? counterId : undefined}
				aria-invalid={hasError}
				className={className}
				disabled={disabled}
				id={id}
				maxLength={field.max_char_limit}
				onChange={(e) => onChange(e.target.value)}
				placeholder={field.placeholder}
				required={required}
				type={field.secret_input ? "password" : "text"}
				value={text}
			/>
			{field.show_char_limit && field.max_char_limit ? (
				<span className="self-end text-neutral-400 text-xs" id={counterId}>
					{text.length} / {field.max_char_limit}
				</span>
			) : null}
		</div>
	);
}
