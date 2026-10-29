import { describe, expect, test } from "bun:test";

import {
	DecryptionError,
	decryptApiKey,
	encryptApiKey,
	maskApiKey,
} from "./crypto";

const SECRET_A = "this-is-a-32-char-long-secret!!";
const SECRET_B = "a-completely-different-secret!!";

describe("ai credential encryption", () => {
	test("round-trips a plaintext key", () => {
		const encrypted = encryptApiKey(SECRET_A, "sk-test-1234567890");
		expect(decryptApiKey(SECRET_A, encrypted)).toBe("sk-test-1234567890");
	});

	test("produces different ciphertext for the same plaintext (random IV)", () => {
		const a = encryptApiKey(SECRET_A, "sk-same-value");
		const b = encryptApiKey(SECRET_A, "sk-same-value");
		expect(a).not.toBe(b);
	});

	test("fails to decrypt with the wrong secret", () => {
		const encrypted = encryptApiKey(SECRET_A, "sk-test");
		expect(() => decryptApiKey(SECRET_B, encrypted)).toThrow(DecryptionError);
	});

	test("fails to decrypt tampered ciphertext", () => {
		const encrypted = encryptApiKey(SECRET_A, "sk-test");
		const bytes = Buffer.from(encrypted, "base64");
		const last = bytes.at(-1) ?? 0;
		bytes[bytes.length - 1] = last === 0 ? 1 : 0;
		const tampered = bytes.toString("base64");
		expect(() => decryptApiKey(SECRET_A, tampered)).toThrow(DecryptionError);
	});

	test("rejects a too-short secret", () => {
		expect(() => encryptApiKey("short", "sk-test")).toThrow();
	});

	test("masks a key to its last 4 characters", () => {
		expect(maskApiKey("sk-abcdefgh1234")).toBe("•••• 1234");
	});
});
