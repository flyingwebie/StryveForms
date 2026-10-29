import { resolveMentions } from "@StryveForms/forms/mentions";
import type { FormField } from "@StryveForms/forms/types";
import { fieldWidthClass } from "../field-wrapper";

/** `nf-text`: static HTML with mentions resolved live against current answers. */
export function LayoutText({
	field,
	values,
}: {
	field: FormField;
	values: Record<string, unknown>;
}) {
	const html = resolveMentions(field.content, values);
	return (
		<div className={fieldWidthClass(field)}>
			<div
				className="prose prose-sm dark:prose-invert max-w-none"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: form owner's own HTML block; mentions are HTML-escaped by resolveMentions
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		</div>
	);
}
