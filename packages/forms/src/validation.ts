/**
 * Answer validation shared by the public form (instant feedback) and the
 * server (authoritative). Mirrors OpnForm's AnswerFormRequest rules.
 */

import { isPossiblePhoneNumber } from "libphonenumber-js";

import { isInputType } from "./blocks";
import { conditionsMet, type FormValues, resolveFieldState } from "./logic";
import { stripHtml } from "./mentions";
import { type FormField, fieldOptions } from "./types";

export type ValidationErrors = Record<string, string>;

export interface ValidateOptions {
	/** Server-side lookup for the `exists_in_submissions` operators. */
	existsInSubmissions?: (fieldId: string, value: unknown) => boolean;
	/** Validate only these field ids (e.g. the current page). */
	onlyFieldIds?: string[];
}

export interface ValidationResult {
	/** Normalised answers to store, keyed by field id. */
	data: Record<string, unknown>;
	errors: ValidationErrors;
	valid: boolean;
}

const URL_PATTERN = /^(https?:\/\/)?(www\.)?[\w.-]+\.\w+(:\d+)?(\/[^\s]*)?$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MASK_TOKENS = /^[9a*().\s\-?]*$/;
const DIGIT = /\d/;
const LETTER = /\p{L}/u;
const ALPHANUMERIC = /[\p{L}\d]/u;
const COUNTRY_PREFIX = /^[A-Z]{2}(?=\+)/;
const DAY_MS = 86_400_000;

export function isEmptyValue(value: unknown): boolean {
	if (value === undefined || value === null || value === "") {
		return true;
	}
	if (Array.isArray(value)) {
		return value.length === 0;
	}
	if (typeof value === "string") {
		return value.trim().length === 0;
	}
	if (typeof value === "object") {
		return Object.values(value as Record<string, unknown>).every(
			(v) => v === null || v === undefined || v === ""
		);
	}
	return false;
}

/* -------------------------------------------------------------------------- */
/*                                 Input masks                                */
/* -------------------------------------------------------------------------- */

interface MaskToken {
	char: string;
	optional: boolean;
}

function parseMask(mask: string): MaskToken[] {
	const tokens: MaskToken[] = [];
	for (const char of mask) {
		const last = tokens.at(-1);
		if (char === "?" && last) {
			last.optional = true;
		} else {
			tokens.push({ char, optional: false });
		}
	}
	return tokens;
}

function tokenMatches(token: string, char: string): boolean {
	if (token === "9") {
		return DIGIT.test(char);
	}
	if (token === "a") {
		return LETTER.test(char);
	}
	if (token === "*") {
		return ALPHANUMERIC.test(char);
	}
	return token === char;
}

function matchFrom(
	tokens: MaskToken[],
	value: string,
	t: number,
	v: number
): boolean {
	const token = tokens[t];
	if (!token) {
		return v === value.length;
	}
	const char = value[v];
	if (
		char !== undefined &&
		tokenMatches(token.char, char) &&
		matchFrom(tokens, value, t + 1, v + 1)
	) {
		return true;
	}
	return token.optional && matchFrom(tokens, value, t + 1, v);
}

/** `9` digit, `a` letter, `*` letter or digit, `?` makes the previous token optional. */
export function matchesInputMask(mask: string, value: string): boolean {
	if (!MASK_TOKENS.test(mask)) {
		return true;
	}
	return matchFrom(parseMask(mask), value, 0, 0);
}

/* -------------------------------------------------------------------------- */
/*                               Per-type checks                              */
/* -------------------------------------------------------------------------- */

type Check = (
	field: FormField,
	value: unknown
) => { error?: string; value?: unknown };

