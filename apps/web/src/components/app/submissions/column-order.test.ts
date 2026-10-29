import type { FormField } from "@StryveForms/forms/types";
import { describe, expect, test } from "bun:test";

import {
	BASE_COLUMN_IDS,
	defaultColumnOrder,
	reconcileColumnOrder,
} from "./column-order";

function field(id: string): FormField {
	return { id, name: id, type: "text" };
}

describe("defaultColumnOrder", () => {
	test("built-in columns come first, then fields in form order", () => {
		expect(defaultColumnOrder([field("a"), field("b")])).toEqual([
			...BASE_COLUMN_IDS,
			"a",
			"b",
		]);
	});

	test("an empty field list still returns the built-in columns", () => {
		expect(defaultColumnOrder([])).toEqual([...BASE_COLUMN_IDS]);
	});
});

describe("reconcileColumnOrder", () => {
	test("keeps a saved order unchanged when nothing changed", () => {
		const saved = [...BASE_COLUMN_IDS, "b", "a"];
		expect(reconcileColumnOrder(saved, [field("a"), field("b")])).toEqual(
			saved
		);
	});

	test("appends a newly added field at the end", () => {
		const saved = [...BASE_COLUMN_IDS, "a"];
		expect(reconcileColumnOrder(saved, [field("a"), field("b")])).toEqual([
			...BASE_COLUMN_IDS,
			"a",
			"b",
		]);
	});

	test("drops a field that no longer exists on the form", () => {
		const saved = [...BASE_COLUMN_IDS, "a", "deleted-field"];
		expect(reconcileColumnOrder(saved, [field("a")])).toEqual([
			...BASE_COLUMN_IDS,
			"a",
		]);
	});

	test("an empty saved order falls back to the default order", () => {
		expect(reconcileColumnOrder([], [field("a"), field("b")])).toEqual(
			defaultColumnOrder([field("a"), field("b")])
		);
	});

	test("preserves a custom order the user picked (field before built-ins)", () => {
		const saved = ["a", "status", "createdAt", "b"];
		expect(reconcileColumnOrder(saved, [field("a"), field("b")])).toEqual(
			saved
		);
	});
});
