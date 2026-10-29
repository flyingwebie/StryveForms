import { RichTextEditor } from "@StryveForms/ui/components/rich-text-editor";
import type { FieldComponentProps } from "../types";
import { toText } from "../value-utils";

export function RichTextField({
	disabled,
	error,
	field,
	onChange,
	value,
}: FieldComponentProps) {
	return (
		<RichTextEditor
			aria-label={field.name}
			disabled={disabled}
			invalid={Boolean(error)}
			maxLength={field.max_char_limit}
			onChange={onChange}
			placeholder={field.placeholder}
			toolbar="basic"
			value={toText(value)}
		/>
	);
}
