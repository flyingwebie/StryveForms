import { describe, expect, test } from "bun:test";

import {
	createEmailNotificationToolInputSchema,
	createIntegrationToolInputSchema,
	deleteEmailNotificationToolInputSchema,
	deleteIntegrationToolInputSchema,
	explainFormLogicInputSchema,
	GET_SUBMISSION_STATS_MAX_DAYS,
	getFormInputSchema,
	getSubmissionStatsInputSchema,
	LIST_FORMS_MAX,
	listEmailNotificationsToolInputSchema,
	listFormsInputSchema,
	listIntegrationsToolInputSchema,
	listIntegrationTypesToolInputSchema,
	listSendersToolInputSchema,
	previewEmailNotificationToolInputSchema,
	SEARCH_SUBMISSIONS_MAX,
	searchSubmissionsInputSchema,
	sendTestEmailNotificationToolInputSchema,
	testIntegrationToolInputSchema,
	updateEmailNotificationToolInputSchema,
	updateFormFieldsInputSchema,
	updateIntegrationToolInputSchema,
} from "./tool-schemas";

describe("listFormsInputSchema", () => {
	test("defaults limit to 20 when omitted", () => {
		const result = listFormsInputSchema.parse({});
		expect(result.limit).toBe(20);
		expect(result.query).toBeUndefined();
	});

	test("accepts a query and an explicit limit", () => {
		const result = listFormsInputSchema.parse({ limit: 5, query: "signup" });
		expect(result).toEqual({ limit: 5, query: "signup" });
	});

	test(`rejects a limit above ${LIST_FORMS_MAX}`, () => {
		expect(
			listFormsInputSchema.safeParse({ limit: LIST_FORMS_MAX + 1 }).success
		).toBe(false);
	});

	test("rejects a limit of 0 or a non-integer", () => {
		expect(listFormsInputSchema.safeParse({ limit: 0 }).success).toBe(false);
		expect(listFormsInputSchema.safeParse({ limit: 1.5 }).success).toBe(false);
	});

	test("rejects a query longer than 200 characters", () => {
		expect(
			listFormsInputSchema.safeParse({ query: "a".repeat(201) }).success
		).toBe(false);
	});
});

describe("getFormInputSchema", () => {
	test("requires a non-empty formId", () => {
		expect(getFormInputSchema.safeParse({ formId: "" }).success).toBe(false);
		expect(getFormInputSchema.safeParse({}).success).toBe(false);
		expect(getFormInputSchema.safeParse({ formId: "f1" }).success).toBe(true);
	});
});

describe("updateFormFieldsInputSchema", () => {
	test("requires formId and a non-empty field list", () => {
		expect(
			updateFormFieldsInputSchema.safeParse({
				fields: [{ blockId: "text", name: "Name" }],
				formId: "f1",
			}).success
		).toBe(true);
		expect(
			updateFormFieldsInputSchema.safeParse({ fields: [], formId: "f1" })
				.success
		).toBe(false);
		expect(
			updateFormFieldsInputSchema.safeParse({
				fields: [{ blockId: "text", name: "Name" }],
			}).success
		).toBe(false);
	});
});

describe("getSubmissionStatsInputSchema", () => {
	test("days is optional — omit it for all-time stats", () => {
		const result = getSubmissionStatsInputSchema.parse({ formId: "f1" });
		expect(result.days).toBeUndefined();
	});

	test("accepts a days window within range", () => {
		const result = getSubmissionStatsInputSchema.parse({
			days: 30,
			formId: "f1",
		});
		expect(result.days).toBe(30);
	});

	test(`rejects days above ${GET_SUBMISSION_STATS_MAX_DAYS} or below 1`, () => {
		expect(
			getSubmissionStatsInputSchema.safeParse({
				days: GET_SUBMISSION_STATS_MAX_DAYS + 1,
				formId: "f1",
			}).success
		).toBe(false);
		expect(
			getSubmissionStatsInputSchema.safeParse({ days: 0, formId: "f1" }).success
		).toBe(false);
	});

	test("requires formId", () => {
		expect(getSubmissionStatsInputSchema.safeParse({ days: 7 }).success).toBe(
			false
		);
	});
});

describe("searchSubmissionsInputSchema", () => {
	test("defaults limit to 10", () => {
		const result = searchSubmissionsInputSchema.parse({ formId: "f1" });
		expect(result.limit).toBe(10);
	});

	test(`rejects a limit above ${SEARCH_SUBMISSIONS_MAX}`, () => {
		expect(
			searchSubmissionsInputSchema.safeParse({
				formId: "f1",
				limit: SEARCH_SUBMISSIONS_MAX + 1,
			}).success
		).toBe(false);
	});

	test("query is optional and capped at 200 characters", () => {
		expect(
			searchSubmissionsInputSchema.safeParse({ formId: "f1" }).success
		).toBe(true);
		expect(
			searchSubmissionsInputSchema.safeParse({
				formId: "f1",
				query: "a".repeat(201),
			}).success
		).toBe(false);
	});
});

describe("explainFormLogicInputSchema", () => {
	test("requires a non-empty formId", () => {
		expect(
			explainFormLogicInputSchema.safeParse({ formId: "f1" }).success
		).toBe(true);
		expect(explainFormLogicInputSchema.safeParse({}).success).toBe(false);
	});
});

describe("listIntegrationsToolInputSchema", () => {
	test("requires formId", () => {
		expect(
			listIntegrationsToolInputSchema.safeParse({ formId: "f1" }).success
		).toBe(true);
		expect(listIntegrationsToolInputSchema.safeParse({}).success).toBe(false);
	});
});

