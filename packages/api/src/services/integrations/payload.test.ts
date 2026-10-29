import type { FormField } from "@StryveForms/forms/types";
import { describe, expect, test } from "bun:test";

import type { AppConfig } from "../../context";
import type { FormRow } from "../../lib/serialize";
import type { SubmissionRow } from "./payload";
import { webhookPayload } from "./payload";

const CONFIG: AppConfig = {
	appName: "StryveForms",
	appUrl: "https://forms.example.com",
	captcha: {},
	importRateLimitPerMinute: 60,
	serverUrl: "https://api.example.com",
	signingSecret: "test-signing-secret-xxxxxxxxxxxx",
};

const FIELDS: FormField[] = [
	{ id: "name", name: "Name", type: "text" },
	{ id: "email", name: "Email", type: "email" },
];

function buildForm(overrides: Partial<FormRow> = {}): FormRow {
	return {
		color: "#111827",
		computedVariables: [],
		customDomain: null,
		editableSubmissions: false,
		id: "form-1",
		properties: FIELDS,
		removedProperties: [],
		slug: "contact-us",
		title: "Contact us",
		...overrides,
	} as unknown as FormRow;
}

function buildSubmission(data: Record<string, unknown>): SubmissionRow {
	const now = new Date("2026-01-01T00:00:00Z");
	return {
		completionTime: null,
		createdAt: now,
		data,
		formId: "form-1",
		id: "sub-1",
		legacyOpnformId: null,
		meta: {},
		publicId: "pub-1",
		status: "completed",
		updatedAt: now,
	};
}

describe("webhookPayload", () => {
	const submission = buildSubmission({ email: "ada@example.com", name: "Ada" });

	test("classic style includes the deprecated flat submission map, keyed by field name", () => {
		const payload = webhookPayload(buildForm(), submission, CONFIG, {
			legacy: true,
		});
		expect(payload.submission).toEqual({
			Email: "ada@example.com",
			Name: "Ada",
		});
		expect(payload.message).toContain("deprecated");
	});

	test("nested style has no deprecated submission map, and data carries name/type/value", () => {
		const payload = webhookPayload(buildForm(), submission, CONFIG, {
			legacy: false,
		});
		expect(payload.submission).toBeUndefined();
		expect(payload.data).toEqual({
			email: { name: "Email", type: "email", value: "ada@example.com" },
			name: { name: "Name", type: "text", value: "Ada" },
		});
	});

	test("flat style has a plain field id -> value map", () => {
		const payload = webhookPayload(buildForm(), submission, CONFIG, {
			flat: true,
			legacy: false,
		});
		expect(payload.data).toEqual({ email: "ada@example.com", name: "Ada" });
	});

	test("marks a test send", () => {
		const payload = webhookPayload(buildForm(), submission, CONFIG, {
			test: true,
		});
		expect(payload.test).toBe(true);
	});

	test("omits the test flag by default", () => {
		const payload = webhookPayload(buildForm(), submission, CONFIG);
		expect(payload.test).toBeUndefined();
	});

	test("includeMetadata: false hides attribution even when present", () => {
		const withAttribution = buildSubmission({ name: "Ada" });
		withAttribution.meta = { attribution: { utm_source: "newsletter" } };
		const included = webhookPayload(buildForm(), withAttribution, CONFIG, {
			includeMetadata: true,
		});
		expect(included.meta).toEqual({
			attribution: { utm_source: "newsletter" },
		});
		const excluded = webhookPayload(buildForm(), withAttribution, CONFIG, {
			includeMetadata: false,
		});
		expect(excluded.meta).toBeUndefined();
	});

	test("always carries the core form/submission identifiers", () => {
		const payload = webhookPayload(buildForm(), submission, CONFIG);
		expect(payload.form_id).toBe("form-1");
		expect(payload.form_slug).toBe("contact-us");
		expect(payload.submission_id).toBe("pub-1");
	});
});
