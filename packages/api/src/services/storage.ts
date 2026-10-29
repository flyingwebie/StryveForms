import { mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";

export interface StorageDriver {
	delete: (key: string) => Promise<void>;
	exists: (key: string) => Promise<boolean>;
	get: (key: string) => Promise<Blob | null>;
	/** Reads a key as a stream — for a backup/export archive, which may be too large to buffer. Null if missing. */
	getStream: (key: string) => Promise<ReadableStream<Uint8Array> | null>;
	/** Keys under a prefix (e.g. "exports/", "tmp/backups/"), relative to the storage root. */
	list: (prefix: string) => Promise<string[]>;
	put: (
		key: string,
		body: Blob | ArrayBuffer | Uint8Array | string,
		contentType?: string
	) => Promise<void>;
	/** Writes a key from a stream, without buffering the whole thing in memory. */
	putStream: (
		key: string,
		body: ReadableStream<Uint8Array>,
		contentType?: string
	) => Promise<void>;
	/** Byte size of a key, or null when it doesn't exist. */
	size: (key: string) => Promise<number | null>;
}

export interface StorageConfig {
	S3_ACCESS_KEY_ID?: string | undefined;
	S3_BUCKET?: string | undefined;
	S3_ENDPOINT?: string | undefined;
	S3_REGION?: string | undefined;
	S3_SECRET_ACCESS_KEY?: string | undefined;
	STORAGE_DRIVER: "local" | "s3";
	STORAGE_PATH?: string | undefined;
}

const LEADING_SLASHES = /^[/\\]+/;
const UNSAFE_KEY = /(^|[\\/])\.\.([\\/]|$)/;

/** Rejects keys that could escape the storage root. */
export function assertSafeKey(key: string): string {
	const clean = normalize(key).replace(LEADING_SLASHES, "");
	if (clean.length === 0 || UNSAFE_KEY.test(clean)) {
		throw new Error(`Invalid storage key: ${key}`);
	}
	return clean;
}

/** Drains a ReadableStream into a sink that exposes a Bun FileSink-shaped `write`/`end`. */
async function pipeToSink(
	body: ReadableStream<Uint8Array>,
	sink: {
		end: (error?: Error) => unknown;
		write: (chunk: Uint8Array) => unknown;
	}
) {
	const reader = body.getReader();
	try {
		for (;;) {
			// biome-ignore lint/performance/noAwaitInLoops: backpressure must be respected chunk by chunk
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			await sink.write(value);
		}
		await sink.end();
	} catch (error) {
		await sink.end(error instanceof Error ? error : new Error(String(error)));
		throw error;
	}
}

class LocalStorage implements StorageDriver {
	private readonly root: string;

	constructor(root: string) {
		this.root = resolve(root);
	}

	private path(key: string) {
		const full = join(this.root, assertSafeKey(key));
		if (!full.startsWith(this.root)) {
			throw new Error(`Invalid storage key: ${key}`);
		}
		return full;
	}

	/** Like `path`, but accepts an empty/root prefix (used only by `list`). */
	private dirFor(prefix: string) {
		const dir = prefix ? this.path(prefix) : this.root;
		if (!dir.startsWith(this.root)) {
			throw new Error(`Invalid storage prefix: ${prefix}`);
		}
		return dir;
	}

	private async walk(dir: string): Promise<string[]> {
		let entries: import("node:fs").Dirent[];
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return [];
			}
			throw error;
		}
		const files: string[] = [];
		for (const entry of entries) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				// biome-ignore lint/performance/noAwaitInLoops: directories are walked one at a time to keep memory bounded
				files.push(...(await this.walk(full)));
			} else if (entry.isFile()) {
				files.push(full);
			}
		}
		return files;
	}

	async put(key: string, body: Blob | ArrayBuffer | Uint8Array | string) {
		const target = this.path(key);
		await mkdir(dirname(target), { recursive: true });
		await Bun.write(target, body);
	}

	async get(key: string) {
		const file = Bun.file(this.path(key));
		return (await file.exists()) ? file : null;
	}

	async getStream(key: string) {
		const file = Bun.file(this.path(key));
		return (await file.exists()) ? file.stream() : null;
	}

	async putStream(key: string, body: ReadableStream<Uint8Array>) {
		const target = this.path(key);
		await mkdir(dirname(target), { recursive: true });
		await pipeToSink(body, Bun.file(target).writer());
	}

	async delete(key: string) {
		await rm(this.path(key), { force: true });
	}

	exists(key: string) {
		return Bun.file(this.path(key)).exists();
	}

	async list(prefix: string) {
		const dir = this.dirFor(prefix);
		const files = await this.walk(dir);
		return files.map((f) => relative(this.root, f).split(sep).join("/")).sort();
	}

	async size(key: string) {
		const file = Bun.file(this.path(key));
		return (await file.exists()) ? file.size : null;
	}
}

class S3Storage implements StorageDriver {
	private readonly client: Bun.S3Client;

	constructor(config: StorageConfig) {
		this.client = new Bun.S3Client({
			bucket: config.S3_BUCKET,
			region: config.S3_REGION,
			endpoint: config.S3_ENDPOINT,
			accessKeyId: config.S3_ACCESS_KEY_ID,
			secretAccessKey: config.S3_SECRET_ACCESS_KEY,
		});
	}

	async put(
		key: string,
		body: Blob | ArrayBuffer | Uint8Array | string,
		contentType?: string
	) {
		await this.client.write(
			assertSafeKey(key),
			body,
			contentType ? { type: contentType } : {}
		);
	}

	async get(key: string) {
		const file = this.client.file(assertSafeKey(key));
		if (!(await file.exists())) {
			return null;
		}
		return new Blob([await file.arrayBuffer()], { type: file.type });
	}

	async getStream(key: string) {
		const file = this.client.file(assertSafeKey(key));
		if (!(await file.exists())) {
			return null;
		}
		return file.stream();
	}

	async putStream(
		key: string,
		body: ReadableStream<Uint8Array>,
		contentType?: string
	) {
		const sink = this.client
			.file(assertSafeKey(key))
			.writer(contentType ? { type: contentType } : {});
		await pipeToSink(body, sink);
	}

	async delete(key: string) {
		await this.client.delete(assertSafeKey(key));
	}

	exists(key: string) {
		return this.client.exists(assertSafeKey(key));
	}

	async list(prefix: string) {
		const keys: string[] = [];
		let continuationToken: string | undefined;
		do {
			// biome-ignore lint/performance/noAwaitInLoops: each page depends on the previous continuation token
			const response = await this.client.list({
				continuationToken,
				prefix: prefix ? assertSafeKey(prefix) : undefined,
			});
			for (const obj of response.contents ?? []) {
				if (obj.key) {
					keys.push(obj.key);
				}
			}
			continuationToken = response.isTruncated
				? response.nextContinuationToken
				: undefined;
		} while (continuationToken);
		return keys;
	}

	async size(key: string) {
		try {
			const stat = await this.client.stat(assertSafeKey(key));
			return stat.size;
		} catch {
			return null;
		}
	}
}

export function createStorage(config: StorageConfig): StorageDriver {
	if (config.STORAGE_DRIVER === "s3") {
		if (!config.S3_BUCKET) {
			throw new Error("S3_BUCKET is required when STORAGE_DRIVER=s3");
		}
		return new S3Storage(config);
	}
	return new LocalStorage(config.STORAGE_PATH ?? "./storage");
}
