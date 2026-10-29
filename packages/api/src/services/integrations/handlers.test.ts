import type { FormField } from "@StryveForms/forms/types";
import { describe, expect, it } from "bun:test";

import type { AppConfig } from "../../context";
import type { FormRow } from "../../lib/serialize";
import { composeEmail } from "./handlers";
import type { SubmissionRow } from "./payload";

const CONFIG: AppConfig = {
	appName: "StryveForms",
	appUrl: "https://forms.example.com",
	captcha: {},
	importRateLimitPerMinute: 60,
	serverUrl: "https://api.example.com",
	signingSecret: "test-signing-secret-xxxxxxxxxxxx",
};

const FIELDS: FormField[] = [
	{ id: "email", name: "Email", type: "email" },
	{ id: "name", name: "Name", type: "text" },
];

function buildForm(overrides: Partial<FormRow> = {}): FormRow {
	return {
		color: "#111827",
		computedVariables: [],
		customDomain: null,
		editableSubmissions: false,
		editableSubmissionsButtonText: "Edit submission",
		id: "form-1",
		noBranding: false,
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

const mention = (fieldId: string, label: string) =>
	`<span mention="true" mention-field-id="${fieldId}" mention-field-name="${label}">${label}</span>`;

describe("composeEmail", () => {
	it("resolves mentions in send_to and subject (used for respondent confirmations)", () => {
		const composed = composeEmail({
			config: CONFIG,
			data: {
				send_to: mention("email", "Email"),
				subject: `New reply from ${mention("name", "Name")}`,
			},
			form: buildForm(),
			submission: buildSubmission({
				email: "respondent@example.com",
				name: "Ada",
			}),
		});
		expect(composed.recipients).toEqual(["respondent@example.com"]);
		expect(composed.subject).toBe("New reply from Ada");
	});

	it("splits recipients on commas, newlines and semicolons, dropping invalid ones", () => {
		const composed = composeEmail({
			config: CONFIG,
			data: {
				send_to: "a@example.com, not-an-email\nb@example.com;c@example.com",
			},
			form: buildForm(),
			submission: buildSubmission({}),
		});
		expect(composed.recipients).toEqual([
			"a@example.com",
			"b@example.com",
			"c@example.com",
		]);
	});

	it("has no recipients when send_to is empty, rather than throwing", () => {
		const composed = composeEmail({
			config: CONFIG,
			data: {},
			form: buildForm(),
			submission: buildSubmission({}),
		});
		expect(composed.recipients).toEqual([]);
	});

	it("falls back to the form title when no subject is set", () => {
		const composed = composeEmail({
			config: CONFIG,
			data: {},
			form: buildForm({ title: "Contact us" }),
			submission: buildSubmission({}),
		});
		expect(composed.subject).toBe("New submission: Contact us");
	});

	it("drops an invalid reply-to override", () => {
		const composed = composeEmail({
			config: CONFIG,
			data: { reply_to: "not-an-email" },
			form: buildForm(),
			submission: buildSubmission({}),
		});
		expect(composed.replyTo).toBeUndefined();
	});

	it("keeps a valid reply-to override", () => {
		const composed = composeEmail({
			config: CONFIG,
			data: { reply_to: "owner@example.com" },
			form: buildForm(),
			submission: buildSubmission({}),
		});
		expect(composed.replyTo).toBe("owner@example.com");
	});

	it("prefers the workspace SMTP sender address over the legacy sender_email field", () => {
		const composed = composeEmail({
			config: CONFIG,
			data: { sender_email: "legacy@example.com" },
			form: buildForm(),
			senderAddress: "workspace@example.com",
			submission: buildSubmission({}),
		});
		expect(composed.fromAddress).toBe("workspace@example.com");
	});

	it("falls back to the legacy sender_email field when there's no workspace sender", () => {
		const composed = composeEmail({
			config: CONFIG,
			data: { sender_email: "legacy@example.com" },
			form: buildForm(),
			submission: buildSubmission({}),
		});
		expect(composed.fromAddress).toBe("legacy@example.com");
	});

	it("ignores an invalid legacy sender_email value", () => {
		const composed = composeEmail({
			config: CONFIG,
			data: { sender_email: "not-an-email" },
			form: buildForm(),
			submission: buildSubmission({}),
		});
		expect(composed.fromAddress).toBeUndefined();
	});

	it("uses the app name as the sender name when nothing overrides it", () => {
		const composed = composeEmail({
			config: CONFIG,
			data: {},
			form: buildForm(),
			submission: buildSubmission({}),
		});
		expect(composed.senderName).toBe("StryveForms");
	});

	it("an explicit sender name override wins", () => {
		const composed = composeEmail({
			config: CONFIG,
			data: { sender_name: "Acme Support" },
			form: buildForm(),
			submission: buildSubmission({}),
		});
		expect(composed.senderName).toBe("Acme Support");
	});
});
