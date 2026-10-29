/**
 * Passphrase-based cryptography for backup archives (see BACKUP_DESIGN.md).
 *
 * Two independent things live here:
 * 1. `encryptSecretsMap`/`decryptSecretsMap` — a one-shot AES-256-GCM blob for
 *    the small `secrets.enc` file inside a `.stryve.zip` (webhook secrets,
 *    SMTP passwords, the AI provider key…).
 * 2. `encryptStream`/`decryptStream` — the streaming `.stryve-backup`
 *    container that wraps a WHOLE instance backup archive, because it's too
 *    large to hold in memory and may itself contain password hashes.
 *
 * Both derive their key from the user's passphrase with scrypt
 * (N=2^17, r=8, p=1, random 16-byte salt), never from BETTER_AUTH_SECRET —
 * that's the opposite case (see services/ai/crypto.ts), used for the
 * unattended scheduled-backup passphrase, which scheduler.ts/destinations.ts
 * (engineer R) should reuse as-is rather than duplicating.
 */
import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	scrypt as scryptAsync,
} from "node:crypto";

import { type ArchiveSource, readableFromAsyncGenerator } from "./streams";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/** scrypt cost parameters agreed in BACKUP_DESIGN.md. */
export const SCRYPT_PARAMS = { N: 2 ** 17, p: 1, r: 8 } as const;
/** scrypt at N=2^17, r=8 needs roughly 128 MiB; Node's default 32 MiB cap would reject it. */
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

export const MIN_PASSPHRASE_LENGTH = 12;

export class WeakPassphraseError extends Error {
	constructor() {
		super(`Use a passphrase of at least ${MIN_PASSPHRASE_LENGTH} characters.`);
	}
}

/** Thrown by every decrypt path here on a bad passphrase or a tampered/corrupted ciphertext. */
export class WrongPassphraseError extends Error {
	constructor(cause?: unknown) {
		super(
			"That passphrase doesn't match this file, or the file is corrupted.",
			{
				cause,
			}
		);
	}
}

/** Thrown when a `.stryve-backup` container's stream ends before its final-chunk marker. */
export class TruncatedContainerError extends Error {
	constructor() {
		super(
			"This backup file is incomplete — it looks like it was cut off while downloading or uploading."
		);
	}
}

export function assertPassphraseStrength(passphrase: string): void {
	if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
		throw new WeakPassphraseError();
	}
}

function deriveKey(passphrase: string, salt: Uint8Array): Promise<Buffer> {
	return new Promise((resolvePromise, rejectPromise) => {
		scryptAsync(
			passphrase,
			Buffer.from(salt),
			KEY_LENGTH,
			{
				N: SCRYPT_PARAMS.N,
				maxmem: SCRYPT_MAXMEM,
				p: SCRYPT_PARAMS.p,
				r: SCRYPT_PARAMS.r,
			},
			(error, derived) => {
				if (error) {
					rejectPromise(error);
				} else {
					resolvePromise(derived);
				}
			}
		);
	});
}

function concatBytes(
	a: Uint8Array<ArrayBufferLike>,
	b: Uint8Array<ArrayBufferLike>
): Uint8Array<ArrayBufferLike> {
	if (a.length === 0) {
		return b;
	}
	if (b.length === 0) {
		return a;
	}
	const out = new Uint8Array(a.length + b.length);
	out.set(a, 0);
	out.set(b, a.length);
	return out;
}

/* -------------------------------------------------------------------------- */
/*                      One-shot secrets map (secrets.enc)                    */
/* -------------------------------------------------------------------------- */

/**
 * Encrypts `{ secretRef -> plaintext value }` for `secrets.enc`.
 * Layout: salt(16) | iv(12) | authTag(16) | ciphertext.
 */
export async function encryptSecretsMap(
	passphrase: string,
	map: Record<string, string>
): Promise<Uint8Array> {
	assertPassphraseStrength(passphrase);
	const salt = randomBytes(SALT_LENGTH);
	const key = await deriveKey(passphrase, salt);
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const plaintext = Buffer.from(JSON.stringify(map), "utf8");
	const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return new Uint8Array(Buffer.concat([salt, iv, authTag, ciphertext]));
}

