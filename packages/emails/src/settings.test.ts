import { describe, expect, test } from "bun:test";

import {
	emailSettingsSchema,
	emailSocialLinksInputSchema,
	normalizeSocialUrl,
	resolveEmailSettings,
} from "./settings";

describe("normalizeSocialUrl", () => {
	test("adds https:// to a bare domain", () => {
		expect(normalizeSocialUrl("facebook.com/acme")).toBe(
			"https://facebook.com/acme"
		);
	});

	test("leaves an already-schemed URL alone", () => {
		expect(normalizeSocialUrl("https://x.com/acme")).toBe("https://x.com/acme");
	});

	test("turns a bare email into mailto:", () => {
		expect(normalizeSocialUrl("hello@acme.com")).toBe("mailto:hello@acme.com");
	});

	test("passes through blank input", () => {
		expect(normalizeSocialUrl("   ")).toBe("");
	});
});

describe("emailSocialLinksInputSchema", () => {
	test("drops a row the user never filled in, instead of failing validation", () => {
		// This exact shape (both fields blank) is what the admin UI adds for "Add link".
		const result = emailSocialLinksInputSchema.parse([{ label: "", url: "" }]);
		expect(result).toEqual([]);
	});

	test("drops a blank row but keeps a filled one, auto-detecting the network", () => {
		const result = emailSocialLinksInputSchema.parse([
			{ label: "", url: "" },
			{ url: "facebook.com/acme" },
		]);
		expect(result).toEqual([
			{
				label: "Facebook",
				network: "facebook",
				url: "https://facebook.com/acme",
			},
		]);
	});

	test("keeps an explicit network override over auto-detection", () => {
		const result = emailSocialLinksInputSchema.parse([
			{ label: "My site", network: "website", url: "facebook.com/not-really" },
		]);
		expect(result[0]).toEqual({
			label: "My site",
			network: "website",
			url: "https://facebook.com/not-really",
		});
	});

	test("rejects a row with a genuinely malformed URL instead of silently dropping it", () => {
		// "not a url at all???" normalises to "https://not a url at all???", which
		// is not a parseable URL (contains spaces) — a real typo should surface,
		// unlike a row the user simply never filled in.
		expect(() =>
			emailSocialLinksInputSchema.parse([{ url: "not a url at all???" }])
		).toThrow();
	});
});

describe("emailSettingsSchema", () => {
	test("accepts a draft with an empty social link row (the reported bug)", () => {
		const parsed = emailSettingsSchema.parse({
			socialLinks: [{ label: "", url: "" }],
		});
		expect(parsed.socialLinks).toEqual([]);
	});

	test("normalises every link's URL and fills in network/label", () => {
		const parsed = emailSettingsSchema.parse({
			socialLinks: [
				{ url: "youtube.com/@acme" },
				{ label: "", url: "hello@acme.com" },
			],
		});
		expect(parsed.socialLinks).toEqual([
			{
				label: "YouTube",
				network: "youtube",
				url: "https://youtube.com/@acme",
			},
			{ label: "Email", network: "email", url: "mailto:hello@acme.com" },
		]);
	});
});

describe("resolveEmailSettings", () => {
	test("fills in dark-mode and social defaults", () => {
		const resolved = resolveEmailSettings();
		expect(resolved.emailDarkMode).toBe("auto");
		expect(resolved.darkBackgroundColor).toBeNull();
		expect(resolved.socialDisplay).toBe("icon-label");
		expect(resolved.socialIconStyle).toBe("brand");
	});
});
