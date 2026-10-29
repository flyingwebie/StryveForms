/**
 * Thin streaming bridge between fflate's callback-based ZIP streams and the
 * `ArchiveSink`/`ArchiveSource` abstraction in streams.ts. Internal to
 * services/backup — not part of CONTRACT.md.
 *
 * Every entry is stored (not deflated): simpler and safe for a format whose
 * own data (submissions, uploaded files) is already often incompressible,
 * and it keeps the writer/reader symmetric and easy to reason about.
 */
import { Unzip, UnzipPassThrough, Zip, ZipPassThrough } from "fflate";

import type { ArchiveSink, ArchiveSource } from "./streams";

const JSONL_FLUSH_BYTES = 256 * 1024;
const encoder = new TextEncoder();

/** Builds a ZIP by streaming each entry straight into an `ArchiveSink`. */
export class ZipBuilder {
	private readonly pending: Uint8Array[] = [];
	private failure: unknown = null;
	private readonly sink: ArchiveSink;
	private readonly zip: Zip;

	constructor(sink: ArchiveSink) {
		this.sink = sink;
		this.zip = new Zip((error, chunk) => {
			if (error) {
				this.failure = error;
				return;
			}
			this.pending.push(chunk);
		});
	}

	private async drain() {
		if (this.failure) {
			throw this.failure;
		}
		while (this.pending.length > 0) {
			const chunk = this.pending.shift();
			if (chunk) {
				// biome-ignore lint/performance/noAwaitInLoops: entries must reach the sink in order
				await this.sink.write(chunk);
			}
		}
	}

	async addBytes(name: string, bytes: Uint8Array): Promise<void> {
		const entry = new ZipPassThrough(name);
		this.zip.add(entry);
		entry.push(bytes, true);
		await this.drain();
	}

	/** Streams an `ArchiveSource` (e.g. a stored file) into one ZIP entry. */
	async addStream(name: string, source: ArchiveSource): Promise<void> {
		const entry = new ZipPassThrough(name);
		this.zip.add(entry);
		const reader = source.getReader();
		let held: Uint8Array | null = null;
		for (;;) {
			// biome-ignore lint/performance/noAwaitInLoops: the source must be drained in order
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			if (held) {
				entry.push(held, false);
				await this.drain();
			}
			held = value;
		}
		entry.push(held ?? new Uint8Array(0), true);
		await this.drain();
	}

	/** Streams one JSON value per line (NDJSON) into one ZIP entry. */
	async addJsonl(
		name: string,
		rows: AsyncIterable<unknown> | Iterable<unknown>
	): Promise<void> {
		const entry = new ZipPassThrough(name);
		this.zip.add(entry);
		let buffered = "";
		for await (const row of rows) {
			buffered += `${JSON.stringify(row)}\n`;
			if (buffered.length >= JSONL_FLUSH_BYTES) {
				entry.push(encoder.encode(buffered), false);
				buffered = "";
				await this.drain();
			}
		}
		entry.push(encoder.encode(buffered), true);
		await this.drain();
	}

	/** Must be called once, after every entry has been added. */
	async finish(): Promise<void> {
		this.zip.end();
		await this.drain();
	}
}

export interface ZipEntry {
	name: string;
	stream: ArchiveSource;
}

/**
 * Streams entries out of a ZIP (as written by `ZipBuilder`) in the order
 * they appear in the archive, without buffering the whole file. Each
 * entry's `stream` must be fully read (or explicitly cancelled) before
 * moving on to the next one, since the same underlying read loop feeds
 * whichever entry is current.
 */
export function readZipEntries(
	source: ArchiveSource
): AsyncGenerator<ZipEntry> {
	const queued: ZipEntry[] = [];
	let waiting: (() => void) | null = null;
	let finished = false;
	let failure: unknown = null;

	const wake = () => {
		if (waiting) {
			const resolve = waiting;
			waiting = null;
			resolve();
		}
	};

	const unzip = new Unzip((file) => {
		let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
		const stream = new ReadableStream<Uint8Array>({
			start(c) {
				controller = c;
			},
		});
		// `ondata` must be set before `start()` — fflate's UnzipFile.start()
		// synchronously checks it's already set and throws (error code 5,
		// "no stream handler") otherwise.
		file.ondata = (error, chunk, final) => {
			if (error) {
				controller?.error(error);
				return;
			}
			if (chunk.length > 0) {
				controller?.enqueue(chunk);
			}
			if (final) {
				controller?.close();
			}
		};
		file.start();
		queued.push({ name: file.name, stream });
		wake();
	});
	unzip.register(UnzipPassThrough);

	const pumping = (async () => {
		const reader = source.getReader();
		try {
			for (;;) {
				// biome-ignore lint/performance/noAwaitInLoops: the zip's own bytes must arrive in order
				const { done, value } = await reader.read();
				if (done) {
					unzip.push(new Uint8Array(0), true);
					break;
				}
				unzip.push(value, false);
			}
		} catch (error) {
			failure = error;
		} finally {
			finished = true;
			wake();
		}
	})();

	return (async function* generate() {
		for (;;) {
			const next = queued.shift();
			if (next) {
				yield next;
				continue;
			}
			if (finished) {
				// biome-ignore lint/performance/noAwaitInLoops: settles once, right before the generator returns
				await pumping;
				if (failure) {
					throw failure;
				}
				return;
			}
			await new Promise<void>((resolve) => {
				waiting = resolve;
			});
		}
	})();
}

/** Reads a whole entry's `stream` into memory (manifest.json, secrets.enc — always small). */
export async function readEntryBytes(entry: ZipEntry): Promise<Uint8Array> {
	const reader = entry.stream.getReader();
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

/** Reads a `data/<entity>.jsonl` entry one parsed row at a time (never buffers the whole file). */
export async function* readJsonlEntry(
	entry: ZipEntry
): AsyncGenerator<unknown> {
	const reader = entry.stream.getReader();
	const decoder = new TextDecoder();
	let buffered = "";
	for (;;) {
		// biome-ignore lint/performance/noAwaitInLoops: a stream must be drained in order
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		buffered += decoder.decode(value, { stream: true });
		let newlineIndex = buffered.indexOf("\n");
		while (newlineIndex >= 0) {
			const line = buffered.slice(0, newlineIndex);
			buffered = buffered.slice(newlineIndex + 1);
			if (line.trim().length > 0) {
				yield JSON.parse(line);
			}
			newlineIndex = buffered.indexOf("\n");
		}
	}
	if (buffered.trim().length > 0) {
		yield JSON.parse(buffered);
	}
}