/** Decrypts a blob produced by {@link encryptSecretsMap}. Throws `WrongPassphraseError`. */
export async function decryptSecretsMap(
	passphrase: string,
	bytes: Uint8Array
): Promise<Record<string, string>> {
	const buf = Buffer.from(bytes);
	const minLength = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
	if (buf.length < minLength) {
		throw new WrongPassphraseError();
	}
	const salt = buf.subarray(0, SALT_LENGTH);
	const iv = buf.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
	const authTag = buf.subarray(
		SALT_LENGTH + IV_LENGTH,
		SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
	);
	const ciphertext = buf.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
	const key = await deriveKey(passphrase, salt);
	try {
		const decipher = createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);
		const plaintext = Buffer.concat([
			decipher.update(ciphertext),
			decipher.final(),
		]);
		return JSON.parse(plaintext.toString("utf8"));
	} catch (cause) {
		// biome-ignore lint/style/useErrorCause: it is passed, just inside the subclass
		throw new WrongPassphraseError(cause);
	}
}

/* -------------------------------------------------------------------------- */
/*                 Streaming `.stryve-backup` chunked container               */
/* -------------------------------------------------------------------------- */

export const CONTAINER_MAGIC = "STRYVEBK";
export const CONTAINER_VERSION = 1;
/** Plaintext bytes per chunk before encryption (the last content chunk may be shorter). */
export const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;
const NONCE_LENGTH = 12;
/** magic(8) + version(1) + salt(16) + baseNonce(12) + chunkSize(4) */
const HEADER_LENGTH = 8 + 1 + SALT_LENGTH + NONCE_LENGTH + 4;

interface ContainerHeader {
	baseNonce: Buffer;
	chunkSize: number;
	salt: Buffer;
	version: number;
}

function buildHeaderBytes(header: Omit<ContainerHeader, "version">): Buffer {
	const buf = Buffer.alloc(HEADER_LENGTH);
	let offset = 0;
	buf.write(CONTAINER_MAGIC, offset, "ascii");
	offset += 8;
	buf.writeUInt8(CONTAINER_VERSION, offset);
	offset += 1;
	header.salt.copy(buf, offset);
	offset += SALT_LENGTH;
	header.baseNonce.copy(buf, offset);
	offset += NONCE_LENGTH;
	buf.writeUInt32LE(header.chunkSize, offset);
	return buf;
}

/** Reads exactly `n` bytes from a stream, buffering across chunk boundaries. */
class ByteReader {
	private buffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
	private eof = false;
	// Left untyped on purpose: `stream.getReader()`'s own inferred return type
	// can differ subtly between ambient lib typings, and naming
	// `ReadableStreamDefaultReader` explicitly here can clash with it.
	private readonly reader;

	constructor(stream: ArchiveSource) {
		this.reader = stream.getReader();
	}

	private async fill(n: number) {
		while (this.buffer.length < n && !this.eof) {
			// biome-ignore lint/performance/noAwaitInLoops: bytes must arrive in stream order
			const { done, value } = await this.reader.read();
			if (done) {
				this.eof = true;
				break;
			}
			this.buffer = concatBytes(this.buffer, value);
		}
	}

	/** Reads exactly `n` bytes, or throws `TruncatedContainerError` if the stream ends first. */
	async readExact(n: number): Promise<Uint8Array> {
		await this.fill(n);
		if (this.buffer.length < n) {
			throw new TruncatedContainerError();
		}
		const chunk = this.buffer.subarray(0, n);
		this.buffer = this.buffer.subarray(n);
		return chunk;
	}
}

function chunkNonce(baseNonce: Buffer, counter: number): Buffer {
	const nonce = Buffer.alloc(NONCE_LENGTH);
	baseNonce.copy(nonce, 0, 0, 8);
	nonce.writeUInt32BE(counter, 8);
	return nonce;
}

/** flag(1) | ciphertextLength(4, LE) | ciphertext | authTag(16) */
function encryptChunk(
	key: Buffer,
	baseNonce: Buffer,
	counter: number,
	plaintext: Uint8Array,
	isFinal: boolean
): Buffer {
	const cipher = createCipheriv(ALGORITHM, key, chunkNonce(baseNonce, counter));
	const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const authTag = cipher.getAuthTag();
	const frame = Buffer.alloc(1 + 4 + ciphertext.length + AUTH_TAG_LENGTH);
	frame.writeUInt8(isFinal ? 1 : 0, 0);
	frame.writeUInt32LE(ciphertext.length, 1);
	ciphertext.copy(frame, 5);
	authTag.copy(frame, 5 + ciphertext.length);
	return frame;
}

