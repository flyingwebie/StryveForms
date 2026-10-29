import { describe, expect, test } from "bun:test";
import {
	decryptSecretsMap,
	decryptStream,
	encryptSecretsMap,
	encryptStream,
	readContainerHeader,
	TruncatedContainerError,
	WeakPassphraseError,
	WrongPassphraseError,
} from "./crypto";
import { readableFromAsyncGenerator, sourceFromBytes } from "./streams";

const PASSPHRASE = "a-strong-test-passphrase-123";

async function readAll(
	stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];
	const reader = stream.getReader();
	let total = 0;
	for (;;) {
		// biome-ignore lint/performance/noAwaitInLoops: a stream must be drained in order
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		chunks.push(value);
		total += value.length;
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}

describe("secrets.enc (encryptSecretsMap / decryptSecretsMap)", () => {
	test("round-trips a map of secrets", async () => {
		const map = {
			"integration:a:data.webhook_secret": "shh",
			"workspace:b:settings.smtp.password": "pw",
		};
		const bytes = await encryptSecretsMap(PASSPHRASE, map);
		const decrypted = await decryptSecretsMap(PASSPHRASE, bytes);
		expect(decrypted).toEqual(map);
	});

	test("rejects a passphrase shorter than 12 characters", async () => {
		await expect(encryptSecretsMap("short", {})).rejects.toBeInstanceOf(
			WeakPassphraseError
		);
	});

	test("throws WrongPassphraseError on a wrong passphrase", async () => {
		const bytes = await encryptSecretsMap(PASSPHRASE, { a: "b" });
		await expect(
			decryptSecretsMap("a-different-passphrase-1234", bytes)
		).rejects.toBeInstanceOf(WrongPassphraseError);
	});

	test("throws WrongPassphraseError on a tampered blob", async () => {
		const bytes = await encryptSecretsMap(PASSPHRASE, { a: "b" });
		const tampered = new Uint8Array(bytes);
		tampered[tampered.length - 1] = ((tampered.at(-1) ?? 0) + 1) % 256;
		await expect(
			decryptSecretsMap(PASSPHRASE, tampered)
		).rejects.toBeInstanceOf(WrongPassphraseError);
	});

	test("throws WrongPassphraseError on garbage/too-short input", async () => {
		await expect(
			decryptSecretsMap(PASSPHRASE, new Uint8Array([1, 2, 3]))
		).rejects.toBeInstanceOf(WrongPassphraseError);
	});
});

describe(".stryve-backup streaming container", () => {
	test("round-trips small content", async () => {
		const plaintext = new TextEncoder().encode("hello, stryveforms backup");
		const encrypted = encryptStream(sourceFromBytes(plaintext), PASSPHRASE);
		const encryptedBytes = await readAll(encrypted);

		const header = await readContainerHeader(sourceFromBytes(encryptedBytes));
		expect(header.version).toBe(1);

		const decrypted = decryptStream(
			sourceFromBytes(encryptedBytes),
			PASSPHRASE
		);
		const decryptedBytes = await readAll(decrypted);
		expect(new TextDecoder().decode(decryptedBytes)).toBe(
			"hello, stryveforms backup"
		);
	});

	test("round-trips content spanning multiple chunks", async () => {
		// DEFAULT_CHUNK_SIZE is 4 MiB — force at least 3 chunks.
		const plaintext = new Uint8Array(10 * 1024 * 1024);
		for (let i = 0; i < plaintext.length; i += 1) {
			plaintext[i] = i % 256;
		}
		const encrypted = encryptStream(sourceFromBytes(plaintext), PASSPHRASE);
		const encryptedBytes = await readAll(encrypted);
		const decrypted = decryptStream(
			sourceFromBytes(encryptedBytes),
			PASSPHRASE
		);
		const decryptedBytes = await readAll(decrypted);
		expect(decryptedBytes).toEqual(plaintext);
	});

	test("round-trips a source delivered as many small chunks", async () => {
		const chunks = Array.from({ length: 50 }, (_, i) =>
			new TextEncoder().encode(`chunk-${i}-`)
		);
		// biome-ignore lint/suspicious/useAwait: must stay an async generator — readableFromAsyncGenerator takes an AsyncGenerator<T>
		async function* generate() {
			for (const chunk of chunks) {
				yield chunk;
			}
		}
		const source = readableFromAsyncGenerator(generate());
		const encrypted = encryptStream(source, PASSPHRASE);
		const encryptedBytes = await readAll(encrypted);
		const decrypted = decryptStream(
			sourceFromBytes(encryptedBytes),
			PASSPHRASE
		);
		const decryptedBytes = await readAll(decrypted);
		const expected = chunks.reduce((acc, c) => {
			const merged = new Uint8Array(acc.length + c.length);
			merged.set(acc, 0);
			merged.set(c, acc.length);
			return merged;
		}, new Uint8Array(0));
		expect(decryptedBytes).toEqual(expected);
	});

	test("throws WrongPassphraseError on a wrong passphrase", async () => {
		const encrypted = encryptStream(
			sourceFromBytes(new TextEncoder().encode("secret stuff")),
			PASSPHRASE
		);
		const encryptedBytes = await readAll(encrypted);
		const decrypted = decryptStream(
			sourceFromBytes(encryptedBytes),
			"totally-wrong-passphrase-99"
		);
		await expect(readAll(decrypted)).rejects.toBeInstanceOf(
			WrongPassphraseError
		);
	});

	test("throws WrongPassphraseError when the magic header doesn't match", async () => {
		const decrypted = decryptStream(
			sourceFromBytes(
				new TextEncoder().encode(
					"not a stryve-backup file at all, but still long enough to hold a full header (53+ bytes)!!"
				)
			),
			PASSPHRASE
		);
		await expect(readAll(decrypted)).rejects.toBeInstanceOf(
			WrongPassphraseError
		);
	});

	test("throws TruncatedContainerError when the stream is cut off", async () => {
		const encrypted = encryptStream(
			sourceFromBytes(new TextEncoder().encode("some content to encrypt")),
			PASSPHRASE
		);
		const fullBytes = await readAll(encrypted);
		// Cut off well before the final-chunk marker, but after the header.
		const truncated = fullBytes.slice(0, fullBytes.length - 5);
		const decrypted = decryptStream(sourceFromBytes(truncated), PASSPHRASE);
		await expect(readAll(decrypted)).rejects.toBeInstanceOf(
			TruncatedContainerError
		);
	});

	test("throws TruncatedContainerError when the stream ends right after the header", async () => {
		const encrypted = encryptStream(
			sourceFromBytes(new Uint8Array(0)),
			PASSPHRASE
		);
		const fullBytes = await readAll(encrypted);
		// Header is 53 bytes; cut everything after it off.
		const headerOnly = fullBytes.slice(0, 53);
		const decrypted = decryptStream(sourceFromBytes(headerOnly), PASSPHRASE);
		await expect(readAll(decrypted)).rejects.toBeInstanceOf(
			TruncatedContainerError
		);
	});
});
