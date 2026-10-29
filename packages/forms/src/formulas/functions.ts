/**
 * The 38 built-in formula functions, ported from
 * `client/lib/formulas/functions/{math,text,logic,array}.js` (OpnForm,
 * AGPL-3.0). Null/empty semantics are documented in
 * specs/A-fields-logic-validation.md section 5.2.
 */

export type FormulaFunction = (...args: unknown[]) => unknown;

function toNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === "") {
		return null;
	}
	if (typeof value === "number") {
		return Number.isNaN(value) ? null : value;
	}
	if (typeof value === "boolean") {
		return value ? 1 : 0;
	}
	const num = Number(value);
	return Number.isNaN(num) ? null : num;
}

function toText(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}
	return String(value);
}

function isTruthy(value: unknown): boolean {
	if (value === null || value === undefined || value === "") {
		return false;
	}
	if (typeof value === "boolean") {
		return value;
	}
	if (typeof value === "number") {
		return value !== 0;
	}
	if (typeof value === "string") {
		const lower = value.toLowerCase();
		return lower !== "false" && lower !== "no" && lower !== "0";
	}
	return Boolean(value);
}

function isBlank(value: unknown): boolean {
	return value === null || value === undefined || value === "";
}

function flattenArgs(values: unknown[]): unknown[] {
	const out: unknown[] = [];
	for (const value of values) {
		if (Array.isArray(value)) {
			out.push(...value);
		} else {
			out.push(value);
		}
	}
	return out;
}

function getNumbers(values: unknown[]): number[] {
	const numbers: number[] = [];
	for (const value of flattenArgs(values)) {
		const num = toNumber(value);
		if (num !== null) {
			numbers.push(num);
		}
	}
	return numbers;
}

/* -------------------------------------------------------------------------- */
/*                                    Math                                    */
/* -------------------------------------------------------------------------- */

function SUM(...values: unknown[]): number {
	return getNumbers(values).reduce((sum, n) => sum + n, 0);
}

function AVERAGE(...values: unknown[]): number | null {
	const numbers = getNumbers(values);
	if (numbers.length === 0) {
		return null;
	}
	return SUM(...numbers) / numbers.length;
}

function MIN(...values: unknown[]): number | null {
	const numbers = getNumbers(values);
	return numbers.length === 0 ? null : Math.min(...numbers);
}

function MAX(...values: unknown[]): number | null {
	const numbers = getNumbers(values);
	return numbers.length === 0 ? null : Math.max(...numbers);
}

function ROUND(value: unknown, decimals: unknown = 0): number | null {
	const num = toNumber(value);
	if (num === null) {
		return null;
	}
	const dec = toNumber(decimals) ?? 0;
	const factor = 10 ** dec;
	return Math.round(num * factor) / factor;
}

function FLOOR(value: unknown): number | null {
	const num = toNumber(value);
	return num === null ? null : Math.floor(num);
}

function CEIL(value: unknown): number | null {
	const num = toNumber(value);
	return num === null ? null : Math.ceil(num);
}

function ABS(value: unknown): number | null {
	const num = toNumber(value);
	return num === null ? null : Math.abs(num);
}

function MOD(value: unknown, divisor: unknown): number | null {
	const num = toNumber(value);
	const div = toNumber(divisor);
	if (num === null || div === null || div === 0) {
		return null;
	}
	return num % div;
}

function POWER(base: unknown, exponent: unknown): number | null {
	const b = toNumber(base);
	const e = toNumber(exponent);
	return b === null || e === null ? null : b ** e;
}

function SQRT(value: unknown): number | null {
	const num = toNumber(value);
	return num === null || num < 0 ? null : Math.sqrt(num);
}

/* -------------------------------------------------------------------------- */
/*                                    Text                                    */
/* -------------------------------------------------------------------------- */

function CONCAT(...values: unknown[]): string {
	return values.map((v) => toText(v)).join("");
}

function UPPER(value: unknown): string {
	return toText(value).toUpperCase();
}

function LOWER(value: unknown): string {
	return toText(value).toLowerCase();
}

function TRIM(value: unknown): string {
	return toText(value).trim();
}

function LEFT(value: unknown, count: unknown): string {
	const str = toText(value);
	const n = Number(count);
	return Number.isNaN(n) || n < 0 ? "" : str.slice(0, n);
}

function RIGHT(value: unknown, count: unknown): string {
	const str = toText(value);
	const n = Number(count);
	return Number.isNaN(n) || n < 0 ? "" : str.slice(Math.max(0, str.length - n));
}

