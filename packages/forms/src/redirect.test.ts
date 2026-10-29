import { describe, expect, test } from "bun:test";

import { mentionHtml } from "./mentions";
import {
	buildRedirectUrl,
	exampleFieldValue,
	fieldParamValue,
	paramFieldId,
	parseRedirectUrl,
	resolveRedirectUrl,
} from "./redirect";

const nameField = { id: "name", name: "Name" };
const emailField = { id: "email", name: "Email" };

describe("parseRedirectUrl / buildRedirectUrl", () => {
	test("round-trips a plain URL with no params", () => {
		const config = parseRedirectUrl("https://example.com/thanks");
		expect(config).toEqual({
			baseUrl: "https://example.com/thanks",
			params: [],
		});
		expect(buildRedirectUrl(config)).toBe("https://example.com/thanks");
	});

	test("splits base URL and mention-valued params", () => {
		const raw = `https://example.com/thanks?name=${mentionHtml(nameField)}&email=${mentionHtml(emailField)}`;
		const config = parseRedirectUrl(raw);
		expect(config.baseUrl).toBe("https://example.com/thanks");
		expect(config.params).toHaveLength(2);
		expect(config.params[0]?.name).toBe("name");
		expect(config.params[1]?.name).toBe("email");
		expect(buildRedirectUrl(config)).toBe(raw);
	});

	test("never splits on '?' or '&' inside a mention span's attributes", () => {
		// A mention fallback can legitimately contain "&" or "?"; it must stay intact.
		const raw = `https://example.com?q=${mentionHtml(nameField, "a&b?c")}`;
		const config = parseRedirectUrl(raw);
		expect(config.params).toHaveLength(1);
		expect(config.params[0]?.value).toContain("a&amp;b?c");
	});

	test("empty input parses to an empty config", () => {
		expect(parseRedirectUrl(null)).toEqual({ baseUrl: "", params: [] });
		expect(parseRedirectUrl("")).toEqual({ baseUrl: "", params: [] });
	});

	test("buildRedirectUrl keeps a blank-named row (e.g. one just added, not yet named)", () => {
		// resolveRedirectUrl is what drops nameless params from the final URL;
		// the editable config round-trips everything so a fresh row survives
		// long enough for the user to name it.
		const url = buildRedirectUrl({
			baseUrl: "https://example.com",
			params: [
				{ name: "", value: "x" },
				{ name: "ok", value: "y" },
			],
		});
		expect(url).toBe("https://example.com?=x&ok=y");
		expect(parseRedirectUrl(url).params).toEqual([
			{ name: "", value: "x" },
			{ name: "ok", value: "y" },
		]);
	});
});

describe("fieldParamValue / paramFieldId", () => {
	test("a field-picker value round-trips to the same field id", () => {
		const value = fieldParamValue(nameField);
		expect(paramFieldId(value)).toBe("name");
	});

	test("literal text is not a field reference", () => {
		expect(paramFieldId("hello")).toBeNull();
		expect(paramFieldId("")).toBeNull();
	});

	test("a mention mixed with literal text is not a clean field reference", () => {
		expect(paramFieldId(`prefix-${mentionHtml(nameField)}`)).toBeNull();
	});
});

describe("resolveRedirectUrl", () => {
	test("resolves and URL-encodes answers into query params", () => {
		const raw = `https://example.com/thanks?name=${mentionHtml(nameField)}&email=${mentionHtml(emailField)}`;
		const url = resolveRedirectUrl(raw, {
			name: "Ada",
			email: "ada@x.com",
		});
		expect(url).toBe("https://example.com/thanks?name=Ada&email=ada%40x.com");
	});

	test("drops empty params by default", () => {
		const raw = `https://example.com?name=${mentionHtml(nameField)}&email=${mentionHtml(emailField)}`;
		const url = resolveRedirectUrl(raw, { name: "Ada", email: "" });
		expect(url).toBe("https://example.com/?name=Ada");
	});

	test("keeps empty params when dropEmptyParams is false", () => {
		const raw = `https://example.com?name=${mentionHtml(nameField)}`;
		const url = resolveRedirectUrl(
			raw,
			{ name: "" },
			{ dropEmptyParams: false }
		);
		expect(url).toBe("https://example.com/?name=");
	});

	test("resolves computed variables the same way as field answers", () => {
		const scoreField = { id: "cv_score", name: "Score" };
		const raw = `https://example.com?score=${mentionHtml(scoreField)}`;
		const url = resolveRedirectUrl(raw, {}, { computed: { cv_score: 97 } });
		expect(url).toBe("https://example.com/?score=97");
	});

	test("rejects a non-http(s) result", () => {
		const url = resolveRedirectUrl("javascript:alert(1)", {});
		expect(url).toBeNull();
	});

	test("returns null for an empty redirect", () => {
		expect(resolveRedirectUrl(null, {})).toBeNull();
		expect(resolveRedirectUrl("   ", {})).toBeNull();
	});

	test("supports hidden-field and multi-value answers via the format hook", () => {
		const tagsField = { id: "tags", name: "Tags" };
		const raw = `https://example.com?tags=${mentionHtml(tagsField)}`;
		const url = resolveRedirectUrl(raw, { tags: ["a", "b"] });
		expect(url).toBe("https://example.com/?tags=a,+b");
	});
});

describe("exampleFieldValue", () => {
	test("gives a plausible example per field type", () => {
		expect(exampleFieldValue({ name: "Email", type: "email" })).toBe(
			"ada@example.com"
		);
		expect(exampleFieldValue({ name: "Custom", type: "nf-text" })).toBe(
			"Custom"
		);
	});
});