async function readHeader(reader: ByteReader): Promise<ContainerHeader> {
	const bytes = Buffer.from(await reader.readExact(HEADER_LENGTH));
	const magic = bytes.toString("ascii", 0, 8);
	if (magic !== CONTAINER_MAGIC) {
		throw new WrongPassphraseError();
	}
	const version = bytes.readUInt8(8);
	if (version !== CONTAINER_VERSION) {
		throw new Error(
			`This backup was made with a newer .stryve-backup container (v${version}). Upgrade StryveForms to restore it.`
		);
	}
	const salt = Buffer.from(bytes.subarray(9, 9 + SALT_LENGTH));
	const baseNonce = Buffer.from(
		bytes.subarray(9 + SALT_LENGTH, 9 + SALT_LENGTH + NONCE_LENGTH)
	);
	const chunkSize = bytes.readUInt32LE(9 + SALT_LENGTH + NONCE_LENGTH);
	return { baseNonce, chunkSize, salt, version };
}

/** Peeks a `.stryve-backup` container's plaintext header without decrypting any data. */
export async function readContainerHeader(
	source: ArchiveSource
): Promise<{ chunkSize: number; version: number }> {
	const header = await readHeader(new ByteReader(source));
	return { chunkSize: header.chunkSize, version: header.version };
}

/**
 * Wraps `source` into a streaming AES-256-GCM `.stryve-backup` container.
 * The caller pipes the result into an `ArchiveSink` (see streams.ts).
 */
export function encryptStream(
	source: ArchiveSource,
	passphrase: string
): ArchiveSource {
	assertPassphraseStrength(passphrase);
	async function* generate() {
		const salt = randomBytes(SALT_LENGTH);
		const baseNonce = randomBytes(NONCE_LENGTH);
		const key = await deriveKey(passphrase, salt);
		yield new Uint8Array(
			buildHeaderBytes({ baseNonce, chunkSize: DEFAULT_CHUNK_SIZE, salt })
		);

		const reader = source.getReader();
		let buffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
		let counter = 0;
		let sourceDone = false;
		while (!sourceDone) {
			// biome-ignore lint/performance/noAwaitInLoops: the source stream must be drained in order
			const { done, value } = await reader.read();
			if (done) {
				sourceDone = true;
			} else {
				buffer = concatBytes(buffer, value);
			}
			while (buffer.length >= DEFAULT_CHUNK_SIZE) {
				const plain = buffer.subarray(0, DEFAULT_CHUNK_SIZE);
				buffer = buffer.subarray(DEFAULT_CHUNK_SIZE);
				yield new Uint8Array(
					encryptChunk(key, baseNonce, counter, plain, false)
				);
				counter += 1;
			}
		}
		if (buffer.length > 0) {
			yield new Uint8Array(
				encryptChunk(key, baseNonce, counter, buffer, false)
			);
			counter += 1;
		}
		// Empty final marker chunk — its presence is what lets a reader tell a
		// clean end from a truncated upload/download.
		yield new Uint8Array(
			encryptChunk(key, baseNonce, counter, new Uint8Array(0), true)
		);
	}
	return readableFromAsyncGenerator(generate());
}

/**
 * Unwraps a `.stryve-backup` container back into the plaintext `.stryve.zip`
 * bytes. Throws `WrongPassphraseError` on a bad passphrase/tampering, and
 * `TruncatedContainerError` if the stream ends before the final-chunk marker.
 */
export function decryptStream(
	source: ArchiveSource,
	passphrase: string
): ArchiveSource {
	async function* generate() {
		const byteReader = new ByteReader(source);
		const header = await readHeader(byteReader);
		const key = await deriveKey(passphrase, header.salt);
		let counter = 0;
		let sawFinal = false;
		while (!sawFinal) {
			// biome-ignore lint/performance/noAwaitInLoops: each chunk frame must be read in container order
			const [flag] = await byteReader.readExact(1);
			const lengthBytes = await byteReader.readExact(4);
			const ciphertextLength = Buffer.from(lengthBytes).readUInt32LE(0);
			const ciphertext = await byteReader.readExact(ciphertextLength);
			const authTag = await byteReader.readExact(AUTH_TAG_LENGTH);
			const decipher = createDecipheriv(
				ALGORITHM,
				key,
				chunkNonce(header.baseNonce, counter)
			);
			decipher.setAuthTag(Buffer.from(authTag));
			let plaintext: Buffer;
			try {
				plaintext = Buffer.concat([
					decipher.update(Buffer.from(ciphertext)),
					decipher.final(),
				]);
			} catch (cause) {
				// biome-ignore lint/style/useErrorCause: it is passed, just inside the subclass
				throw new WrongPassphraseError(cause);
			}
			counter += 1;
			if (flag === 1) {
				sawFinal = true;
			} else if (plaintext.length > 0) {
				yield new Uint8Array(plaintext);
			}
		}
	}
	return readableFromAsyncGenerator(generate());
}