describe("listIntegrationTypesToolInputSchema", () => {
	test("takes no input", () => {
		expect(listIntegrationTypesToolInputSchema.safeParse({}).success).toBe(
			true
		);
	});
});

describe("createIntegrationToolInputSchema", () => {
	test("defaults data/settings/status", () => {
		const result = createIntegrationToolInputSchema.parse({
			formId: "f1",
			integrationId: "webhook",
		});
		expect(result.data).toEqual({});
		expect(result.settings).toEqual({});
		expect(result.status).toBe("active");
	});

	test("requires formId and integrationId", () => {
		expect(
			createIntegrationToolInputSchema.safeParse({ formId: "f1" }).success
		).toBe(false);
		expect(
			createIntegrationToolInputSchema.safeParse({
				integrationId: "webhook",
			}).success
		).toBe(false);
	});

	test("accepts an arbitrary data/settings payload", () => {
		const result = createIntegrationToolInputSchema.parse({
			data: { webhook_url: "https://example.com/hook" },
			formId: "f1",
			integrationId: "webhook",
			settings: { timeout_seconds: 5 },
		});
		expect(result.data.webhook_url).toBe("https://example.com/hook");
		expect(result.settings.timeout_seconds).toBe(5);
	});
});

describe("updateIntegrationToolInputSchema", () => {
	test("requires formId and id, everything else optional", () => {
		expect(
			updateIntegrationToolInputSchema.safeParse({ formId: "f1", id: "i1" })
				.success
		).toBe(true);
		expect(
			updateIntegrationToolInputSchema.safeParse({ formId: "f1" }).success
		).toBe(false);
	});
});

describe("deleteIntegrationToolInputSchema", () => {
	test("requires formId and id", () => {
		expect(
			deleteIntegrationToolInputSchema.safeParse({ formId: "f1", id: "i1" })
				.success
		).toBe(true);
		expect(
			deleteIntegrationToolInputSchema.safeParse({ formId: "f1" }).success
		).toBe(false);
	});
});

describe("testIntegrationToolInputSchema", () => {
	test("requires only formId — id/integrationId/data/settings are all optional", () => {
		expect(
			testIntegrationToolInputSchema.safeParse({ formId: "f1" }).success
		).toBe(true);
	});
});

describe("listEmailNotificationsToolInputSchema", () => {
	test("requires formId", () => {
		expect(
			listEmailNotificationsToolInputSchema.safeParse({ formId: "f1" }).success
		).toBe(true);
		expect(listEmailNotificationsToolInputSchema.safeParse({}).success).toBe(
			false
		);
	});
});

describe("createEmailNotificationToolInputSchema", () => {
	test("defaults data to {} and status to active", () => {
		const result = createEmailNotificationToolInputSchema.parse({
			formId: "f1",
		});
		expect(result.data).toEqual({});
		expect(result.status).toBe("active");
	});

	test("accepts a mention placeholder in send_to without altering it", () => {
		const mention =
			'<span mention="true" mention-field-id="email1" mention-field-name="Email">Email</span>';
		const result = createEmailNotificationToolInputSchema.parse({
			data: { send_to: mention, subject: "Thanks for your submission" },
			formId: "f1",
		});
		expect(result.data.send_to).toBe(mention);
	});

	test("passes through fields the schema doesn't name (passthrough)", () => {
		const result = createEmailNotificationToolInputSchema.parse({
			data: { some_future_field: "x" },
			formId: "f1",
		});
		expect(result.data.some_future_field).toBe("x");
	});
});

describe("updateEmailNotificationToolInputSchema", () => {
	test("requires formId and id", () => {
		expect(
			updateEmailNotificationToolInputSchema.safeParse({
				formId: "f1",
				id: "n1",
			}).success
		).toBe(true);
		expect(
			updateEmailNotificationToolInputSchema.safeParse({ formId: "f1" }).success
		).toBe(false);
	});
});

describe("deleteEmailNotificationToolInputSchema", () => {
	test("requires formId and id", () => {
		expect(
			deleteEmailNotificationToolInputSchema.safeParse({
				formId: "f1",
				id: "n1",
			}).success
		).toBe(true);
	});
});

describe("previewEmailNotificationToolInputSchema", () => {
	test("requires formId and data", () => {
		expect(
			previewEmailNotificationToolInputSchema.safeParse({
				data: {},
				formId: "f1",
			}).success
		).toBe(true);
		expect(
			previewEmailNotificationToolInputSchema.safeParse({ formId: "f1" })
				.success
		).toBe(false);
	});
});

describe("sendTestEmailNotificationToolInputSchema", () => {
	test("`to` is optional but must be a valid email when given", () => {
		expect(
			sendTestEmailNotificationToolInputSchema.safeParse({
				data: {},
				formId: "f1",
			}).success
		).toBe(true);
		expect(
			sendTestEmailNotificationToolInputSchema.safeParse({
				data: {},
				formId: "f1",
				to: "not-an-email",
			}).success
		).toBe(false);
		expect(
			sendTestEmailNotificationToolInputSchema.safeParse({
				data: {},
				formId: "f1",
				to: "person@example.com",
			}).success
		).toBe(true);
	});
});

describe("listSendersToolInputSchema", () => {
	test("takes no input", () => {
		expect(listSendersToolInputSchema.safeParse({}).success).toBe(true);
	});
});
