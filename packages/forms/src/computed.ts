/**
 * Public entry point for OpnForm-compatible computed variables / formulas.
 * See specs/A-fields-logic-validation.md section 5 for the full semantics
 * this ports: `form.computed_variables` schema, dependency ordering, cycle
 * fallback, and validation rules (`MAX_CHAIN_DEPTH = 20`).
 */

import {
	detectCycles,
	getChainDepth,
	getSafeEvaluationOrder,
} from "./formulas/dependencies";
import { evaluate } from "./formulas/evaluator";
import { validateFormula } from "./formulas/validate";
import type { ComputedVariable } from "./types";

const MAX_CHAIN_DEPTH = 20;

/**
 * Evaluates a single formula against a value context (field/variable id ->
 * value). Never throws: any syntax error, unknown function, missing
 * reference, or runtime error (division by zero, max nesting depth, ...)
 * evaluates to `null`.
 */
export function evaluateFormula(
	formula: string,
	context: Record<string, unknown>
): unknown {
	return evaluate(formula, context);
}

/**
 * Evaluates every computed variable in dependency order, injecting each
 * result into the context so later variables can reference earlier ones.
 * If the variables contain a cycle, falls back to raw declaration order
 * (matching `useComputedVariables.js`'s runtime behavior) rather than
 * failing the whole form. Never throws.
 */
export function evaluateComputedVariables(
	variables: ComputedVariable[],
	values: Record<string, unknown>
): Record<string, unknown> {
	const byId = new Map(variables.map((variable) => [variable.id, variable]));
	const order = getSafeEvaluationOrder(variables);
	const context: Record<string, unknown> = { ...values };
	const results: Record<string, unknown> = {};

	for (const id of order) {
		const variable = byId.get(id);
		if (!variable) {
			continue;
		}
		let value: unknown = null;
		try {
			value = evaluateFormula(variable.formula, context);
		} catch {
			value = null;
		}
		results[id] = value;
		context[id] = value;
	}

	return results;
}

export interface ComputedVariableError {
	id: string;
	message: string;
}

function validateSingleVariable(
	variable: ComputedVariable,
	allVariables: ComputedVariable[],
	fieldIds: string[]
): ComputedVariableError[] {
	const availableFields = fieldIds.map((id) => ({ id, name: id }));
	const availableVariables = allVariables
		.filter((v) => v.id !== variable.id)
		.map((v) => ({ id: v.id, name: v.name }));

	const result = validateFormula(variable.formula, {
		availableFields,
		availableVariables,
		currentVariableId: variable.id,
	});

	return result.errors.map((message) => ({ id: variable.id, message }));
}

function validateChainDepths(
	variables: ComputedVariable[]
): ComputedVariableError[] {
	const errors: ComputedVariableError[] = [];
	for (const variable of variables) {
		const depth = getChainDepth(variables, variable.id);
		if (depth > MAX_CHAIN_DEPTH) {
			errors.push({
				id: variable.id,
				message: `Dependency chain is too deep (${depth} levels, max ${MAX_CHAIN_DEPTH}).`,
			});
		}
	}
	return errors;
}

function validateNoCycles(
	variables: ComputedVariable[]
): ComputedVariableError[] {
	const errors: ComputedVariableError[] = [];
	for (const cycle of detectCycles(variables)) {
		const message = `Circular dependency detected: ${cycle.join(" → ")}`;
		for (const id of cycle) {
			errors.push({ id, message });
		}
	}
	return errors;
}

/**
 * Validates every computed variable's formula: syntax, unknown function,
 * argument count, unknown/self reference, circular dependencies, and
 * max dependency-chain depth (20, matching `ComputedVariablesRule`).
 * Returns one entry per problem found (a variable can have several).
 */
export function validateComputedVariables(
	variables: ComputedVariable[],
	fieldIds: string[]
): ComputedVariableError[] {
	const perVariableErrors = variables.flatMap((variable) =>
		validateSingleVariable(variable, variables, fieldIds)
	);
	return [
		...perVariableErrors,
		...validateNoCycles(variables),
		...validateChainDepths(variables),
	];
}
