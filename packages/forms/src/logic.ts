/**
 * Conditional logic, compatible with OpnForm's `property.logic` JSON.
 *
 * A logic tree is either a group `{ operatorIdentifier: "and" | "or", children }`
 * or a leaf `{ identifier, value: { operator, property_meta: { id, type }, value } }`.
 */

import { resolveConditionValue } from "./mentions";

export type LogicAction =
	| "hide-block"
	| "show-block"
	| "require-answer"
	| "make-it-optional"
	| "disable-block"
	| "enable-block";

export interface PropertyCondition {
	operator: string;
	property_meta: { id: string; type: string; result_type?: string };
	value?: unknown;
}

export interface ConditionLeaf {
	identifier?: string;
	value: PropertyCondition | null;
}

export interface ConditionGroup {
	children: ConditionNode[];
	operatorIdentifier: "and" | "or";
}

export type ConditionNode = ConditionGroup | ConditionLeaf;

export interface FieldLogic {
	actions: LogicAction[];
	conditions: ConditionNode | null;
}

export type FormValues = Record<string, unknown>;

export interface LogicContext {
	/** Server-only: does this answer already exist in earlier submissions? */
	existsInSubmissions?:
		| ((fieldId: string, value: unknown) => boolean)
		| undefined;
}

function isGroup(node: ConditionNode): node is ConditionGroup {
	return "operatorIdentifier" in node;
}

export function conditionsMet(
	conditions: ConditionNode | null | undefined,
	values: FormValues,
	context: LogicContext = {}
): boolean {
	if (!conditions) {
		return false;
	}
	if (!isGroup(conditions)) {
		const condition = conditions.value;
		if (!condition?.property_meta) {
			return false;
		}
		const resolved: PropertyCondition = {
			...condition,
			value:
				condition.value === undefined || condition.value === null
					? condition.value
					: resolveConditionValue(condition.value, values),
		};
		const fieldValue = values[condition.property_meta.id];
		if (resolved.operator === "exists_in_submissions") {
			return (
				context.existsInSubmissions?.(condition.property_meta.id, fieldValue) ??
				false
			);
		}
		if (resolved.operator === "does_not_exist_in_submissions") {
			return !(
				context.existsInSubmissions?.(condition.property_meta.id, fieldValue) ??
				false
			);
		}
		return propertyConditionMet(resolved, fieldValue);
	}
	const { children } = conditions;
	if (conditions.operatorIdentifier === "and") {
		return children.every((child) => conditionsMet(child, values, context));
	}
	if (conditions.operatorIdentifier === "or") {
		return children.some((child) => conditionsMet(child, values, context));
	}
	return false;
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function toNumber(value: unknown): number | null {
	if (value === undefined || value === null || value === "") {
		return null;
	}
	const parsed =
		typeof value === "number" ? value : Number.parseFloat(String(value));
	return Number.isNaN(parsed) ? null : parsed;
}

function isEmpty(value: unknown): boolean {
	if (
		value === undefined ||
		value === null ||
		value === false ||
		value === ""
	) {
		return true;
	}
	if (Array.isArray(value) || typeof value === "string") {
		return value.length === 0;
	}
	if (typeof value === "number") {
		return value === 0;
	}
	return false;
}

function equals(conditionValue: unknown, value: unknown): boolean {
	if (typeof conditionValue === "number" || typeof value === "number") {
		const a = toNumber(conditionValue);
		const b = toNumber(value);
		if (a !== null && b !== null) {
			return a === b;
		}
	}
	return conditionValue === value;
}

function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) {
		return true;
	}
	if (
		typeof a !== "object" ||
		typeof b !== "object" ||
		a === null ||
		b === null
	) {
		return false;
	}
	if (Array.isArray(a) !== Array.isArray(b)) {
		return false;
	}
	const keysA = Object.keys(a);
	const keysB = Object.keys(b);
	if (keysA.length !== keysB.length) {
		return false;
	}
	return keysA.every((key) =>
		deepEqual(
			(a as Record<string, unknown>)[key],
			(b as Record<string, unknown>)[key]
		)
	);
}

