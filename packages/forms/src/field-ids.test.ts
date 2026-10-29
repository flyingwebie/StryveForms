import { describe, expect, test } from "bun:test";
import {
	findDuplicateFieldIds,
	renameFieldIdReferences,
	slugifyFieldId,
	uniqueFieldId,
} from "./field-ids";
import { defaultFormSettings } from "./settings";
import type { FormField } from "./types";

describe("slugifyFieldId", () => {
	test("lowercases and joins words with underscores", () => {
		expect(slugifyFieldId("Full Name")).toBe("full_name");
	});

	test("strips accents and punctuation", () => {
		expect(slugifyFieldId("Café Name?!")).toBe("cafe_name");
	});

	test("falls back to 'field' for an empty/symbol-only label", () => {
		expect(slugifyFieldId("???")).toBe("field");
		expect(slugifyFieldId("")).toBe("field");
	});
});

describe("uniqueFieldId", () => {
	test("returns the plain slug when free", () => {
		expect(uniqueFieldId("Full Name", [])).toBe("full_name");
	});

	test("appends _2, _3… on collision", () => {
		expect(uniqueFieldId("Full Name", ["full_name"])).toBe("full_name_2");
		expect(uniqueFieldId("Full Name", ["full_name", "full_name_2"])).toBe(
			"full_name_3"
		);
	});

	test("ignores the field's own id so re-slugging to the same value is a no-op", () => {
		expect(uniqueFieldId("Full Name", ["full_name"], "full_name")).toBe(
			"full_name"
		);
	});
});

describe("findDuplicateFieldIds", () => {
	test("finds ids used by more than one field", () => {
		const fields: FormField[] = [
			{ id: "a", name: "A", type: "text" },
			{ id: "b", name: "B", type: "text" },
			{ id: "a", name: "A2", type: "text" },
		];
		expect(findDuplicateFieldIds(fields)).toEqual(["a"]);
	});

	test("returns an empty array when every id is unique", () => {
		const fields: FormField[] = [
			{ id: "a", name: "A", type: "text" },
			{ id: "b", name: "B", type: "text" },
		];
		expect(findDuplicateFieldIds(fields)).toEqual([]);
	});
});

describe("renameFieldIdReferences", () => {
	test("rewrites a logic condition on another field", () => {
		const other: FormField = {
			id: "shirt_size",
			name: "Shirt size",
			type: "text",
			logic: {
				actions: ["hide-block"],
				conditions: {
					value: {
						operator: "equals",
						property_meta: { id: "old_id", type: "checkbox" },
						value: true,
					},
				},
			},
		};
		const settings = { ...defaultFormSettings(), properties: [other] };
		const next = renameFieldIdReferences(settings, "old_id", "new_id");
		const field = next.properties[0] as FormField;
		const conditions = field.logic?.conditions as {
			value: { property_meta: { id: string } };
		};
		expect(conditions.value.property_meta.id).toBe("new_id");
	});

	test("rewrites a mention span's field id inside help text", () => {
		const field: FormField = {
			id: "confirm",
			name: "Confirm",
			type: "nf-text",
			help: '<p>Hi <span mention="true" mention-field-id="old_id" mention-field-name="Name" mention-fallback="" contenteditable="false">Name</span></p>',
		};
		const settings = { ...defaultFormSettings(), properties: [field] };
		const next = renameFieldIdReferences(settings, "old_id", "new_id");
		const result = next.properties[0] as FormField;
		expect(result.help).toContain('mention-field-id="new_id"');
		expect(result.help).not.toContain("old_id");
	});

	test("rewrites a field reference inside a computed-variable formula", () => {
		const settings = {
			...defaultFormSettings(),
			computedVariables: [
				{ formula: "{old_id} * 2", id: "cv_total", name: "Total" },
			],
		};
		const next = renameFieldIdReferences(settings, "old_id", "new_id");
		expect(next.computedVariables[0]?.formula).toBe("{new_id} * 2");
	});

	test("rewrites mentions in form-level free-text settings", () => {
		const settings = {
			...defaultFormSettings(),
			redirectUrl:
				'https://example.com?name=<span mention="true" mention-field-id="old_id" mention-field-name="Name" mention-fallback="" contenteditable="false">Name</span>',
		};
		const next = renameFieldIdReferences(settings, "old_id", "new_id");
		expect(next.redirectUrl).toContain('mention-field-id="new_id"');
	});

	test("is a no-op when old and new ids match", () => {
		const settings = defaultFormSettings();
		expect(renameFieldIdReferences(settings, "same", "same")).toBe(settings);
	});
});
