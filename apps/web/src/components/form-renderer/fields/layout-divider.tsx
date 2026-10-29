import type { FormField } from "@StryveForms/forms/types";
import { fieldWidthClass } from "../field-wrapper";

export function LayoutDivider({ field }: { field: FormField }) {
	return (
		<div className={fieldWidthClass(field)}>
			<hr className="border-neutral-200 dark:border-neutral-700" />
		</div>
	);
}
