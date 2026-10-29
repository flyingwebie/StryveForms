/**
 * Operator tables per field-value type, matching the switch in
 * `@StryveForms/forms/logic`'s `propertyConditionMet` so the UI never offers
 * an operator the evaluator can't run. `valueKind` drives which value input
 * the condition-leaf editor renders.
 */

export type OperatorValueKind =
	| "boolean"
	| "date"
	| "none"
	| "number"
	| "option"
	| "options"
	| "text";

export interface OperatorDef {
	label: string;
	value: string;
	valueKind: OperatorValueKind;
}

const CONTENT_LENGTH: OperatorDef[] = [
	{
		label: "Length equals",
		value: "content_length_equals",
		valueKind: "number",
	},
	{
		label: "Length doesn't equal",
		value: "content_length_does_not_equal",
		valueKind: "number",
	},
	{
		label: "Length is greater than",
		value: "content_length_greater_than",
		valueKind: "number",
	},
	{
		label: "Length is at least",
		value: "content_length_greater_than_or_equal_to",
		valueKind: "number",
	},
	{
		label: "Length is less than",
		value: "content_length_less_than",
		valueKind: "number",
	},
	{
		label: "Length is at most",
		value: "content_length_less_than_or_equal_to",
		valueKind: "number",
	},
];

const EMPTY_OPS: OperatorDef[] = [
	{ label: "Is empty", value: "is_empty", valueKind: "none" },
	{ label: "Is not empty", value: "is_not_empty", valueKind: "none" },
];

const TEXT_OPS: OperatorDef[] = [
	{ label: "Equals", value: "equals", valueKind: "text" },
	{ label: "Doesn't equal", value: "does_not_equal", valueKind: "text" },
	{ label: "Contains", value: "contains", valueKind: "text" },
	{ label: "Doesn't contain", value: "does_not_contain", valueKind: "text" },
	{ label: "Starts with", value: "starts_with", valueKind: "text" },
	{ label: "Ends with", value: "ends_with", valueKind: "text" },
	...EMPTY_OPS,
	...CONTENT_LENGTH,
	{ label: "Matches regex", value: "matches_regex", valueKind: "text" },
	{
		label: "Doesn't match regex",
		value: "does_not_match_regex",
		valueKind: "text",
	},
];

const NUMBER_OPS: OperatorDef[] = [
	{ label: "Equals", value: "equals", valueKind: "number" },
	{ label: "Doesn't equal", value: "does_not_equal", valueKind: "number" },
	{ label: "Greater than", value: "greater_than", valueKind: "number" },
	{
		label: "Greater than or equal to",
		value: "greater_than_or_equal_to",
		valueKind: "number",
	},
	{ label: "Less than", value: "less_than", valueKind: "number" },
	{
		label: "Less than or equal to",
		value: "less_than_or_equal_to",
		valueKind: "number",
	},
	...EMPTY_OPS,
];

const CHECKBOX_OPS: OperatorDef[] = [
	{ label: "Is checked", value: "is_checked", valueKind: "none" },
	{ label: "Is not checked", value: "is_not_checked", valueKind: "none" },
];

const SELECT_OPS: OperatorDef[] = [
	{ label: "Equals", value: "equals", valueKind: "option" },
	{ label: "Doesn't equal", value: "does_not_equal", valueKind: "option" },
	...EMPTY_OPS,
];

const MULTI_SELECT_OPS: OperatorDef[] = [
	{ label: "Contains", value: "contains", valueKind: "options" },
	{ label: "Doesn't contain", value: "does_not_contain", valueKind: "options" },
	...EMPTY_OPS,
];

const DATE_OPS: OperatorDef[] = [
	{ label: "Equals", value: "equals", valueKind: "date" },
	{ label: "Is before", value: "before", valueKind: "date" },
	{ label: "Is after", value: "after", valueKind: "date" },
	{ label: "Is on or before", value: "on_or_before", valueKind: "date" },
	{ label: "Is on or after", value: "on_or_after", valueKind: "date" },
	{
		label: "Is within the next X days",
		value: "within_next_x_days",
		valueKind: "number",
	},
	{
		label: "Is within the past X days",
		value: "within_past_x_days",
		valueKind: "number",
	},
	{
		label: "Is at least X days from now",
		value: "at_least_x_days_from_now",
		valueKind: "number",
	},
	{
		label: "Was at least X days ago",
		value: "at_least_x_days_ago",
		valueKind: "number",
	},
	{ label: "Is in the next week", value: "next_week", valueKind: "none" },
	{ label: "Is in the next month", value: "next_month", valueKind: "none" },
	{ label: "Is in the next year", value: "next_year", valueKind: "none" },
	{ label: "Was in the past week", value: "past_week", valueKind: "none" },
	{ label: "Was in the past month", value: "past_month", valueKind: "none" },
	{ label: "Was in the past year", value: "past_year", valueKind: "none" },
	...EMPTY_OPS,
];

