import { Input } from "@StryveForms/ui/components/input";
import { inputTheme } from "../theme";
import type { FieldComponentProps } from "../types";
import { toText } from "../value-utils";
import { FilesField } from "./files-field";

/** A link field, or — with `file_upload` — a single-file uploader instead of a URL input. */
export function UrlField(props: FieldComponentProps) {
	if (props.field.file_upload) {
		return <FilesField {...props} />;
	}
	const {
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
	} = props;
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
			inputMode="url"
			maxLength={field.max_char_limit}
			onChange={(e) => onChange(e.target.value)}
			placeholder={field.placeholder}
			required={required}
			type="url"
			value={toText(value)}
		/>
	);
}
