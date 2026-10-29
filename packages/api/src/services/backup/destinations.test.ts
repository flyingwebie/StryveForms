import { describe, expect, test } from "bun:test";

import {
	DestinationSecretError,
	decryptDestinationSecret,
	encryptDestinationSecret,
	maskSecret,
	S3_PRESETS,
	serverDestinationDraft,
} from "./destinations";

const SECRET_A = "this-is-a-32-char-long-secret!!";
const SECRET_B = "a-completely-different-secret!!";

describe("destination secret encryption", () => {
	test("round-trips a plaintext secret access key", () => {
		const encrypted = encryptDestinationSecret(SECRET_A, "s3-secret-value");
		expect(decryptDestinationSecret(SECRET_A, encrypted)).toBe(
			"s3-secret-value"
		);
	});

	test("produces different ciphertext for the same plaintext (random IV)", () => {
		const a = encryptDestinationSecret(SECRET_A, "same-value");
		const b = encryptDestinationSecret(SECRET_A, "same-value");
		expect(a).not.toBe(b);
	});

	test("fails to decrypt with the wrong instance secret", () => {
		const encrypted = encryptDestinationSecret(SECRET_A, "s3-secret");
		expect(() => decryptDestinationSecret(SECRET_B, encrypted)).toThrow(
			DestinationSecretError
		);
	});

	test("fails to decrypt tampered ciphertext", () => {
		const encrypted = encryptDestinationSecret(SECRET_A, "s3-secret");
		const bytes = Buffer.from(encrypted, "base64");
		const last = bytes.at(-1) ?? 0;
		bytes[bytes.length - 1] = last === 0 ? 1 : 0;
		expect(() =>
			decryptDestinationSecret(SECRET_A, bytes.toString("base64"))
		).toThrow(DestinationSecretError);
	});

	test("masks a secret to its last 4 characters", () => {
		expect(maskSecret("AKIA1234567890ABCD12")).toBe("•••• CD12");
	});
});

describe("S3 presets", () => {
	test("every preset has help text and a default region", () => {
		for (const preset of Object.values(S3_PRESETS)) {
			expect(preset.fields.accessKeyId.help.length).toBeGreaterThan(0);
			expect(preset.fields.secretAccessKey.help.length).toBeGreaterThan(0);
			expect(preset.fields.endpoint.help.length).toBeGreaterThan(0);
			expect(preset.defaults.region.length).toBeGreaterThan(0);
		}
	});

	test("Cloudflare R2's default region is 'auto' and the endpoint has a placeholder", () => {
		const r2 = S3_PRESETS["cloudflare-r2"];
		expect(r2.defaults.region).toBe("auto");
		expect(r2.defaults.endpoint).toContain("<ACCOUNT_ID>");
	});

	test("RustFS and MinIO default to path-style addressing", () => {
		expect(S3_PRESETS.rustfs.defaults.pathStyle).toBe(true);
		expect(S3_PRESETS.minio.defaults.pathStyle).toBe(true);
	});
});

describe("serverDestinationDraft", () => {
	test("defaults to the backups/ prefix", () => {
		const draft = serverDestinationDraft("dest-1");
		expect(draft.kind).toBe("server");
		expect(draft.prefix).toBe("backups/");
	});
});
