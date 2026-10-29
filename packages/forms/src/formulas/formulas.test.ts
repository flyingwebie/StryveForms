import { describe, expect, it } from "bun:test";
import {
	evaluateComputedVariables,
	evaluateFormula,
	validateComputedVariables,
} from "../computed";
import type { ComputedVariable } from "../types";
import {
	detectCycles,
	extractFieldReferences,
	getSafeEvaluationOrder,
} from "./dependencies";
import { evaluate } from "./evaluator";

function cv(id: string, formula: string, name = id): ComputedVariable {
	return { id, name, formula };
}

describe("operator precedence and literals", () => {
	it("multiplies before adding", () => {
		expect(evaluate("2 + 3 * 4")).toBe(14);
	});

	it("respects parentheses", () => {
		expect(evaluate("(2 + 3) * 4")).toBe(20);
	});

	it("applies unary minus tighter than multiplication", () => {
		expect(evaluate("-2 * 3")).toBe(-6);
	});

	it("evaluates NOT on a boolean literal", () => {
		expect(evaluate("NOT(TRUE)")).toBe(false);
	});

	it("reads field references from context", () => {
		expect(evaluate("{a} + {b}", { a: 2, b: 3 })).toBe(5);
	});

	it("returns null for a missing field reference", () => {
		expect(evaluate("{missing}", {})).toBeNull();
	});
});

describe("string concatenation with +", () => {
	it("concatenates two strings", () => {
		expect(evaluate('"a" + "b"')).toBe("ab");
	});

	it("concatenates a number coerced into a string context", () => {
		expect(evaluate('"count: " + "5"')).toBe("count: 5");
	});

	it("adds two numeric strings numerically", () => {
		expect(evaluate('"2" + "3"')).toBe(5);
	});
});

describe("comparisons", () => {
	it("equals is case-insensitive for strings", () => {
		expect(evaluate('"ABC" = "abc"')).toBe(true);
	});
	it("not-equal", () => {
		expect(evaluate("1 <> 2")).toBe(true);
	});
	it("less than", () => {
		expect(evaluate("1 < 2")).toBe(true);
	});
	it("greater than", () => {
		expect(evaluate("2 > 1")).toBe(true);
	});
	it("less than or equal", () => {
		expect(evaluate("2 <= 2")).toBe(true);
	});
	it("greater than or equal", () => {
		expect(evaluate("2 >= 3")).toBe(false);
	});
});

describe("division and null propagation", () => {
	it("division by zero returns null", () => {
		expect(evaluate("1 / 0")).toBeNull();
	});
	it("arithmetic with a missing field returns null", () => {
		expect(evaluate("{x} + 1", {})).toBeNull();
	});
	it("MOD by zero returns null", () => {
		expect(evaluate("MOD(10, 0)")).toBeNull();
	});
});

describe("syntax and runtime errors never throw", () => {
	it("returns null for invalid syntax", () => {
		expect(evaluate("1 +")).toBeNull();
	});
	it("returns null for an unknown function", () => {
		expect(evaluate("NOPE(1)")).toBeNull();
	});
	it("returns null when nesting exceeds max depth", () => {
		const nested = `${"ABS(".repeat(12)}1${")".repeat(12)}`;
		expect(evaluate(nested)).toBeNull();
	});
});

describe("math functions", () => {
	it("SUM adds numbers and flattens arrays", () => {
		expect(evaluate("SUM(1, 2, 3)")).toBe(6);
		expect(evaluate("SUM({a})", { a: [1, 2, 3] })).toBe(6);
	});
	it("SUM of nothing numeric is 0", () => {
		expect(evaluate("SUM({a})", { a: [] })).toBe(0);
	});
	it("AVERAGE of empty is null", () => {
		expect(evaluate("AVERAGE({a})", { a: [] })).toBeNull();
	});
	it("AVERAGE computes the mean", () => {
		expect(evaluate("AVERAGE(1, 2, 3)")).toBe(2);
	});
	it("MIN/MAX of empty is null", () => {
		expect(evaluate("MIN({a})", { a: [] })).toBeNull();
		expect(evaluate("MAX({a})", { a: [] })).toBeNull();
	});
	it("MIN/MAX pick extremes", () => {
		expect(evaluate("MIN(5, 3, 8)")).toBe(3);
		expect(evaluate("MAX(5, 3, 8)")).toBe(8);
	});
	it("ROUND rounds to given decimals", () => {
		expect(evaluate("ROUND(3.14159, 2)")).toBe(3.14);
		expect(evaluate("ROUND(3.7)")).toBe(4);
	});
	it("FLOOR/CEIL", () => {
		expect(evaluate("FLOOR(3.7)")).toBe(3);
		expect(evaluate("CEIL(3.2)")).toBe(4);
	});
	it("ABS", () => {
		expect(evaluate("ABS(-5)")).toBe(5);
	});
	it("MOD", () => {
		expect(evaluate("MOD(10, 3)")).toBe(1);
	});
	it("POWER", () => {
		expect(evaluate("POWER(2, 3)")).toBe(8);
	});
	it("SQRT", () => {
		expect(evaluate("SQRT(16)")).toBe(4);
		expect(evaluate("SQRT(-1)")).toBeNull();
	});
});