/** 1-based, Excel-style: `MID("Hello", 2, 3)` → `"ell"`. */
function MID(value: unknown, start: unknown, length: unknown): string {
	const str = toText(value);
	const s = Number(start);
	const l = Number(length);
	if (Number.isNaN(s) || Number.isNaN(l) || s < 1 || l < 0) {
		return "";
	}
	return str.slice(s - 1, s - 1 + l);
}

function LEN(value: unknown): number {
	return toText(value).length;
}

function substituteAll(str: string, old: string, replacement: string): string {
	return str.split(old).join(replacement);
}

function substituteInstance(
	str: string,
	old: string,
	replacement: string,
	n: number
): string {
	let count = 0;
	let result = "";
	let lastIndex = 0;
	let index = str.indexOf(old);
	while (index !== -1) {
		count += 1;
		if (count === n) {
			result += str.slice(lastIndex, index) + replacement;
			lastIndex = index + old.length;
			break;
		}
		result += str.slice(lastIndex, index + old.length);
		lastIndex = index + old.length;
		index = str.indexOf(old, lastIndex);
	}
	return result + str.slice(lastIndex);
}

function SUBSTITUTE(
	text: unknown,
	oldText: unknown,
	newText: unknown,
	instance: unknown = null
): string {
	const str = toText(text);
	const old = toText(oldText);
	const replacement = toText(newText);
	if (old === "") {
		return str;
	}
	if (instance === null) {
		return substituteAll(str, old, replacement);
	}
	const n = Number(instance);
	return Number.isNaN(n) || n < 1
		? str
		: substituteInstance(str, old, replacement, n);
}

function REPLACE(
	text: unknown,
	start: unknown,
	length: unknown,
	newText: unknown
): string {
	const str = toText(text);
	const s = Number(start);
	const l = Number(length);
	const replacement = toText(newText);
	if (Number.isNaN(s) || Number.isNaN(l) || s < 1 || l < 0) {
		return str;
	}
	return str.slice(0, s - 1) + replacement + str.slice(s - 1 + l);
}

function FIND(
	findText: unknown,
	withinText: unknown,
	startPos: unknown = 1
): number | null {
	const find = toText(findText);
	const within = toText(withinText);
	const start = Number(startPos);
	if (Number.isNaN(start) || start < 1) {
		return null;
	}
	const index = within.indexOf(find, start - 1);
	return index === -1 ? null : index + 1;
}

function SEARCH(
	findText: unknown,
	withinText: unknown,
	startPos: unknown = 1
): number | null {
	const find = toText(findText).toLowerCase();
	const within = toText(withinText).toLowerCase();
	const start = Number(startPos);
	if (Number.isNaN(start) || start < 1) {
		return null;
	}
	const index = within.indexOf(find, start - 1);
	return index === -1 ? null : index + 1;
}

const MAX_REPT = 100;

function REPT(text: unknown, times: unknown): string {
	const str = toText(text);
	const n = Number(times);
	return Number.isNaN(n) || n < 0
		? ""
		: str.repeat(Math.min(Math.floor(n), MAX_REPT));
}

function formatPercent(num: number, fmt: string): string {
	const decimals = (fmt.match(/0/g) ?? []).length - 1;
	return `${(num * 100).toFixed(Math.max(0, decimals))}%`;
}

function formatDecimal(num: number, fmt: string): string {
	const decimals = fmt.split(".")[1]?.length ?? 0;
	return num.toFixed(decimals);
}

function TEXT(value: unknown, format: unknown = ""): string {
	if (value === null || value === undefined) {
		return "";
	}
	const num = Number(value);
	if (Number.isNaN(num)) {
		return toText(value);
	}
	const fmt = toText(format).toLowerCase();
	if (fmt.includes("%")) {
		return formatPercent(num, fmt);
	}
	if (fmt.includes(".")) {
		return formatDecimal(num, fmt);
	}
	return toText(value);
}

/* -------------------------------------------------------------------------- */
/*                                   Logic                                    */
/* -------------------------------------------------------------------------- */

function IF(
	condition: unknown,
	valueIfTrue: unknown,
	valueIfFalse: unknown = ""
): unknown {
	return isTruthy(condition) ? valueIfTrue : valueIfFalse;
}

function AND(...conditions: unknown[]): boolean {
	return conditions.length === 0 || conditions.every((c) => isTruthy(c));
}

