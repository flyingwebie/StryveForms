import { describe, expect, test } from "bun:test";

import type { AppConfig } from "../../context";
import { fileNameOf, toLibraryImage } from "./library";

const CONFIG: AppConfig = {
	appName: "StryveForms",
	appUrl: "https://forms.example.com",
	captcha: {},
	importRateLimitPerMinute: 60,
	serverUrl: "https://api.example.com",
	signingSecret: "test-signing-secret-xxxxxxxxxxxx",
};

describe("fileNameOf", () => {
	test("strips the assets/ storage-key prefix", () => {
		expect(fileNameOf("assets/cover_abc123.png")).toBe("cover_abc123.png");
	});

	test("leaves a key without the prefix unchanged", () => {
		expect(fileNameOf("cover_abc123.png")).toBe("cover_abc123.png");
	});
});

describe("toLibraryImage", () => {
	test("maps a stored_file row to a public asset URL", () => {
		const createdAt = new Date("2026-01-01T00:00:00Z");
		expect(
			toLibraryImage(
				{
					createdAt,
					id: "file_1",
					key: "assets/cover_abc123.png",
					originalName: "cover.png",
				},
				CONFIG
			)
		).toEqual({
			createdAt,
			id: "file_1",
			name: "cover.png",
			url: "https://api.example.com/api/assets/cover_abc123.png",
		});
	});
});
