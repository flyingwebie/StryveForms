import { describe, expect, test } from "bun:test";

import { memorySink, sourceFromBytes } from "./streams";
import {
	readEntryBytes,
	readJsonlEntry,
	readZipEntries,
	ZipBuilder,
} from "./zip";

async function collectEntryNames(bytes: Uint8Array): Promise<string[]> {
	const names: string[] = [];
	for await (const entry of readZipEntries(sourceFromBytes(bytes))) {
		names.push(entry.name);
		await entry.stream.cancel().catch(() => undefined);
	}
	return names;
}

describe("ZipBuilder / readZipEntries round-trip", () => {
	test("writes and reads back a single bytes entry", async () => {
		const sink = memorySink();
		const builder = new ZipBuilder(sink);
		await builder.addBytes(
			"manifest.json",
			new TextEncoder().encode('{"a":1}')
		);
		await builder.finish();
		await sink.close();

		const entries: { bytes: Uint8Array; name: string }[] = [];
		for await (const entry of readZipEntries(sourceFromBytes(sink.bytes()))) {
			entries.push({ bytes: await readEntryBytes(entry), name: entry.name });
		}
		expect(entries).toHaveLength(1);
		expect(entries[0]?.name).toBe("manifest.json");
		expect(new TextDecoder().decode(entries[0]?.bytes)).toBe('{"a":1}');
	});

	test("writes and reads back multiple entries, in order", async () => {
		const sink = memorySink();
		const builder = new ZipBuilder(sink);
		await builder.addBytes("a.txt", new TextEncoder().encode("first"));
		await builder.addBytes("b.txt", new TextEncoder().encode("second"));
		await builder.addBytes("c.txt", new TextEncoder().encode("third"));
		await builder.finish();
		await sink.close();

		expect(await collectEntryNames(sink.bytes())).toEqual([
			"a.txt",
			"b.txt",
			"c.txt",
		]);
	});

	test("streams a large-ish entry via addStream", async () => {
		const payload = new Uint8Array(500_000);
		for (let i = 0; i < payload.length; i += 1) {
			payload[i] = i % 256;
		}
		const sink = memorySink();
		const builder = new ZipBuilder(sink);
		await builder.addStream("files/big.bin", sourceFromBytes(payload));
		await builder.finish();
		await sink.close();

		const entries: { bytes: Uint8Array; name: string }[] = [];
		for await (const entry of readZipEntries(sourceFromBytes(sink.bytes()))) {
			entries.push({ bytes: await readEntryBytes(entry), name: entry.name });
		}
		expect(entries).toHaveLength(1);
		expect(entries[0]?.bytes).toEqual(payload);
	});

	test("round-trips an empty entry", async () => {
		const sink = memorySink();
		const builder = new ZipBuilder(sink);
		await builder.addBytes("empty.txt", new Uint8Array(0));
		await builder.finish();
		await sink.close();

		const entries: Uint8Array[] = [];
		for await (const entry of readZipEntries(sourceFromBytes(sink.bytes()))) {
			entries.push(await readEntryBytes(entry));
		}
		expect(entries).toHaveLength(1);
		expect(entries[0]).toHaveLength(0);
	});

	test("addJsonl writes one JSON value per line, readJsonlEntry parses each", async () => {
		const rows = [
			{ id: 1, name: "a" },
			{ id: 2, name: "b" },
			{ id: 3, name: "c" },
		];
		const sink = memorySink();
		const builder = new ZipBuilder(sink);
		await builder.addJsonl("data/rows.jsonl", rows);
		await builder.finish();
		await sink.close();

		const parsed: unknown[] = [];
		for await (const entry of readZipEntries(sourceFromBytes(sink.bytes()))) {
			for await (const row of readJsonlEntry(entry)) {
				parsed.push(row);
			}
		}
		expect(parsed).toEqual(rows);
	});

	test("addJsonl on an empty list produces an entry with zero rows", async () => {
		const sink = memorySink();
		const builder = new ZipBuilder(sink);
		await builder.addJsonl("data/empty.jsonl", []);
		await builder.finish();
		await sink.close();

		const parsed: unknown[] = [];
		for await (const entry of readZipEntries(sourceFromBytes(sink.bytes()))) {
			for await (const row of readJsonlEntry(entry)) {
				parsed.push(row);
			}
		}
		expect(parsed).toHaveLength(0);
	});

	test("mixes bytes, stream and jsonl entries in one archive", async () => {
		const sink = memorySink();
		const builder = new ZipBuilder(sink);
		await builder.addBytes(
			"manifest.json",
			new TextEncoder().encode('{"ok":true}')
		);
		await builder.addJsonl("data/form.jsonl", [{ id: "f1" }]);
		await builder.addStream(
			"files/logo.png",
			sourceFromBytes(new Uint8Array([9, 9, 9]))
		);
		await builder.finish();
		await sink.close();

		expect(await collectEntryNames(sink.bytes())).toEqual([
			"manifest.json",
			"data/form.jsonl",
			"files/logo.png",
		]);
	});
});