function OR(...conditions: unknown[]): boolean {
	return conditions.length !== 0 && conditions.some((c) => isTruthy(c));
}

function NOT(condition: unknown): boolean {
	return !isTruthy(condition);
}

function XOR(...conditions: unknown[]): boolean {
	const trueCount = conditions.filter((c) => isTruthy(c)).length;
	return trueCount % 2 === 1;
}

function ISBLANK(value: unknown): boolean {
	return isBlank(value);
}

function ISNUMBER(value: unknown): boolean {
	if (value === null || value === undefined || value === "") {
		return false;
	}
	return typeof value === "number" || !Number.isNaN(Number(value));
}

function ISTEXT(value: unknown): boolean {
	return typeof value === "string" && value !== "";
}

function IFERROR(value: unknown, fallback: unknown = ""): unknown {
	return value === null || value === undefined ? fallback : value;
}

function IFBLANK(value: unknown, fallback: unknown = ""): unknown {
	return isBlank(value) ? fallback : value;
}

function COALESCE(...values: unknown[]): unknown {
	for (const value of values) {
		if (!isBlank(value)) {
			return value;
		}
	}
	return null;
}

/** `SWITCH(value, case1, result1, case2, result2, ..., default?)`. */
function SWITCH(value: unknown, ...caseResults: unknown[]): unknown {
	for (let i = 0; i < caseResults.length - 1; i += 2) {
		if (value === caseResults[i]) {
			return caseResults[i + 1];
		}
	}
	if (caseResults.length % 2 === 1) {
		return caseResults.at(-1);
	}
	return null;
}

/** `IFS(condition1, result1, condition2, result2, ...)`. */
function IFS(...conditionResults: unknown[]): unknown {
	for (let i = 0; i < conditionResults.length; i += 2) {
		if (isTruthy(conditionResults[i])) {
			return conditionResults[i + 1];
		}
	}
	return null;
}

function CHOOSE(index: unknown, ...values: unknown[]): unknown {
	const idx = Number(index);
	if (Number.isNaN(idx) || idx < 1 || idx > values.length) {
		return null;
	}
	return values[idx - 1];
}

/* -------------------------------------------------------------------------- */
/*                                   Array                                    */
/* -------------------------------------------------------------------------- */

function COUNT(value: unknown): number {
	if (value === null || value === undefined) {
		return 0;
	}
	if (Array.isArray(value)) {
		return value.length;
	}
	if (typeof value === "string") {
		return value.length > 0 ? 1 : 0;
	}
	return 1;
}

function ISEMPTY(value: unknown): boolean {
	if (value === null || value === undefined) {
		return true;
	}
	if (Array.isArray(value)) {
		return value.length === 0;
	}
	if (typeof value === "string") {
		return value.trim() === "";
	}
	return false;
}

function CONTAINS(array: unknown, searchValue: unknown): boolean {
	if (array === null || array === undefined) {
		return false;
	}
	if (!Array.isArray(array)) {
		return array === searchValue;
	}
	return array.includes(searchValue);
}

function JOIN(array: unknown, separator: unknown = ", "): string {
	if (array === null || array === undefined) {
		return "";
	}
	if (!Array.isArray(array)) {
		return String(array);
	}
	return array.join(toText(separator));
}

/* -------------------------------------------------------------------------- */
/*                                  Registry                                  */
/* -------------------------------------------------------------------------- */

export const FUNCTIONS: Record<string, FormulaFunction> = {
	SUM,
	AVERAGE,
	MIN,
	MAX,
	ROUND,
	FLOOR,
	CEIL,
	ABS,
	MOD,
	POWER,
	SQRT,
	CONCAT,
	UPPER,
	LOWER,
	TRIM,
	LEFT,
	RIGHT,
	MID,
	LEN,
	SUBSTITUTE,
	REPLACE,
	FIND,
	SEARCH,
	REPT,
	TEXT,
	IF,
	AND,
	OR,
	NOT,
	XOR,
	ISBLANK,
	ISNUMBER,
	ISTEXT,
	IFERROR,
	IFBLANK,
	COALESCE,
	SWITCH,
	IFS,
	CHOOSE,
	COUNT,
	ISEMPTY,
	CONTAINS,
	JOIN,
};

export function hasFunction(name: string): boolean {
	return name.toUpperCase() in FUNCTIONS;
}

export function getFunction(name: string): FormulaFunction | undefined {
	return FUNCTIONS[name.toUpperCase()];
}

export function getFunctionNames(): string[] {
	return Object.keys(FUNCTIONS);
}
