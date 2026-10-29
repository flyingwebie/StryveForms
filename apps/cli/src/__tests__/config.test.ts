import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	clearConfig,
	readConfig,
	resolveToken,
	resolveUrl,
	writeConfig,
} from "../config";

let tempDir: string;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), "stryveforms-cli-test-"));
	process.env.STRYVEFORMS_CONFIG_DIR = tempDir;
	delete process.env.STRYVEFORMS_URL;
	delete process.env.STRYVEFORMS_TOKEN;
});

afterEach(() => {
	delete process.env.STRYVEFORMS_CONFIG_DIR;
	delete process.env.STRYVEFORMS_URL;
	delete process.env.STRYVEFORMS_TOKEN;
	rmSync(tempDir, { force: true, recursive: true });
});

describe("resolveUrl", () => {
	test("falls back to localhost when nothing is set", () => {
		expect(resolveUrl()).toBe("http://localhost:3000");
	});

	test("strips a trailing slash", () => {
		expect(resolveUrl("https://forms.example.com/")).toBe(
			"https://forms.example.com"
		);
	});

	test("the --url flag wins over STRYVEFORMS_URL", () => {
		process.env.STRYVEFORMS_URL = "https://env.example.com";
		expect(resolveUrl("https://flag.example.com")).toBe(
			"https://flag.example.com"
		);
	});

	test("STRYVEFORMS_URL wins over the saved config file", () => {
		writeConfig({ url: "https://saved.example.com" });
		process.env.STRYVEFORMS_URL = "https://env.example.com";
		expect(resolveUrl()).toBe("https://env.example.com");
	});

	test("falls back to the saved config file", () => {
		writeConfig({ url: "https://saved.example.com" });
		expect(resolveUrl()).toBe("https://saved.example.com");
	});
});

describe("resolveToken", () => {
	test("is undefined when nothing is set", () => {
		expect(resolveToken()).toBeUndefined();
	});

	test("the --token flag wins over everything", () => {
		writeConfig({ token: "sfpat_saved" });
		process.env.STRYVEFORMS_TOKEN = "sfpat_env";
		expect(resolveToken("sfpat_flag")).toBe("sfpat_flag");
	});

	test("falls back to the saved config file", () => {
		writeConfig({ token: "sfpat_saved" });
		expect(resolveToken()).toBe("sfpat_saved");
	});
});

describe("readConfig / writeConfig / clearConfig", () => {
	test("readConfig returns {} when no file exists yet", () => {
		expect(readConfig()).toEqual({});
	});

	test("writeConfig then readConfig round-trips", () => {
		writeConfig({ token: "sfpat_x", url: "https://a.example.com" });
		expect(readConfig()).toEqual({
			token: "sfpat_x",
			url: "https://a.example.com",
		});
	});

	test("clearConfig empties a previously saved login", () => {
		writeConfig({ token: "sfpat_x" });
		clearConfig();
		expect(readConfig()).toEqual({});
	});
});