function toNumber(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function checkText(field: FormField, value: unknown) {
	if (typeof value !== "string" && typeof value !== "number") {
		return { error: "Please enter text." };
	}
	const text = String(value);
	if (field.max_char_limit && text.length > field.max_char_limit) {
		return { error: `Please use ${field.max_char_limit} characters or fewer.` };
	}
	if (field.input_mask && !matchesInputMask(field.input_mask, text)) {
		return { error: `Please match the format ${field.input_mask}.` };
	}
	return { value: text };
}

function checkRichText(field: FormField, value: unknown) {
	if (typeof value !== "string") {
		return { error: "Please enter text." };
	}
	if (field.max_char_limit && stripHtml(value).length > field.max_char_limit) {
		return { error: `Please use ${field.max_char_limit} characters or fewer.` };
	}
	return { value };
}

function checkEmail(field: FormField, value: unknown) {
	if (typeof value !== "string" || !EMAIL_PATTERN.test(value.trim())) {
		return { error: "Please enter a valid email address." };
	}
	if (field.max_char_limit && value.length > field.max_char_limit) {
		return { error: `Please use ${field.max_char_limit} characters or fewer.` };
	}
	return { value: value.trim() };
}

function checkUrl(field: FormField, value: unknown) {
	if (field.file_upload) {
		return checkFiles(field, value);
	}
	if (typeof value !== "string" || !URL_PATTERN.test(value.trim())) {
		return { error: "Please enter a valid URL." };
	}
	return { value: value.trim() };
}

/** Phone numbers are stored in E.164 format (e.g. +12025550142). */
export function normalizePhone(value: string): string {
	return value.replace(COUNTRY_PREFIX, "").replace(/[\s()-]/g, "");
}

function checkPhone(field: FormField, value: unknown) {
	if (typeof value !== "string") {
		return { error: "Please enter a phone number." };
	}
	if (field.use_simple_text_input) {
		return { value };
	}
	const phone = normalizePhone(value);
	if (phone.length < 6 || !isPossiblePhoneNumber(phone)) {
		return { error: "Please enter a valid phone number." };
	}
	return { value: phone };
}

function checkNumber(field: FormField, value: unknown) {
	const n = toNumber(value);
	if (n === null) {
		return { error: "Please enter a number." };
	}
	const [min, max] = numericBounds(field);
	if (min !== null && n < min) {
		return { error: `Please enter a value of at least ${min}.` };
	}
	if (max !== null && n > max) {
		return { error: `Please enter a value of at most ${max}.` };
	}
	if (field.type === "rating" && field.required && n < 1) {
		return { error: "Please choose a rating." };
	}
	return { value: n };
}

function numericBounds(field: FormField): [number | null, number | null] {
	switch (field.type) {
		case "rating":
			return [0, field.rating_max_value ?? 5];
		case "scale":
			return [field.scale_min_value ?? null, field.scale_max_value ?? null];
		case "slider":
			return [field.slider_min_value ?? null, field.slider_max_value ?? null];
		default:
			return [null, null];
	}
}

/** Maps an option id to its name, since answers store the option name. */
function optionName(field: FormField, value: unknown): string | null {
	if (typeof value !== "string" && typeof value !== "number") {
		return null;
	}
	const text = String(value);
	const options = fieldOptions(field);
	const match =
		options.find((o) => o.name === text) ?? options.find((o) => o.id === text);
	if (match) {
		return match.name;
	}
	return field.allow_creation ? text : null;
}

function checkSelect(field: FormField, value: unknown) {
	const name = optionName(field, value);
	if (name === null) {
		return { error: "Please choose one of the options." };
	}
	return { value: name };
}

function checkMultiSelect(field: FormField, value: unknown) {
	const list = Array.isArray(value) ? value : [value];
	const names: string[] = [];
	for (const item of list) {
		const name = optionName(field, item);
		if (name === null) {
			return { error: "Please choose from the available options." };
		}
		if (!names.includes(name)) {
			names.push(name);
		}
	}
	if (
		typeof field.min_selection === "number" &&
		names.length < field.min_selection
	) {
		return { error: `Please choose at least ${field.min_selection} options.` };
	}
	if (
		typeof field.max_selection === "number" &&
		names.length > field.max_selection
	) {
		return { error: `Please choose at most ${field.max_selection} options.` };
	}
	return { value: names };
}

function checkCheckbox(field: FormField, value: unknown) {
	const checked =
		value === true || value === "true" || value === 1 || value === "1";
	if (field.required && !checked) {
		return { error: "Please check this box to continue." };
	}
	return { value: checked };
}

function checkMatrix(field: FormField, value: unknown) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return { error: "Please answer every row." };
	}
	const answers = value as Record<string, unknown>;
	const rows = field.rows ?? [];
	const columns = (field.columns ?? []).map(String);
	const clean: Record<string, unknown> = {};
	for (const row of rows) {
		const cell = answers[row];
		if (cell === undefined || cell === null || cell === "") {
			if (field.required) {
				return { error: `Please answer “${row}”.` };
			}
			continue;
		}
		if (!columns.includes(String(cell))) {
			return { error: `Please choose a valid answer for “${row}”.` };
		}
		clean[row] = cell;
	}
	return { value: clean };
}

function startOfDay(date: Date): number {
	return new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate()
	).getTime();
}

function checkOneDate(field: FormField, value: unknown): string | null {
	if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
		return "Please enter a valid date.";
	}
	const day = startOfDay(new Date(value));
	const today = startOfDay(new Date());
	if (field.disable_past_dates && day < today) {
		return "Please choose today or a later date.";
	}
	if (field.disable_future_dates && day > today + DAY_MS - 1) {
		return "Please choose today or an earlier date.";
	}
	return null;
}

