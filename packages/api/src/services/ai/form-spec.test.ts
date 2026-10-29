import { describe, expect, test } from "bun:test";

import {
	buildField,
	buildFields,
	formSpecSchema,
	InvalidBlockError,
} from "./form-spec";

describe("form-spec -> FormField conversion", () => {
	test("builds a plain text field with catalogue defaults", () => {
		const field = buildField({ blockId: "text", name: "Full name" });
		expect(field.type).toBe("text");
		expect(field.name).toBe("Full name");
		expect(typeof field.id).toBe("string");
		expect(field.id.length).toBeGreaterThan(0);
	});

	test("applies required, width, help and placeholder overrides", () => {
		const field = buildField({
			blockId: "email",
			help: "We never share this",
			name: "Work email",
			placeholder: "you@company.com",
			required: true,
			width: "1/2",
		});
		expect(field.required).toBe(true);
		expect(field.width).toBe("1/2");
		expect(field.help).toBe("We never share this");
		expect(field.placeholder).toBe("you@company.com");
	});

	test("builds select options from plain strings", () => {
		const field = buildField({
			blockId: "select",
			name: "Favourite colour",
			options: ["Red", "Green", "Blue"],
		});
		expect(field.select).toEqual({
			options: [
				{ id: "Red", name: "Red" },
				{ id: "Green", name: "Green" },
				{ id: "Blue", name: "Blue" },
			],
		});
	});

	test("radio stores options the same way as select, with without_dropdown", () => {
		const field = buildField({
			blockId: "radio",
			name: "Size",
			options: ["S", "M", "L"],
		});
		expect(field.without_dropdown).toBe(true);
		expect(field.select?.options).toHaveLength(3);
	});

	test("multi_select stores options under multi_select, not select", () => {
		const field = buildField({
			blockId: "multi_select",
			name: "Toppings",
			options: ["Cheese", "Pepperoni"],
		});
		expect(field.multi_select?.options).toHaveLength(2);
		expect(field.select).toBeUndefined();
	});

	test("every generated field id is unique", () => {
		const fields = buildFields([
			{ blockId: "text", name: "A" },
			{ blockId: "text", name: "B" },
			{ blockId: "text", name: "C" },
		]);
		const ids = new Set(fields.map((f) => f.id));
		expect(ids.size).toBe(3);
	});

	test("throws a clear error for an unknown block id", () => {
		expect(() =>
			buildField({ blockId: "not-a-real-block", name: "X" })
		).toThrow(InvalidBlockError);
	});

	test("formSpecSchema rejects an empty field list", () => {
		const result = formSpecSchema.safeParse({ fields: [], title: "Empty" });
		expect(result.success).toBe(false);
	});

	test("formSpecSchema accepts a valid spec", () => {
		const result = formSpecSchema.safeParse({
			fields: [{ blockId: "text", name: "Name" }],
			title: "Signup",
		});
		expect(result.success).toBe(true);
	});
});