describe("text functions", () => {
	it("CONCAT", () => {
		expect(evaluate('CONCAT("Hello", " ", "World")')).toBe("Hello World");
	});
	it("UPPER/LOWER", () => {
		expect(evaluate('UPPER("hello")')).toBe("HELLO");
		expect(evaluate('LOWER("HELLO")')).toBe("hello");
	});
	it("TRIM", () => {
		expect(evaluate('TRIM("  hello  ")')).toBe("hello");
	});
	it("LEFT/RIGHT", () => {
		expect(evaluate('LEFT("Hello", 2)')).toBe("He");
		expect(evaluate('RIGHT("Hello", 2)')).toBe("lo");
	});
	it("MID", () => {
		expect(evaluate('MID("Hello", 2, 3)')).toBe("ell");
	});
	it("LEN", () => {
		expect(evaluate('LEN("Hello")')).toBe(5);
	});
	it("SUBSTITUTE replaces all by default", () => {
		expect(evaluate('SUBSTITUTE("Hello", "l", "L")')).toBe("HeLLo");
	});
	it("SUBSTITUTE replaces a specific instance", () => {
		expect(evaluate('SUBSTITUTE("Hello", "l", "L", 1)')).toBe("HeLlo");
	});
	it("REPLACE", () => {
		expect(evaluate('REPLACE("Hello", 2, 3, "i")')).toBe("Hio");
	});
	it("FIND is case-sensitive", () => {
		expect(evaluate('FIND("l", "Hello")')).toBe(3);
		expect(evaluate('FIND("L", "Hello")')).toBeNull();
	});
	it("SEARCH is case-insensitive", () => {
		expect(evaluate('SEARCH("L", "Hello")')).toBe(3);
	});
	it("REPT", () => {
		expect(evaluate('REPT("ab", 3)')).toBe("ababab");
	});
	it("TEXT formats percentages and decimals", () => {
		expect(evaluate('TEXT(0.25, "0%")')).toBe("25%");
		expect(evaluate('TEXT(3.14159, "0.00")')).toBe("3.14");
	});
});

describe("logic functions", () => {
	it("IF", () => {
		expect(evaluate('IF(1 > 0, "yes", "no")')).toBe("yes");
		expect(evaluate('IF(1 < 0, "yes", "no")')).toBe("no");
	});
	it("AND/OR", () => {
		expect(evaluate("AND(TRUE, TRUE)")).toBe(true);
		expect(evaluate("AND(TRUE, FALSE)")).toBe(false);
		expect(evaluate("OR(FALSE, TRUE)")).toBe(true);
	});
	it("NOT", () => {
		expect(evaluate("NOT(FALSE)")).toBe(true);
	});
	it("XOR", () => {
		expect(evaluate("XOR(TRUE, FALSE)")).toBe(true);
		expect(evaluate("XOR(TRUE, TRUE)")).toBe(false);
	});
	it("ISBLANK/ISNUMBER/ISTEXT", () => {
		expect(evaluate('ISBLANK("")')).toBe(true);
		expect(evaluate("ISNUMBER(123)")).toBe(true);
		expect(evaluate('ISTEXT("hello")')).toBe(true);
	});
	it("IFERROR falls back on null", () => {
		expect(evaluate("IFERROR({missing}, 0)", {})).toBe(0);
	});
	it("IFBLANK falls back on blank", () => {
		expect(evaluate('IFBLANK("", "Anonymous")')).toBe("Anonymous");
	});
	it("COALESCE returns the first non-empty value", () => {
		expect(evaluate('COALESCE("", "", "value")')).toBe("value");
	});
	it("SWITCH matches a case", () => {
		expect(evaluate('SWITCH("B", "A", 4, "B", 3, "C", 2, 0)')).toBe(3);
	});
	it("SWITCH falls back to default", () => {
		expect(evaluate('SWITCH("Z", "A", 4, "B", 3, 0)')).toBe(0);
	});
	it("IFS returns the first true branch", () => {
		expect(evaluate("IFS(1 > 2, 1, 2 > 1, 2)")).toBe(2);
	});
	it("CHOOSE picks by 1-based index", () => {
		expect(evaluate('CHOOSE(2, "a", "b", "c")')).toBe("b");
	});
});