function lengthCompare(value: unknown, target: unknown, op: string): boolean {
	let text: string | unknown[] = "";
	if (typeof value === "string" || Array.isArray(value)) {
		text = value;
	} else if (typeof value === "number") {
		text = String(value);
	}
	const { length } = text;
	if (length === 0) {
		return false;
	}
	const n = Number.parseInt(String(target), 10);
	switch (op) {
		case "content_length_equals":
			return length === n;
		case "content_length_does_not_equal":
			return length !== n;
		case "content_length_greater_than":
			return length > n;
		case "content_length_greater_than_or_equal_to":
			return length >= n;
		case "content_length_less_than":
			return length < n;
		case "content_length_less_than_or_equal_to":
			return length <= n;
		default:
			return false;
	}
}

function regexTest(pattern: unknown, value: unknown): boolean | null {
	if (typeof pattern !== "string" || typeof value !== "string") {
		return null;
	}
	try {
		return new RegExp(pattern).test(value);
	} catch {
		return null;
	}
}

function numericCompare(op: string, value: unknown, target: unknown): boolean {
	const a = toNumber(value);
	const b = toNumber(target);
	if (a === null || b === null) {
		return false;
	}
	switch (op) {
		case "greater_than":
			return a > b;
		case "greater_than_or_equal_to":
			return a >= b;
		case "less_than":
			return a < b;
		case "less_than_or_equal_to":
			return a <= b;
		default:
			return false;
	}
}

/* -------------------------------------------------------------------------- */
/*                               Per-type checks                              */
/* -------------------------------------------------------------------------- */

function textConditionMet(
	{ operator, value: target }: PropertyCondition,
	value: unknown
) {
	switch (operator) {
		case "equals":
			return equals(target, value);
		case "does_not_equal":
			return !equals(target, value);
		case "contains":
			return (
				typeof value === "string" &&
				typeof target === "string" &&
				value.includes(target)
			);
		case "does_not_contain":
			return !(
				typeof value === "string" &&
				typeof target === "string" &&
				value.includes(target)
			);
		case "starts_with":
			return (
				typeof value === "string" &&
				typeof target === "string" &&
				value.startsWith(target)
			);
		case "ends_with":
			return (
				typeof value === "string" &&
				typeof target === "string" &&
				value.endsWith(target)
			);
		case "is_empty":
			return isEmpty(value);
		case "is_not_empty":
			return !isEmpty(value);
		case "matches_regex":
			return regexTest(target, value) === true;
		case "does_not_match_regex":
			return regexTest(target, value) !== true;
		default:
			return (
				operator.startsWith("content_length_") &&
				lengthCompare(value, target, operator)
			);
	}
}

function numberConditionMet(
	{ operator, value: target }: PropertyCondition,
	value: unknown
) {
	switch (operator) {
		case "equals":
			return equals(target, value);
		case "does_not_equal":
			return !equals(target, value);
		case "greater_than":
		case "greater_than_or_equal_to":
		case "less_than":
		case "less_than_or_equal_to":
			return numericCompare(operator, value, target);
		case "is_empty":
			return isEmpty(value);
		case "is_not_empty":
			return !isEmpty(value);
		default:
			return (
				operator.startsWith("content_length_") &&
				lengthCompare(value, target, operator)
			);
	}
}

function checkboxConditionMet({ operator }: PropertyCondition, value: unknown) {
	switch (operator) {
		case "is_checked":
		case "equals":
			return value === true;
		case "is_not_checked":
		case "does_not_equal":
			return value !== true;
		default:
			return false;
	}
}

function selectConditionMet(
	{ operator, value: target }: PropertyCondition,
	value: unknown
) {
	switch (operator) {
		case "equals":
			return equals(target, value);
		case "does_not_equal":
			return !equals(target, value);
		case "is_empty":
			return isEmpty(value);
		case "is_not_empty":
			return !isEmpty(value);
		default:
			return false;
	}
}

function listContains(list: unknown, target: unknown): boolean {
	if (!Array.isArray(list)) {
		return (
			typeof list === "string" &&
			typeof target === "string" &&
			list.includes(target)
		);
	}
	if (Array.isArray(target)) {
		return target.every((t) => list.includes(t));
	}
	return list.includes(target);
}

