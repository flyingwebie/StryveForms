/**
 * Evaluator for the computed-variable formula AST.
 *
 * Ports `client/lib/formulas/evaluator.js` (OpnForm, AGPL-3.0). Null/empty
 * and error semantics are documented in
 * specs/A-fields-logic-validation.md section 5.2 — in particular: division
 * by zero and missing field references evaluate to `null` rather than
 * throwing, and any error raised while evaluating a formula is swallowed to
 * `null` by {@link evaluate}.
 */

import { getFunction } from "./functions";
import { FormulaError } from "./lexer";
import type { AstNode } from "./parser";
import { Parser } from "./parser";

const MAX_DEPTH = 10;

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

function toBoolean(value: unknown): boolean {
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

function compareEqual(left: unknown, right: unknown): boolean {
	if (left === null && right === null) {
		return true;
	}
	if (left === null || right === null) {
		return false;
	}
	const leftNum = toNumber(left);
	const rightNum = toNumber(right);
	if (leftNum !== null && rightNum !== null) {
		return leftNum === rightNum;
	}
	if (typeof left === "string" || typeof right === "string") {
		return String(left).toLowerCase() === String(right).toLowerCase();
	}
	return left === right;
}

type OrderedComparator = (a: number, b: number) => boolean;

function compareOrdered(
	left: unknown,
	right: unknown,
	compare: OrderedComparator
): boolean {
	const leftNum = toNumber(left);
	const rightNum = toNumber(right);
	if (leftNum === null || rightNum === null) {
		return false;
	}
	return compare(leftNum, rightNum);
}

/** Evaluates a parsed formula AST against a field/variable value context. */
export class Evaluator {
	private readonly context: Record<string, unknown>;
	private depth = 0;

	constructor(context: Record<string, unknown> = {}) {
		this.context = context;
	}

	static evaluate(
		formula: string,
		context: Record<string, unknown> = {}
	): unknown {
		try {
			const ast = Parser.parse(formula);
			return new Evaluator(context).evaluate(ast);
		} catch {
			return null;
		}
	}

	evaluate(node: AstNode | null | undefined): unknown {
		if (!node) {
			return null;
		}
		switch (node.type) {
			case "number":
			case "string":
			case "boolean":
				return node.value;
			case "field":
				return this.evaluateField(node.id);
			case "binary":
				return this.evaluateBinary(node);
			case "unary":
				return this.evaluateUnary(node);
			case "function":
				return this.evaluateFunction(node);
			default:
				return null;
		}
	}

	private evaluateField(id: string): unknown {
		const value = this.context[id];
		return value === undefined ? null : value;
	}

	private evaluateBinary(node: Extract<AstNode, { type: "binary" }>): unknown {
		const left = this.evaluate(node.left);
		const right = this.evaluate(node.right);

		switch (node.operator) {
			case "=":
				return compareEqual(left, right);
			case "<>":
				return !compareEqual(left, right);
			case "<":
				return compareOrdered(left, right, (a, b) => a < b);
			case ">":
				return compareOrdered(left, right, (a, b) => a > b);
			case "<=":
				return compareOrdered(left, right, (a, b) => a <= b);
			case ">=":
				return compareOrdered(left, right, (a, b) => a >= b);
			default:
				return this.evaluateArithmetic(node.operator, left, right);
		}
	}

	private evaluateArithmetic(
		operator: string,
		left: unknown,
		right: unknown
	): unknown {
		const leftNum = toNumber(left);
		const rightNum = toNumber(right);

		if (leftNum === null || rightNum === null) {
			if (
				operator === "+" &&
				(typeof left === "string" || typeof right === "string")
			) {
				return String(left ?? "") + String(right ?? "");
			}
			return null;
		}

		switch (operator) {
			case "+":
				return leftNum + rightNum;
			case "-":
				return leftNum - rightNum;
			case "*":
				return leftNum * rightNum;
			case "/":
				return rightNum === 0 ? null : leftNum / rightNum;
			default:
				return null;
		}
	}

	private evaluateUnary(node: Extract<AstNode, { type: "unary" }>): unknown {
		const operand = this.evaluate(node.operand);
		if (node.operator === "-") {
			const num = toNumber(operand);
			return num === null ? null : -num;
		}
		if (node.operator === "NOT") {
			return !toBoolean(operand);
		}
		return null;
	}

	private evaluateFunction(
		node: Extract<AstNode, { type: "function" }>
	): unknown {
		this.depth += 1;
		if (this.depth > MAX_DEPTH) {
			this.depth -= 1;
			throw new FormulaError("Maximum formula nesting depth exceeded");
		}

		try {
			const func = getFunction(node.name);
			if (!func) {
				throw new FormulaError(`Unknown function: ${node.name.toUpperCase()}`);
			}
			const args = node.args.map((arg) => this.evaluate(arg));
			return func(...args);
		} catch (error) {
			if (error instanceof FormulaError) {
				throw error;
			}
			return null;
		} finally {
			this.depth -= 1;
		}
	}
}

/** Evaluates a formula string; any error (syntax, unknown function, max depth) becomes `null`. */
export function evaluate(
	formula: string,
	context: Record<string, unknown> = {}
): unknown {
	return Evaluator.evaluate(formula, context);
}
