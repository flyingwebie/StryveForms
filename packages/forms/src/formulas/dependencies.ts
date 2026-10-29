/**
 * Dependency extraction, cycle detection, and topological ordering for
 * computed variables. Ports `client/lib/formulas/dependency-graph.js`
 * (OpnForm, AGPL-3.0). See specs/A-fields-logic-validation.md section 5.3:
 * dependencies are extracted via a `{id}` regex (not a full parse), a
 * detected cycle throws at validation time, and at runtime a leftover cycle
 * falls back to evaluating in raw array order rather than crashing.
 */

import type { ComputedVariable } from "../types";
import { FormulaError } from "./lexer";

const FIELD_REF_PATTERN = /\{([^}]+)\}/g;

/** Extracts every `{id}` reference from a formula string. */
export function extractFieldReferences(formula: string): string[] {
	const references: string[] = [];
	for (const [, id] of formula.matchAll(FIELD_REF_PATTERN)) {
		if (id !== undefined) {
			references.push(id.trim());
		}
	}
	return references;
}

interface DependencyNode {
	dependencies: Set<string>;
	id: string;
}

function buildNodes(
	variables: ComputedVariable[]
): Map<string, DependencyNode> {
	const nodes = new Map<string, DependencyNode>();
	for (const variable of variables) {
		nodes.set(variable.id, {
			id: variable.id,
			dependencies: new Set(extractFieldReferences(variable.formula)),
		});
	}
	return nodes;
}

/** Returns every cycle found among computed-variable dependencies (empty if none). */
export function detectCycles(variables: ComputedVariable[]): string[][] {
	const nodes = buildNodes(variables);
	const cycles: string[][] = [];
	const visited = new Set<string>();
	const stack = new Set<string>();
	const path: string[] = [];

	const visit = (id: string): void => {
		if (stack.has(id)) {
			const start = path.indexOf(id);
			cycles.push([...path.slice(start), id]);
			return;
		}
		if (visited.has(id)) {
			return;
		}
		visited.add(id);
		stack.add(id);
		path.push(id);

		const node = nodes.get(id);
		if (node) {
			for (const depId of node.dependencies) {
				if (nodes.has(depId)) {
					visit(depId);
				}
			}
		}

		path.pop();
		stack.delete(id);
	};

	for (const id of nodes.keys()) {
		if (!visited.has(id)) {
			visit(id);
		}
	}

	return cycles;
}

/**
 * Topologically sorts computed variables so each is evaluated after its
 * dependencies. Throws a {@link FormulaError} if a cycle exists — callers
 * that need the runtime fallback (raw array order) should catch this.
 */
export function getEvaluationOrder(variables: ComputedVariable[]): string[] {
	const cycles = detectCycles(variables);
	if (cycles.length > 0) {
		const [cycle] = cycles;
		throw new FormulaError(
			`Circular dependency detected: ${(cycle ?? []).join(" → ")}`
		);
	}

	const nodes = buildNodes(variables);
	const sorted: string[] = [];
	const visited = new Set<string>();
	const visiting = new Set<string>();

	const visit = (id: string): void => {
		if (visited.has(id) || visiting.has(id)) {
			return;
		}
		visiting.add(id);

		const node = nodes.get(id);
		if (node) {
			for (const depId of node.dependencies) {
				if (nodes.has(depId)) {
					visit(depId);
				}
			}
		}

		visiting.delete(id);
		visited.add(id);
		sorted.push(id);
	};

	for (const id of nodes.keys()) {
		visit(id);
	}

	return sorted;
}

/** Evaluation order, falling back to raw declaration order if a cycle exists. */
export function getSafeEvaluationOrder(
	variables: ComputedVariable[]
): string[] {
	try {
		return getEvaluationOrder(variables);
	} catch {
		return variables.map((v) => v.id);
	}
}

/**
 * Longest dependency chain ending at `variableId` (1 for a variable with no
 * computed-variable dependencies). Guards against cycles by refusing to
 * revisit an in-progress node, so it is safe to call even on cyclic input.
 */
export function getChainDepth(
	variables: ComputedVariable[],
	variableId: string
): number {
	const nodes = buildNodes(variables);
	const memo = new Map<string, number>();
	const visiting = new Set<string>();

	const compute = (id: string): number => {
		const cached = memo.get(id);
		if (cached !== undefined) {
			return cached;
		}
		if (visiting.has(id)) {
			return 0;
		}
		visiting.add(id);

		const node = nodes.get(id);
		let max = 0;
		if (node) {
			for (const depId of node.dependencies) {
				if (nodes.has(depId)) {
					max = Math.max(max, compute(depId));
				}
			}
		}

		visiting.delete(id);
		const depth = max + 1;
		memo.set(id, depth);
		return depth;
	};

	return compute(variableId);
}
