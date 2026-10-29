import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readJsonFile } from "../json-file";

const READ_ERROR = /Couldn't read/;
const PARSE_ERROR = /Couldn't parse/;

describe("readJsonFile", () => {
	test("parses a valid JSON file", () => {
		const dir = mkdtempSync(join(tmpdir(), "stryveforms-cli-json-test-"));
		const file = join(dir, "spec.json");
		writeFileSync(file, JSON.stringify({ data: { webhook_url: "https://x" } }));
		expect(readJsonFile(file)).toEqual({ data: { webhook_url: "https://x" } });
		rmSync(dir, { force: true, recursive: true });
	});

	test("throws a readable error for a missing file", () => {
		expect(() => readJsonFile("/nonexistent/path/spec.json")).toThrow(
			READ_ERROR
		);
	});

	test("throws a readable error for invalid JSON", () => {
		const dir = mkdtempSync(join(tmpdir(), "stryveforms-cli-json-test-"));
		const file = join(dir, "bad.json");
		writeFileSync(file, "{not valid json");
		expect(() => readJsonFile(file)).toThrow(PARSE_ERROR);
		rmSync(dir, { force: true, recursive: true });
	});
});
