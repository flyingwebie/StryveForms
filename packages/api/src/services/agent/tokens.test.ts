import { describe, expect, test } from "bun:test";

import {
	abilitiesForScope,
	hashToken,
	isPersonalApiToken,
	scopeFromAbilities,
} from "./tokens";

const SHA256_HEX = /^[0-9a-f]{64}$/;

describe("hashToken", () => {
	test("is deterministic", () => {
		expect(hashToken("sfpat_abc")).toBe(hashToken("sfpat_abc"));
	});

	test("produces a 64-char hex sha256 digest", () => {
		expect(hashToken("sfpat_abc")).toMatch(SHA256_HEX);
	});

	test("different tokens hash differently", () => {
		expect(hashToken("sfpat_abc")).not.toBe(hashToken("sfpat_xyz"));
	});
});

describe("scope <-> abilities", () => {
	test("read scope has no write ability", () => {
		expect(abilitiesForScope("read")).toEqual(["read"]);
		expect(scopeFromAbilities(["read"])).toBe("read");
	});

	test("write scope includes both abilities", () => {
		expect(abilitiesForScope("write")).toEqual(["read", "write"]);
		expect(scopeFromAbilities(["read", "write"])).toBe("write");
	});

	test("scopeFromAbilities defaults to read for an empty/unknown list", () => {
		expect(scopeFromAbilities([])).toBe("read");
		expect(scopeFromAbilities(["something-else"])).toBe("read");
	});

	test("round-trips through both directions", () => {
		for (const scope of ["read", "write"] as const) {
			expect(scopeFromAbilities(abilitiesForScope(scope))).toBe(scope);
		}
	});
});

describe("isPersonalApiToken", () => {
	test("accepts our prefix", () => {
		expect(isPersonalApiToken("sfpat_abcdef")).toBe(true);
	});

	test("rejects an OAuth-looking JWT", () => {
		expect(isPersonalApiToken("eyJhbGciOiJFZERTQSJ9.payload.sig")).toBe(false);
	});

	test("rejects an empty string", () => {
		expect(isPersonalApiToken("")).toBe(false);
	});
});
