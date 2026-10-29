import { describe, expect, test } from "bun:test";

import { resolveSmtpEncryption } from "./mail";

describe("resolveSmtpEncryption", () => {
	test("uses the saved encryption value when present", () => {
		expect(resolveSmtpEncryption({ encryption: "none", secure: true })).toBe(
			"none"
		);
	});

	test("migrates legacy secure:true to ssl", () => {
		expect(resolveSmtpEncryption({ secure: true })).toBe("ssl");
	});

	test("migrates legacy secure:false to starttls", () => {
		expect(resolveSmtpEncryption({ secure: false })).toBe("starttls");
	});

	test("defaults to ssl when nothing is saved (old default was secure:true)", () => {
		expect(resolveSmtpEncryption(undefined)).toBe("ssl");
		expect(resolveSmtpEncryption({})).toBe("ssl");
	});
});
