import { describe, expect, test } from "bun:test";

import type { FormDto } from "../lib/serialize";
import {
	BUILTIN_CATEGORIES,
	getTemplate,
	structureFromForm,
	TEMPLATES,
} from "./templates";

/** Minimal FormDto stand-in — only the fields structureFromForm cares about matter. */
function fakeFormDto(overrides: Partial<FormDto> = {}): FormDto {
	return {
		id: "form_1",
		slug: "my-form-ab12cd",
		workspaceId: "ws_1",
		creatorId: "user_1",
		hasPassword: false,
		removedProperties: [],
		shareUrl: "https://example.com/forms/my-form-ab12cd",
		createdAt: "2024-01-01T00:00:00.000Z",
		updatedAt: "2024-01-02T00:00:00.000Z",
		title: "My form",
		properties: [{ id: "f1", name: "Name", type: "text" }],
		color: "#3B82F6",
		...overrides,
	} as FormDto;
}

describe("getTemplate / BUILTIN_CATEGORIES", () => {
	test("finds a built-in template by slug", () => {
		expect(getTemplate("contact")?.name).toBe("Contact form");
	});

	test("returns null for an unknown slug", () => {
		expect(getTemplate("does-not-exist")).toBeNull();
	});

	test("lists every distinct built-in category, sorted", () => {
		const expected = Array.from(
			new Set(TEMPLATES.map((t) => t.category))
		).sort();
		expect(BUILTIN_CATEGORIES).toEqual(expected);
	});
});

describe("structureFromForm", () => {
	test("keeps the form's design settings", () => {
		const structure = structureFromForm(fakeFormDto());
		expect(structure.title).toBe("My form");
		expect(structure.properties).toEqual([
			{ id: "f1", name: "Name", type: "text" },
		]);
		expect(structure.color).toBe("#3B82F6");
	});

	test("drops identity and ownership fields a template must not carry", () => {
		const structure = structureFromForm(fakeFormDto()) as Record<
			string,
			unknown
		>;
		for (const key of [
			"id",
			"slug",
			"workspaceId",
			"creatorId",
			"hasPassword",
			"removedProperties",
			"shareUrl",
			"createdAt",
			"updatedAt",
		]) {
			expect(key in structure).toBe(false);
		}
	});
});