function checkDate(field: FormField, value: unknown) {
	if (!field.date_range) {
		const error = checkOneDate(field, value);
		return error ? { error } : { value };
	}
	if (!Array.isArray(value) || value.length < 2) {
		return { error: "Please choose a start and end date." };
	}
	const [start, end] = value;
	const error = checkOneDate(field, start) ?? checkOneDate(field, end);
	if (error) {
		return { error };
	}
	if (Date.parse(String(start)) > Date.parse(String(end))) {
		return { error: "The end date must be after the start date." };
	}
	return { value: [start, end] };
}

function checkFiles(field: FormField, value: unknown) {
	const list = Array.isArray(value) ? value : [value];
	if (list.some((item) => typeof item !== "string" || item.length === 0)) {
		return { error: "Invalid file." };
	}
	if (!field.multiple && list.length > 1) {
		return { error: "Please upload a single file." };
	}
	return { value: list };
}

function checkString(_field: FormField, value: unknown) {
	return typeof value === "string" ? { value } : { error: "Invalid value." };
}

const CHECKS: Record<string, Check> = {
	barcode: checkString,
	checkbox: checkCheckbox,
	date: checkDate,
	email: checkEmail,
	files: checkFiles,
	matrix: checkMatrix,
	multi_select: checkMultiSelect,
	number: checkNumber,
	payment: checkString,
	phone_number: checkPhone,
	rating: checkNumber,
	rich_text: checkRichText,
	scale: checkNumber,
	select: checkSelect,
	signature: checkString,
	slider: checkNumber,
	text: checkText,
	url: checkUrl,
};

function requiredMessage(field: FormField): string {
	if (field.type === "files" || field.type === "signature") {
		return field.type === "signature"
			? "Please sign here."
			: "Please upload a file.";
	}
	if (
		field.type === "select" ||
		field.type === "multi_select" ||
		field.type === "rating"
	) {
		return "Please choose an answer.";
	}
	return "This field is required.";
}

function checkCustomValidation(
	field: FormField,
	values: FormValues,
	options: ValidateOptions
): string | null {
	const conditions = field.validation?.error_conditions?.conditions;
	if (!conditions) {
		return null;
	}
	const ok = conditionsMet(conditions, values, {
		existsInSubmissions: options.existsInSubmissions,
	});
	return ok
		? null
		: field.validation?.error_message || "This answer isn't valid.";
}

/* -------------------------------------------------------------------------- */
/*                                    Main                                    */
/* -------------------------------------------------------------------------- */

interface FieldOutcome {
	error?: string;
	store?: boolean;
	value?: unknown;
}

function validateField(
	field: FormField,
	values: FormValues,
	options: ValidateOptions,
	inScope: boolean
): FieldOutcome {
	const raw = values[field.id];
	const state = resolveFieldState(field, values);
	const empty =
		isEmptyValue(raw) && !(field.type === "checkbox" && raw === false);
	if (empty) {
		const missing = inScope && state.required && !state.hidden;
		return missing ? { error: requiredMessage(field) } : {};
	}
	if (state.hidden) {
		return { store: true, value: raw };
	}
	const check = CHECKS[field.type] ?? checkString;
	const result = check({ ...field, required: state.required }, raw);
	if (result.error) {
		return inScope ? { error: result.error } : {};
	}
	const custom = inScope ? checkCustomValidation(field, values, options) : null;
	return custom ? { error: custom } : { store: true, value: result.value };
}

/** Select answers may arrive as option ids; logic and storage use option names. */
export function normalizeSelectValues(
	fields: FormField[],
	values: FormValues
): FormValues {
	const out: FormValues = { ...values };
	for (const field of fields) {
		const raw = out[field.id];
		if (raw === undefined || raw === null) {
			continue;
		}
		if (field.type === "select") {
			out[field.id] = optionName(field, raw) ?? raw;
		} else if (field.type === "multi_select" && Array.isArray(raw)) {
			out[field.id] = raw.map((item) => optionName(field, item) ?? item);
		}
	}
	return out;
}

/**
 * Validates and normalises answers. Hidden fields (static or through logic)
 * are never required; their values are kept as-is (URL prefill, hidden IDs).
 */
export function validateSubmission(
	fields: FormField[],
	values: FormValues,
	options: ValidateOptions = {}
): ValidationResult {
	const errors: ValidationErrors = {};
	const data: Record<string, unknown> = {};
	const normalized = normalizeSelectValues(fields, values);
	const only = options.onlyFieldIds ? new Set(options.onlyFieldIds) : null;

	for (const field of fields) {
		if (!isInputType(field.type)) {
			continue;
		}
		const outcome = validateField(
			field,
			normalized,
			options,
			!only || only.has(field.id)
		);
		if (outcome.error) {
			errors[field.id] = outcome.error;
		} else if (outcome.store) {
			data[field.id] = outcome.value;
		}
	}
	return { data, errors, valid: Object.keys(errors).length === 0 };
}
