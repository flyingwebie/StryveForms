/**
 * Encrypts workspace AI provider keys at rest (AES-256-GCM). The encryption
 * key is derived with HKDF-SHA256 from BETTER_AUTH_SECRET, so no separate
 * secret needs to be provisioned. A fixed `info` string scopes the derived
 * key to this one purpose, keeping it independent from other uses of the
 * same root secret (e.g. signed file links).
 */
import {
	createCipheriv,
	createDecipheriv,
	hkdfSync,
	randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const HKDF_INFO = "stryveforms.ai-credential.v1";

export class DecryptionError extends Error {
	constructor(cause?: unknown) {
		super(
			"Could not decrypt this API key. It may have been saved with a different secret.",
			{ cause }
		);
	}
}

function deriveKey(secret: string): Buffer {
	if (!secret || secret.length < 16) {
		throw new Error(
			"BETTER_AUTH_SECRET is missing or too short to derive an encryption key"
		);
	}
	const derived = hkdfSync("sha256", secret, "", HKDF_INFO, KEY_LENGTH);
	return Buffer.from(derived);
}

/** Encrypts a plaintext API key for storage in `ai_credential.encryptedKey`. */
export function encryptApiKey(secret: string, plaintext: string): string {
	const key = deriveKey(secret);
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const ciphertext = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();
	return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Decrypts a value produced by {@link encryptApiKey}. Throws `DecryptionError` on tampering or a mismatched secret. */
export function decryptApiKey(secret: string, encoded: string): string {
	const key = deriveKey(secret);
	let raw: Buffer;
	try {
		raw = Buffer.from(encoded, "base64");
	} catch (cause) {
		// DecryptionError forwards `cause` to `Error`'s `{ cause }` option internally.
		// biome-ignore lint/style/useErrorCause: it is passed, just inside the subclass
		throw new DecryptionError(cause);
	}
	if (raw.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
		throw new DecryptionError();
	}
	const iv = raw.subarray(0, IV_LENGTH);
	const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
	const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
	try {
		const decipher = createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);
		const plaintext = Buffer.concat([
			decipher.update(ciphertext),
			decipher.final(),
		]);
		return plaintext.toString("utf8");
	} catch (cause) {
		// biome-ignore lint/style/useErrorCause: it is passed, just inside the subclass
		throw new DecryptionError(cause);
	}
}

/** `•••• last4` — safe to send to the browser once a key is saved. */
export function maskApiKey(plaintext: string): string {
	const tail = plaintext.slice(-4);
	return tail.length === 4 ? `•••• ${tail}` : "••••";
}