const FILE_OPS: OperatorDef[] = [...EMPTY_OPS];

const MATRIX_OPS: OperatorDef[] = [
	{ label: "Equals", value: "equals", valueKind: "none" },
	{ label: "Doesn't equal", value: "does_not_equal", valueKind: "none" },
	{ label: "Contains", value: "contains", valueKind: "none" },
	{ label: "Doesn't contain", value: "does_not_contain", valueKind: "none" },
];

const PAYMENT_OPS: OperatorDef[] = [
	{ label: "Has paid", value: "paid", valueKind: "none" },
	{ label: "Hasn't paid", value: "not_paid", valueKind: "none" },
];

/**
 * `exists_in_submissions` / `does_not_exist_in_submissions` are evaluated
 * server-side only (against earlier submissions) and, per OpnForm's
 * `open_filters.json`, only ever offered for custom field validation, never
 * for normal show/hide/require logic.
 */
const EXISTS_IN_SUBMISSIONS_OPS: OperatorDef[] = [
	{
		label: "Already exists in submissions",
		value: "exists_in_submissions",
		valueKind: "none",
	},
	{
		label: "Doesn't exist in submissions yet",
		value: "does_not_exist_in_submissions",
		valueKind: "none",
	},
];

/** Field types OpnForm allows `exists_in_submissions` on (`open_filters.json`). */
const SUPPORTS_EXISTS_IN_SUBMISSIONS = new Set([
	"barcode",
	"date",
	"email",
	"matrix",
	"multi_select",
	"number",
	"phone_number",
	"rich_text",
	"select",
	"slider",
	"text",
	"url",
]);

export type OperatorContext = "logic" | "validation";

function baseOperatorsForFieldType(type: string): OperatorDef[] {
	switch (type) {
		case "text":
		case "rich_text":
		case "url":
		case "email":
		case "phone_number":
		case "barcode":
			return TEXT_OPS;
		case "number":
		case "rating":
		case "scale":
		case "slider":
			return NUMBER_OPS;
		case "checkbox":
			return CHECKBOX_OPS;
		case "select":
			return SELECT_OPS;
		case "multi_select":
			return MULTI_SELECT_OPS;
		case "date":
			return DATE_OPS;
		case "files":
		case "signature":
			return FILE_OPS;
		case "matrix":
			return MATRIX_OPS;
		case "payment":
			return PAYMENT_OPS;
		case "computed":
			return [
				...NUMBER_OPS,
				...TEXT_OPS.filter((op) => op.valueKind === "text"),
			];
		default:
			return EMPTY_OPS;
	}
}

/**
 * Maps a field's stored `type` to the operator table its answers support.
 * Pass `context: "validation"` (custom field validation only) to also offer
 * the server-only `exists_in_submissions` operators where OpnForm allows them.
 */
export function operatorsForFieldType(
	type: string,
	context: OperatorContext = "logic"
): OperatorDef[] {
	const base = baseOperatorsForFieldType(type);
	if (context === "validation" && SUPPORTS_EXISTS_IN_SUBMISSIONS.has(type)) {
		return [...base, ...EXISTS_IN_SUBMISSIONS_OPS];
	}
	return base;
}

export const LOGIC_ACTIONS: { label: string; value: string }[] = [
	{ label: "Show this field", value: "show-block" },
	{ label: "Hide this field", value: "hide-block" },
	{ label: "Require an answer", value: "require-answer" },
	{ label: "Make it optional", value: "make-it-optional" },
	{ label: "Disable this field", value: "disable-block" },
	{ label: "Enable this field", value: "enable-block" },
];

/**
 * OpnForm's allowed-action table: a field starts hidden or shown, so only the
 * action that flips it the other way (plus the enable/require pair) makes
 * sense to offer for it.
 */
export function allowedActionsFor(
	field: {
		disabled?: boolean;
		hidden?: boolean;
		required?: boolean;
	},
	options: { isLayoutBlock?: boolean } = {}
): { label: string; value: string }[] {
	const showOrHide = field.hidden
		? { label: "Show this field", value: "show-block" }
		: { label: "Hide this field", value: "hide-block" };

	// Layout blocks (text, page break, divider, image, video, audio, code)
	// only support show/hide: `layout-block && hidden => ['show-block']`,
	// `layout-block => ['hide-block']` (spec A §4.3/§4.5). Hiding a page
	// break merges the pages around it.
	if (options.isLayoutBlock) {
		return [showOrHide];
	}

	const actions: { label: string; value: string }[] = [showOrHide];
	actions.push(
		field.required
			? { label: "Make it optional", value: "make-it-optional" }
			: { label: "Require an answer", value: "require-answer" }
	);
	actions.push(
		field.disabled
			? { label: "Enable this field", value: "enable-block" }
			: { label: "Disable this field", value: "disable-block" }
	);
	return actions;
}
