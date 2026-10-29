import { describe, expect, test } from "bun:test";

import { canonicalFileName, submissionFileUrl } from "../lib/files";
import { formSlug, slugify } from "../lib/ids";
import { signPath, verifySignedPath } from "../lib/signing";
import { integrationConditions } from "../services/integrations/dispatch";
import {
	assertPublicUrl,
	isPrivateAddress,
} from "../services/integrations/ssrf";
import { sanitizeRichText } from "../services/sanitize";
import { assertSafeKey } from "../services/storage";

const SECRET = "test-secret-test-secret-test-secret";
const CANONICAL = /^My_report_[0-9a-f-]{36}\.pdf$/;
const SLUG = /^contact-us-[a-z0-9]{6}$/;

describe("signed file links", () => {
	test("valid until they expire and only for the signed path", () => {
		const signed = signPath(SECRET, "/api/files/f1/a.pdf", 60);
		const url = new URL(`http://x${signed}`);
		const expires = url.searchParams.get("expires") ?? undefined;
		const signature = url.searchParams.get("signature") ?? undefined;
		expect(
			verifySignedPath(SECRET, "/api/files/f1/a.pdf", expires, signature)
		).toBe(true);
		expect(
			verifySignedPath(SECRET, "/api/files/f1/b.pdf", expires, signature)
		).toBe(false);
		expect(
			verifySignedPath(
				"other-secret",
				"/api/files/f1/a.pdf",
				expires,
				signature
			)
		).toBe(false);
		expect(
			verifySignedPath(SECRET, "/api/files/f1/a.pdf", "1", signature)
		).toBe(false);
	});

	test("submission file URLs point at the API server", () => {
		const url = submissionFileUrl(
			{
				appName: "x",
				appUrl: "http://app",
				captcha: {},
				importRateLimitPerMinute: 60,
				serverUrl: "http://api",
				signingSecret: SECRET,
			},
			"f1",
			"cv.pdf"
		);
		expect(url.startsWith("http://api/api/files/f1/cv.pdf?expires=")).toBe(
			true
		);
	});
});

describe("names", () => {
	test("canonical file names keep the extension and add a uuid", () => {
		expect(canonicalFileName("My report.pdf")).toMatch(CANONICAL);
		expect(canonicalFileName("../../etc/passwd")).not.toContain("/");
	});

	test("slugs", () => {
		expect(slugify("Crème brûlée & co!")).toBe("creme-brulee-co");
		expect(formSlug("Contact us")).toMatch(SLUG);
	});

	test("storage keys can't escape the storage folder", () => {
		expect(() => assertSafeKey("../secret")).toThrow();
		expect(() => assertSafeKey("forms/../../secret")).toThrow();
		expect(assertSafeKey("/forms/a/b.png")).toBe("forms/a/b.png");
	});
});

describe("webhook safety", () => {
	test("private addresses are detected", () => {
		for (const ip of [
			"127.0.0.1",
			"10.1.2.3",
			"192.168.0.1",
			"172.16.5.4",
			"169.254.169.254",
			"::1",
			"fd00::1",
		]) {
			expect(isPrivateAddress(ip)).toBe(true);
		}
		expect(isPrivateAddress("8.8.8.8")).toBe(false);
	});

	test("private and malformed URLs are rejected", async () => {
		await expect(assertPublicUrl("http://127.0.0.1/hook")).rejects.toThrow();
		await expect(
			assertPublicUrl("http://localhost:3000/hook")
		).rejects.toThrow();
		await expect(assertPublicUrl("ftp://example.com")).rejects.toThrow();
		await expect(
			assertPublicUrl("https://user:pass@example.com")
		).rejects.toThrow();
		await expect(
			assertPublicUrl("https://93.184.215.14/hook")
		).resolves.toBeInstanceOf(URL);
	});
});

describe("sanitizer", () => {
	test("keeps formatting and mentions, removes scripts", () => {
		const html = sanitizeRichText(
			'<p onclick="x()">Hi <b>there</b><script>alert(1)</script> <span mention="true" mention-field-id="a" mention-field-name="A" mention-fallback="" contenteditable="false">A</span><a href="javascript:alert(1)">x</a></p>'
		);
		expect(html).not.toContain("script");
		expect(html).not.toContain("onclick");
		expect(html).not.toContain("javascript:");
		expect(html).toContain('mention-field-id="a"');
		expect(html).toContain("<b>there</b>");
	});
});

describe("integration logic", () => {
	test("accepts bare trees and {conditions} wrappers", () => {
		const tree = { children: [], operatorIdentifier: "and" as const };
		expect(integrationConditions(tree)).toEqual(tree);
		expect(integrationConditions({ conditions: tree })).toEqual(tree);
		expect(integrationConditions({ conditions: null })).toBeNull();
		expect(integrationConditions(null)).toBeNull();
	});
});
