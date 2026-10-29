import { describe, expect, test } from "bun:test";

import {
	CAPABILITIES,
	effectiveCapabilityMatrix,
	roleAllows,
	roleAllowsCapability,
} from "./access";

describe("roleAllows (broad view/edit/manage levels)", () => {
	test("admin can do everything", () => {
		expect(roleAllows("admin", "view")).toBe(true);
		expect(roleAllows("admin", "edit")).toBe(true);
		expect(roleAllows("admin", "manage")).toBe(true);
	});

	test("a member can view and edit, but not manage", () => {
		expect(roleAllows("user", "view")).toBe(true);
		expect(roleAllows("user", "edit")).toBe(true);
		expect(roleAllows("user", "manage")).toBe(false);
	});

	test("read only can only view", () => {
		expect(roleAllows("readonly", "view")).toBe(true);
		expect(roleAllows("readonly", "edit")).toBe(false);
		expect(roleAllows("readonly", "manage")).toBe(false);
	});
});

describe("effectiveCapabilityMatrix", () => {
	test("admin is always allowed every capability and ignores overrides", () => {
		const matrix = effectiveCapabilityMatrix({
			rolePermissions: { user: { edit_forms: false } },
		});
		for (const { key } of CAPABILITIES) {
			expect(matrix.admin[key]).toBe(true);
		}
	});

	test("defaults with no override mirror today's broad permissions", () => {
		const matrix = effectiveCapabilityMatrix(undefined);
		expect(matrix.user.edit_forms).toBe(true);
		expect(matrix.user.delete_forms).toBe(true);
		expect(matrix.user.manage_members).toBe(false);
		expect(matrix.user.manage_workspace).toBe(false);
		expect(matrix.readonly.view_forms).toBe(true);
		expect(matrix.readonly.edit_forms).toBe(false);
		expect(matrix.readonly.manage_members).toBe(false);
	});

	test("a saved override replaces just that capability for that role", () => {
		const matrix = effectiveCapabilityMatrix({
			rolePermissions: { user: { delete_forms: false } },
		});
		expect(matrix.user.delete_forms).toBe(false);
		// Untouched capabilities keep their default.
		expect(matrix.user.edit_forms).toBe(true);
		expect(matrix.readonly.view_forms).toBe(true);
	});

	test("an override can grant a capability a role wouldn't have by default", () => {
		const matrix = effectiveCapabilityMatrix({
			rolePermissions: { readonly: { manage_submissions: true } },
		});
		expect(matrix.readonly.manage_submissions).toBe(true);
	});
});

describe("roleAllowsCapability", () => {
	test("admin bypasses the matrix entirely", () => {
		expect(
			roleAllowsCapability("admin", "manage_members", {
				rolePermissions: { user: {} },
			})
		).toBe(true);
	});

	test("honours a saved override for a non-admin role", () => {
		const settings = { rolePermissions: { user: { delete_forms: false } } };
		expect(roleAllowsCapability("user", "delete_forms", settings)).toBe(false);
		expect(roleAllowsCapability("user", "edit_forms", settings)).toBe(true);
	});

	test("falls back to the default when no settings are saved", () => {
		expect(roleAllowsCapability("readonly", "edit_forms")).toBe(false);
		expect(roleAllowsCapability("user", "edit_forms")).toBe(true);
	});
});
