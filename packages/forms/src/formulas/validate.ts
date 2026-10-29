/**
 * Formula validation: syntax, unknown function/reference, argument-count,
 * and self-reference checks. Ports the single-formula checks from
 * `client/lib/formulas/validator.js` (OpnForm, AGPL-3.0); cycle and
 * chain-depth checks live in `dependencies.ts` and are composed by
 * `validateComputedVariables` in `../computed.ts`.
 */

import { hasFunction } from "./functions";
import { FormulaError } from "./lexer";
import type { AstNode } from "./parser";
import { Parser } from "./parser";

export interface FieldRef {
	id: string;
	name: string;
}

export interface ValidateOptions {
	availableFields?: FieldRef[];
	availableVariables?: FieldRef[];
	currentVariableId?: string | null;
}

export interface ValidationResult {
	errors: string[];
	valid: boolean;
}

interface ArgRule {
	max?: number;
	min: number;
}

const FUNCTION_ARG_RULES: Record<string, ArgRule> = {
	SUM: { min: 1 },
	AVERAGE: { min: 1 },
	MIN: { min: 1 },
	MAX: { min: 1 },
	ROUND: { min: 1, max: 2 },
	FLOOR: { min: 1, max: 1 },
	CEIL: { min: 1, max: 1 },
	ABS: { min: 1, max: 1 },
	MOD: { min: 2, max: 2 },
	POWER: { min: 2, max: 2 },
	SQRT: { min: 1, max: 1 },
	CONCAT: { min: 1 },
	UPPER: { min: 1, max: 1 },
	LOWER: { min: 1, max: 1 },
	TRIM: { min: 1, max: 1 },
	LEFT: { min: 2, max: 2 },
	RIGHT: { min: 2, max: 2 },
	MID: { min: 3, max: 3 },
	LEN: { min: 1, max: 1 },
	SUBSTITUTE: { min: 3, max: 4 },
	REPLACE: { min: 4, max: 4 },
	FIND: { min: 2, max: 3 },
	SEARCH: { min: 2, max: 3 },
	REPT: { min: 2, max: 2 },
	TEXT: { min: 2, max: 2 },
	IF: { min: 2, max: 3 },
	AND: { min: 1 },
	OR: { min: 1 },
	NOT: { min: 1, max: 1 },
	XOR: { min: 2 },
	ISBLANK: { min: 1, max: 1 },
	ISNUMBER: { min: 1, max: 1 },
	ISTEXT: { min: 1, max: 1 },
	IFERROR: { min: 2, max: 2 },
	IFBLANK: { min: 2, max: 2 },
	COALESCE: { min: 1 },
	SWITCH: { min: 3 },
	IFS: { min: 2 },
	CHOOSE: { min: 2 },
	COUNT: { min: 1, max: 1 },
	ISEMPTY: { min: 1, max: 1 },
	CONTAINS: { min: 2, max: 2 },
	JOIN: { min: 1, max: 2 },
};

function cleanMessage(message: string): string {
	return message.replace(/\s+at position \d+/gi, "");
}

function validateFieldReference(
	fieldId: string,
	options: ValidateOptions,
	errors: string[]
): void {
	if (fieldId === options.currentVariableId) {
		errors.push(
			"This variable cannot reference itself. That would create a circular dependency."
		);
		return;
	}
	const fields = options.availableFields ?? [];
	const variables = options.availableVariables ?? [];
	const known =
		fields.some((f) => f.id === fieldId) ||
		variables.some((v) => v.id === fieldId);
	if (!known) {
		errors.push(`Unknown field or variable reference '${fieldId}'.`);
	}
}

function argCountError(
	name: string,
	rule: ArgRule,
	count: number
): string | null {
	if (count < rule.min) {
		const plural = rule.min === 1 ? "" : "s";
		const quantifier = rule.max === rule.min ? "exactly" : "at least";
		return `Function ${name}() requires ${quantifier} ${rule.min} argument${plural}, but got ${count}.`;
	}
	if (rule.max !== undefined && count > rule.max) {
		const plural = rule.max === 1 ? "" : "s";
		return `Function ${name}() accepts at most ${rule.max} argument${plural}, but got ${count}.`;
	}
	return null;
}

function validateFunctionCall(
	node: Extract<AstNode, { type: "function" }>,
	options: ValidateOptions,
	errors: string[]
): void {
	const name = node.name.toUpperCase();
	if (!hasFunction(name)) {
		errors.push(
			`Unknown function '${name}'. Check the function reference for available functions.`
		);
		return;
	}

	const rule = FUNCTION_ARG_RULES[name];
	if (rule) {
		const message = argCountError(name, rule, node.args.length);
		if (message) {
			errors.push(message);
			return;
		}
	}

	for (const arg of node.args) {
		validateNode(arg, options, errors);
	}
}

function validateNode(
	node: AstNode,
	options: ValidateOptions,
	errors: string[]
): void {
	switch (node.type) {
		case "field":
			validateFieldReference(node.id, options, errors);
			return;
		case "function":
			validateFunctionCall(node, options, errors);
			return;
		case "binary":
			validateNode(node.left, options, errors);
			validateNode(node.right, options, errors);
			return;
		case "unary":
			validateNode(node.operand, options, errors);
			return;
		default:
			return;
	}
}

/** Validates formula syntax, functions, and field/variable references. */
export function validateFormula(
	formula: string,
	options: ValidateOptions = {}
): ValidationResult {
	if (!formula || formula.trim() === "") {
		return { valid: false, errors: ["Formula cannot be empty."] };
	}

	let ast: AstNode;
	try {
		ast = Parser.parse(formula);
	} catch (error) {
		const message =
			error instanceof FormulaError || error instanceof Error
				? error.message
				: String(error);
		return { valid: false, errors: [cleanMessage(message)] };
	}

	const errors: string[] = [];
	validateNode(ast, options, errors);
	return { valid: errors.length === 0, errors };
}
