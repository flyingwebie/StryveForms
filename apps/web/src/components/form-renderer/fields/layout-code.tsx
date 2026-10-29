import type { FormField } from "@StryveForms/forms/types";
import { fieldWidthClass } from "../field-wrapper";

/** `nf-code`: raw HTML from the form owner, sandboxed in an iframe. */
export function LayoutCode({ field }: { field: FormField }) {
	if (!field.content) {
		return null;
	}
	return (
		<div className={fieldWidthClass(field)}>
			<iframe
				className="w-full"
				sandbox="allow-scripts"
				srcDoc={field.content}
				title={field.name || "Embedded content"}
			/>
		</div>
	);
}
