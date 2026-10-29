/**
 * The small streaming abstraction every backup writer/reader is built on
 * (see BACKUP_DESIGN.md and CONTRACT.md). An `ArchiveSink` is "somewhere to
 * write bytes without buffering the whole archive in memory" — a storage
 * key, an HTTP response, or (for R's destinations.ts) an S3-compatible
 * bucket. An `ArchiveSource` is the read side: any `ReadableStream<Uint8Array>`.
 */
import type { StorageDriver } from "../storage";

export interface ArchiveSink {
	/** Aborts the write — e.g. a job was cancelled or failed partway through. */
	abort: (reason?: unknown) => Promise<void>;
	/** Finishes the write successfully. */
	close: () => Promise<void>;
	/** Writes one chunk. Must be awaited before writing the next (no concurrent writes). */
	write: (chunk: Uint8Array) => Promise<void>;
}

/** Any readable byte stream: a storage read, an HTTP request body, a decrypted container, a re-zipped archive… */
export type ArchiveSource = ReadableStream<Uint8Array>;

/**
 * Wraps an async generator as a `ReadableStream`. Used instead of the
 * (runtime-only) `ReadableStream.from` static — some installed `@types/node`
 * / `bun-types` combinations don't declare it, and this is just as simple.
 */
export function readableFromAsyncGenerator<T>(
	gen: AsyncGenerator<T>
): ReadableStream<T> {
	return new ReadableStream<T>({
		async cancel() {
			await gen.return(undefined as never);
		},
		async pull(controller) {
			const { done, value } = await gen.next();
			if (done) {
				controller.close();
			} else {
				controller.enqueue(value);
			}
		},
	});
}

/**
 * An `ArchiveSink` that streams straight into a storage key via
 * `StorageDriver.putStream` (see services/storage.ts), without holding the
 * whole archive in memory. Internally bridges to a `ReadableStream` because
 * `putStream` takes one.
 */
export function storageSink(storage: StorageDriver, key: string): ArchiveSink {
	let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
	const stream = new ReadableStream<Uint8Array>({
		start(c) {
			controller = c;
		},
	});
	const done = storage.putStream(key, stream);
	let closed = false;
	return {
		async abort(reason?: unknown) {
			if (closed) {
				return;
			}
			closed = true;
			controller?.error(reason ?? new Error("Archive write aborted"));
			await done.catch(() => undefined);
		},
		async close() {
			if (closed) {
				return;
			}
			closed = true;
			controller?.close();
			await done;
		},
		write(chunk: Uint8Array) {
			if (closed) {
				throw new Error("Cannot write to a closed ArchiveSink");
			}
			controller?.enqueue(chunk);
			return Promise.resolve();
		},
	};
}

/** Reads a storage key as a stream. Throws if the key doesn't exist. */
export async function storageSource(
	storage: StorageDriver,
	key: string
): Promise<ArchiveSource> {
	const stream = await storage.getStream(key);
	if (!stream) {
		throw new Error(`Not found in storage: ${key}`);
	}
	return stream;
}

/** Collects a (small, e.g. a manifest preview) stream fully into memory. */
export async function readAll(source: ArchiveSource): Promise<Uint8Array> {
	const reader = source.getReader();
	const chunks: Uint8Array[] = [];
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

/** Wraps a single in-memory buffer as an `ArchiveSource` (tests, small previews). */
export function sourceFromBytes(bytes: Uint8Array): ArchiveSource {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(bytes);
			controller.close();
		},
	});
}

/** Collects everything written to an in-memory `ArchiveSink` (tests). */
export function memorySink(): ArchiveSink & { bytes: () => Uint8Array } {
	const chunks: Uint8Array[] = [];
	let closed = false;
	return {
		abort() {
			closed = true;
			return Promise.resolve();
		},
		bytes() {
			let total = 0;
			for (const c of chunks) {
				total += c.length;
			}
			const out = new Uint8Array(total);
			let offset = 0;
			for (const c of chunks) {
				out.set(c, offset);
				offset += c.length;
			}
			return out;
		},
		close() {
			closed = true;
			return Promise.resolve();
		},
		write(chunk: Uint8Array) {
			if (closed) {
				throw new Error("Cannot write to a closed ArchiveSink");
			}
			chunks.push(chunk);
			return Promise.resolve();
		},
	};
}