describe("array functions", () => {
	it("COUNT", () => {
		expect(evaluate("COUNT({a})", { a: [1, 2, 3] })).toBe(3);
		expect(evaluate("COUNT({a})", { a: null })).toBe(0);
	});
	it("ISEMPTY", () => {
		expect(evaluate("ISEMPTY({a})", { a: [] })).toBe(true);
		expect(evaluate("ISEMPTY({a})", { a: ["x"] })).toBe(false);
	});
	it("CONTAINS is case-sensitive", () => {
		expect(evaluate('CONTAINS({a}, "urgent")', { a: ["urgent"] })).toBe(true);
		expect(evaluate('CONTAINS({a}, "Urgent")', { a: ["urgent"] })).toBe(false);
	});
	it("JOIN", () => {
		expect(evaluate('JOIN({a}, ", ")', { a: ["tag1", "tag2"] })).toBe(
			"tag1, tag2"
		);
	});
});

describe("dependency extraction and ordering", () => {
	it("extracts {id} references", () => {
		expect(extractFieldReferences("{a} + {b} - {cv_1}")).toEqual([
			"a",
			"b",
			"cv_1",
		]);
	});

	it("orders variables so dependencies evaluate first", () => {
		const variables = [
			cv("cv_total", "{cv_base} * 2"),
			cv("cv_base", "{price}"),
		];
		const order = getSafeEvaluationOrder(variables);
		expect(order.indexOf("cv_base")).toBeLessThan(order.indexOf("cv_total"));
	});

	it("detects a cycle between two variables", () => {
		const variables = [cv("cv_a", "{cv_b}"), cv("cv_b", "{cv_a}")];
		const cycles = detectCycles(variables);
		expect(cycles.length).toBeGreaterThan(0);
	});

	it("falls back to declaration order when variables cycle", () => {
		const variables = [cv("cv_a", "{cv_b}"), cv("cv_b", "{cv_a}")];
		expect(getSafeEvaluationOrder(variables)).toEqual(["cv_a", "cv_b"]);
	});
});

describe("evaluateComputedVariables", () => {
	it("evaluates in dependency order and injects results into context", () => {
		const variables = [
			cv("cv_total", "{cv_base} * 2"),
			cv("cv_base", "{price}"),
		];
		const results = evaluateComputedVariables(variables, { price: 10 });
		expect(results.cv_base).toBe(10);
		expect(results.cv_total).toBe(20);
	});

	it("never throws and reports null for a broken formula", () => {
		const variables = [cv("cv_broken", "1 +")];
		const results = evaluateComputedVariables(variables, {});
		expect(results.cv_broken).toBeNull();
	});

	it("does not crash on a cyclic configuration", () => {
		const variables = [cv("cv_a", "{cv_b}"), cv("cv_b", "{cv_a}")];
		expect(() => evaluateComputedVariables(variables, {})).not.toThrow();
	});
});

describe("evaluateFormula", () => {
	it("matches the lower-level evaluate helper", () => {
		expect(evaluateFormula("{x} + {y}", { x: 1, y: 2 })).toBe(3);
	});
});

describe("validateComputedVariables", () => {
	it("flags an unknown field reference", () => {
		const errors = validateComputedVariables(
			[cv("cv_a", "{missing_field} + 1")],
			["price"]
		);
		expect(errors.some((e) => e.id === "cv_a")).toBe(true);
	});

	it("flags self-reference", () => {
		const errors = validateComputedVariables([cv("cv_a", "{cv_a} + 1")], []);
		expect(errors.some((e) => e.id === "cv_a")).toBe(true);
	});

	it("flags an unknown function", () => {
		const errors = validateComputedVariables([cv("cv_a", "NOPE(1)")], []);
		expect(errors.some((e) => e.id === "cv_a")).toBe(true);
	});

	it("flags a wrong argument count", () => {
		const errors = validateComputedVariables([cv("cv_a", "ROUND()")], []);
		expect(errors.some((e) => e.id === "cv_a")).toBe(true);
	});

	it("flags a circular dependency", () => {
		const errors = validateComputedVariables(
			[cv("cv_a", "{cv_b}"), cv("cv_b", "{cv_a}")],
			[]
		);
		expect(errors.some((e) => e.id === "cv_a")).toBe(true);
		expect(errors.some((e) => e.id === "cv_b")).toBe(true);
	});

	it("passes for a valid, acyclic configuration", () => {
		const errors = validateComputedVariables(
			[cv("cv_total", "{price} * {qty}")],
			["price", "qty"]
		);
		expect(errors).toEqual([]);
	});
});