function multiSelectConditionMet(
	{ operator, value: target }: PropertyCondition,
	value: unknown
) {
	switch (operator) {
		case "contains":
			return listContains(value, target);
		case "does_not_contain":
			return !listContains(value, target);
		case "is_empty":
			return isEmpty(value);
		case "is_not_empty":
			return !isEmpty(value);
		default:
			return false;
	}
}

function startOfToday(offsetDays = 0, offsetMonths = 0, offsetYears = 0): Date {
	const now = new Date();
	return new Date(
		now.getFullYear() + offsetYears,
		now.getMonth() + offsetMonths,
		now.getDate() + offsetDays
	);
}

function asDate(value: unknown): Date | null {
	if (typeof value !== "string" && !(value instanceof Date)) {
		return null;
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function relativeDayCheck(
	operator: string,
	field: Date,
	days: number
): boolean {
	const today = startOfToday();
	switch (operator) {
		case "at_least_x_days_ago":
			return field <= startOfToday(-days);
		case "at_least_x_days_from_now":
			return field >= startOfToday(days);
		case "within_past_x_days":
			return field >= startOfToday(-days) && field <= today;
		case "within_next_x_days":
			return field >= today && field <= startOfToday(days);
		default:
			return false;
	}
}

const RANGE_CHECKS: Record<string, (d: Date) => boolean> = {
	next_month: (d) => d >= new Date() && d <= startOfToday(0, 1),
	next_week: (d) => d >= new Date() && d <= startOfToday(7),
	next_year: (d) => d >= new Date() && d <= startOfToday(0, 0, 1),
	past_month: (d) => d <= new Date() && d >= startOfToday(0, -1),
	past_week: (d) => d <= new Date() && d >= startOfToday(-7),
	past_year: (d) => d <= new Date() && d >= startOfToday(0, 0, -1),
};

/** Dates are compared as ISO strings, like OpnForm does. */
function compareDateStrings(
	operator: string,
	value: unknown,
	target: unknown
): boolean {
	if (!(target && value)) {
		return false;
	}
	const a = String(value);
	const b = String(target);
	switch (operator) {
		case "equals":
			return a.slice(0, 10) === b.slice(0, 10);
		case "before":
			return a < b;
		case "after":
			return a > b;
		case "on_or_before":
			return a <= b;
		case "on_or_after":
			return a >= b;
		default:
			return false;
	}
}

function dateConditionMet(
	{ operator, value: target }: PropertyCondition,
	value: unknown
) {
	// Date ranges are stored as [start, end]; conditions look at the start date.
	const fieldValue = Array.isArray(value) ? value[0] : value;
	switch (operator) {
		case "is_empty":
			return isEmpty(fieldValue);
		case "is_not_empty":
			return !isEmpty(fieldValue);
		case "matches_regex":
			return regexTest(target, fieldValue) === true;
		case "does_not_match_regex":
			return regexTest(target, fieldValue) !== true;
		case "equals":
		case "before":
		case "after":
		case "on_or_before":
		case "on_or_after":
			return compareDateStrings(operator, fieldValue, target);
		default:
			break;
	}
	const date = asDate(fieldValue);
	if (!date) {
		return false;
	}
	const range = RANGE_CHECKS[operator];
	if (range) {
		return range(date);
	}
	const days = Number.parseInt(String(target), 10);
	if (Number.isNaN(days) || days < 0) {
		return false;
	}
	return relativeDayCheck(operator, date, days);
}

function matrixConditionMet(
	{ operator, value: target }: PropertyCondition,
	value: unknown
) {
	const contains = () => {
		if (
			typeof value !== "object" ||
			value === null ||
			typeof target !== "object" ||
			!target
		) {
			return false;
		}
		const answers = value as Record<string, unknown>;
		return Object.entries(target as Record<string, unknown>).some(
			// biome-ignore lint/suspicious/noDoubleEquals: OpnForm compares matrix cells loosely (1 == "1")
			([row, column]) => answers[row] == column
		);
	};
	switch (operator) {
		case "equals":
			return deepEqual(target, value);
		case "does_not_equal":
			return !deepEqual(target, value);
		case "contains":
			return contains();
		case "does_not_contain":
			return !contains();
		default:
			return false;
	}
}

function computedConditionMet(condition: PropertyCondition, value: unknown) {
	const resultType = condition.property_meta.result_type;
	const numeric =
		(resultType &&
			["number", "numeric", "integer", "float"].includes(resultType)) ||
		typeof value === "number";
	if (!numeric) {
		return textConditionMet(condition, value);
	}
	const a = toNumber(condition.value);
	const b = toNumber(value);
	if (condition.operator === "equals") {
		return a !== null && b !== null && a === b;
	}
	if (condition.operator === "does_not_equal") {
		return a === null || b === null || a !== b;
	}
	return numberConditionMet(condition, value);
}

export function propertyConditionMet(
	condition: PropertyCondition,
	value: unknown
): boolean {
	switch (condition.property_meta.type) {
		case "text":
		case "rich_text":
		case "url":
		case "email":
		case "phone_number":
		case "barcode":
			return textConditionMet(condition, value);
		case "number":
		case "rating":
		case "scale":
		case "slider":
			return numberConditionMet(condition, value);
		case "checkbox":
			return checkboxConditionMet(condition, value);
		case "select":
			return selectConditionMet(condition, value);
		case "multi_select":
			return multiSelectConditionMet(condition, value);
		case "date":
			return dateConditionMet(condition, value);
		case "files":
		case "signature":
			return condition.operator === "is_empty"
				? isEmpty(value)
				: !isEmpty(value);
		case "matrix":
			return matrixConditionMet(condition, value);
		case "payment": {
			const paid = typeof value === "string" && value.startsWith("pi_");
			return condition.operator === "paid" ? paid : !paid;
		}
		case "computed":
			return computedConditionMet(condition, value);
		default:
			return false;
	}
}

/* -------------------------------------------------------------------------- */
/*                              Field resolution                              */
/* -------------------------------------------------------------------------- */

export interface LogicTarget {
	disabled?: boolean | undefined;
	hidden?: boolean | undefined;
	logic?: FieldLogic | null | false | undefined;
	required?: boolean | undefined;
}

export interface FieldState {
	disabled: boolean;
	hidden: boolean;
	required: boolean;
}

/**
 * Applies a field's logic to its static flags. An action only flips a flag
 * in one direction (e.g. `show-block` only un-hides a hidden field).
 */
function activeLogic(logic: LogicTarget["logic"]): FieldLogic | null {
	if (!logic) {
		return null;
	}
	if (logic.conditions === null || !Array.isArray(logic.actions)) {
		return null;
	}
	return logic.actions.length > 0 ? logic : null;
}

export function resolveFieldState(
	field: LogicTarget,
	values: FormValues
): FieldState {
	const base: FieldState = {
		disabled: Boolean(field.disabled),
		hidden: Boolean(field.hidden),
		required: Boolean(field.required),
	};
	const logic = activeLogic(field.logic);
	if (!(logic && conditionsMet(logic.conditions, values))) {
		return base;
	}
	const has = (action: LogicAction) => logic.actions.includes(action);
	return {
		disabled:
			(base.disabled && has("enable-block") ? false : base.disabled) ||
			(!base.disabled && has("disable-block")),
		hidden:
			(base.hidden && has("show-block") ? false : base.hidden) ||
			(!base.hidden && has("hide-block")),
		required:
			(base.required && has("make-it-optional") ? false : base.required) ||
			(!base.required && has("require-answer")),
	};
}

/** Field ids referenced anywhere in a logic tree (used to warn about broken logic). */
export function referencedFieldIds(
	conditions: ConditionNode | null | undefined
): string[] {
	if (!conditions) {
		return [];
	}
	if (isGroup(conditions)) {
		return conditions.children.flatMap(referencedFieldIds);
	}
	return conditions.value?.property_meta?.id
		? [conditions.value.property_meta.id]
		: [];
}
