import type { FormField } from "@StryveForms/forms/types";
import { describe, expect, test } from "bun:test";
import {
	fieldId,
	mapForm,
	mapIntegrations,
	mapSubmission,
	parseJotformDate,
	toLocalIso,
} from "./map";

import type { JotformQuestion, JotformSubmission } from "./types";

const STORED_CV =
	/^My_CV_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

const QUESTIONS: JotformQuestion[] = [
	{
		order: "1",
		qid: "1",
		text: "Contact us",
		type: "control_head",
		headerType: "Large",
		subHeader: "We reply fast",
	},
	{
		order: "2",
		qid: "3",
		text: "Full Name",
		type: "control_fullname",
		required: "Yes",
	},
	{
		order: "3",
		qid: "4",
		text: "E-mail",
		type: "control_email",
		required: "Yes",
		hint: "ex: you@example.com",
	},
	{ order: "4", qid: "5", text: "Phone", type: "control_phone" },
	{ order: "5", qid: "6", text: "Address", type: "control_address" },
	{
		order: "6",
		qid: "7",
		text: "Topic",
		type: "control_dropdown",
		options: "Sales|Support|Other",
	},
	{
		order: "7",
		qid: "8",
		text: "Plan",
		type: "control_radio",
		options: "Free|Pro",
		allowOther: "Yes",
	},
	{
		order: "8",
		qid: "9",
		text: "Interests",
		type: "control_checkbox",
		options: "Forms|Logic|Emails",
	},
	{
		order: "9",
		qid: "10",
		text: "Visit date",
		type: "control_datetime",
		allowTime: "Yes",
		format: "mmddyyyy",
	},
	{ order: "10", qid: "11", text: "CV", type: "control_fileupload" },
	{
		order: "11",
		qid: "12",
		text: "Rate us",
		type: "control_rating",
		stars: "10",
	},
	{
		order: "12",
		qid: "13",
		text: "Service",
		type: "control_matrix",
		mrows: "Speed|Quality",
		mcolumns: "Bad|Good",
		inputType: "Radio Button",
	},
	{ order: "13", qid: "14", text: "Signature", type: "control_signature" },
	{ order: "14", qid: "15", text: "", type: "control_pagebreak" },
	{ order: "15", qid: "16", text: "Pay", type: "control_stripe" },
	{ order: "16", qid: "17", text: "Captcha", type: "control_captcha" },
	{
		order: "17",
		qid: "18",
		text: "Message",
		type: "control_textarea",
		entryLimit: "Letters-500",
	},
	{ order: "18", qid: "19", text: "Send it", type: "control_button" },
];

const SUBMISSION: JotformSubmission = {
	answers: {
		"3": {
			answer: { first: "Ada", last: "Lovelace" },
			prettyFormat: "Ada Lovelace",
			type: "control_fullname",
		},
		"4": { answer: "ada@example.com", type: "control_email" },
		"5": {
			answer: { full: "(555) 123-4567" },
			prettyFormat: "(555) 123-4567",
			type: "control_phone",
		},
		"6": {
			answer: {
				addr_line1: "1 Main St",
				city: "Dublin",
				country: "Ireland",
				postal: "D01",
				state: "",
			},
			type: "control_address",
		},
		"7": { answer: "Support", type: "control_dropdown" },
		"8": { answer: "Enterprise", type: "control_radio" },
		"9": { answer: ["Forms", "Emails"], type: "control_checkbox" },
		"10": {
			answer: {
				ampm: "PM",
				day: "05",
				hour: "01",
				min: "30",
				month: "02",
				year: "2025",
			},
			type: "control_datetime",
		},
		"11": {
			answer: ["https://www.jotform.com/uploads/ada/123/456/My%20CV.pdf"],
			type: "control_fileupload",
		},
		"12": { answer: "8", type: "control_rating" },
		"13": { answer: { "0": "Good", "1": ["Bad"] }, type: "control_matrix" },
		"14": {
			answer: "https://www.jotform.com/uploads/ada/123/456/sig.png",
			type: "control_signature",
		},
		"16": {
			answer: { paymentArray: "{}" },
			prettyFormat: "Total: 10.00 EUR",
			type: "control_stripe",
		},
		"18": { answer: "Hello\nthere", type: "control_textarea" },
	},
	created_at: "2025-02-05 08:00:00",
	flag: "1",
	form_id: "123",
	id: "456",
	ip: "203.0.113.9",
	notes: "VIP",
	status: "ACTIVE",
};

describe("mapForm", () => {
	const { fields, settings, warnings } = mapForm(
		{
			created_at: "2025-01-01 00:00:00",
			id: "123",
			status: "ENABLED",
			title: "Contact",
			type: "CARD",
		},
		QUESTIONS,
		{
			activeRedirect: "thanktext",
			conditions: [{ type: "field" }],
			thanktext: "<p>Thanks!</p>",
		}
	);
	const byId = new Map(
		(settings.properties as FormField[]).map((f) => [f.id, f])
	);

	test("maps form settings", () => {
		expect(settings.title).toBe("Contact");
		expect(settings.presentationStyle).toBe("focused");
		expect(settings.submittedText).toBe("<p>Thanks!</p>");
		expect(settings.submitButtonText).toBe("Send it");
		expect(settings.useWorkspaceBrand).toBe(true);
		expect(warnings[0]).toContain("Conditional logic");
	});

	test("splits full name and address", () => {
		expect(byId.get(fieldId("3", "first"))?.width).toBe("1/2");
		expect(byId.get(fieldId("3", "last"))?.required).toBe(true);
		expect(byId.get(fieldId("6", "city"))?.type).toBe("text");
		expect(byId.get(fieldId("6", "addr_line2"))?.required).toBeUndefined();
	});

	test("maps choices, dates and special fields", () => {
		expect(byId.get(fieldId("7"))?.select?.options.map((o) => o.name)).toEqual([
			"Sales",
			"Support",
			"Other",
		]);
		expect(byId.get(fieldId("8"))?.without_dropdown).toBe(true);
		expect(byId.get(fieldId("8"))?.allow_creation).toBe(true);
		expect(byId.get(fieldId("9"))?.type).toBe("multi_select");
		expect(byId.get(fieldId("10"))).toMatchObject({
			date_format: "MM-dd-yyyy",
			type: "date",
			with_time: true,
		});
		expect(byId.get(fieldId("12"))?.rating_max_value).toBe(10);
		expect(byId.get(fieldId("13"))?.rows).toEqual(["Speed", "Quality"]);
		expect(byId.get(fieldId("18"))?.max_char_limit).toBe(500);
		expect(byId.get(fieldId("1"))?.content).toBe(
			"<h2>Contact us</h2><p>We reply fast</p>"
		);
		expect(byId.get(fieldId("4"))?.placeholder).toBe("ex: you@example.com");
	});

	test("reports converted and skipped questions", () => {
		const status = Object.fromEntries(fields.map((f) => [f.qid, f.status]));
		expect(status["3"]).toBe("converted");
		expect(status["4"]).toBe("ok");
		expect(status["16"]).toBe("converted");
		expect(status["17"]).toBe("skipped");
		expect(status["19"]).toBeUndefined();
		expect(byId.has(fieldId("17"))).toBe(false);
	});
});

describe("mapSubmission", () => {
	const mapped = mapSubmission(SUBMISSION, QUESTIONS);

	test("maps answers", () => {
		expect(mapped.data[fieldId("3", "first")]).toBe("Ada");
		expect(mapped.data[fieldId("5")]).toBe("(555) 123-4567");
		expect(mapped.data[fieldId("6", "country")]).toBe("Ireland");
		expect(mapped.data[fieldId("6", "state")]).toBeUndefined();
		expect(mapped.data[fieldId("7")]).toBe("Support");
		expect(mapped.data[fieldId("8")]).toBe("Enterprise");
		expect(mapped.data[fieldId("9")]).toEqual(["Forms", "Emails"]);
		expect(mapped.data[fieldId("10")]).toBe("2025-02-05T13:30:00");
		expect(mapped.data[fieldId("12")]).toBe(8);
		expect(mapped.data[fieldId("13")]).toEqual({
			Quality: "Bad",
			Speed: "Good",
		});
		expect(mapped.data[fieldId("16")]).toBe("Total: 10.00 EUR");
		expect(mapped.data[fieldId("18")]).toBe("Hello\nthere");
	});

	test("collects files", () => {
		expect(mapped.files).toHaveLength(2);
		expect(mapped.files[0]?.originalName).toBe("My CV.pdf");
		expect(mapped.files[0]?.storedName).toMatch(STORED_CV);
		expect(mapped.data[fieldId("11")]).toEqual([mapped.files[0]?.storedName]);
		// Same submission → same names, so a second import doesn't copy again.
		expect(mapSubmission(SUBMISSION, QUESTIONS).files[0]?.storedName).toBe(
			mapped.files[0]?.storedName
		);
		expect(mapped.data[fieldId("14")]).toBe(mapped.files[1]?.storedName);
	});

	test("keeps metadata", () => {
		expect(mapped.meta).toMatchObject({
			flagged: true,
			importedFrom: "jotform",
			ip_address: "203.0.113.9",
			notes: "VIP",
		});
		// 08:00 in New York in February (EST, UTC-5).
		expect(mapped.createdAt.toISOString()).toBe("2025-02-05T13:00:00.000Z");
	});
});

describe("dates", () => {
	test("JotForm times are US Eastern, including daylight saving", () => {
		expect(parseJotformDate("2025-07-01 12:00:00")?.toISOString()).toBe(
			"2025-07-01T16:00:00.000Z"
		);
		expect(parseJotformDate("nope")).toBeNull();
	});

	test("answers become time-zone free ISO strings", () => {
		expect(toLocalIso({ datetime: "2024-05-01 09:05:00" })).toBe(
			"2024-05-01T09:05:00"
		);
		expect(toLocalIso({ day: "1", month: "5", year: "2024" })).toBe(
			"2024-05-01T00:00:00"
		);
		expect(
			toLocalIso({
				ampm: "AM",
				day: "1",
				hour: "12",
				min: "15",
				month: "5",
				year: "2024",
			})
		).toBe("2024-05-01T00:15:00");
		expect(toLocalIso("05-01-2024")).toBe("2024-05-01T00:00:00");
		expect(toLocalIso({})).toBeNull();
	});
});

describe("mapIntegrations", () => {
	const questions: JotformQuestion[] = [
		{
			name: "email",
			order: "1",
			qid: "4",
			text: "E-mail",
			type: "control_email",
		},
	];

	test("turns notifications, autoresponders and webhooks into integrations", () => {
		const result = mapIntegrations(
			{
				emails: [
					{
						html: "false",
						subject: "New lead",
						to: "team@acme.com",
						type: "notification",
					},
					{
						body: "<p>Thanks {email}</p>",
						disabled: "1",
						subject: "Thanks!",
						to: "{email}",
						type: "autorespond",
					},
				],
			},
			questions,
			["https://hooks.example.com/jf"]
		);
		expect(result.map((r) => r.integrationId)).toEqual([
			"email",
			"email",
			"webhook",
		]);
		expect(result[0]?.data).toMatchObject({
			email_content: "<p>New form submission</p>",
			include_submission_data: true,
			send_to: "team@acme.com",
			subject: "New lead",
		});
		expect(String(result[1]?.data.send_to)).toContain(
			'mention-field-id="jf_4"'
		);
		expect(String(result[1]?.data.email_content)).toContain("mention");
		expect(result[1]?.status).toBe("inactive");
		expect(result[1]?.note).toContain("Autoresponder");
		expect(result[2]?.data).toEqual({
			webhook_url: "https://hooks.example.com/jf",
		});
	});

	test("turns tags in the thank-you message into mentions", () => {
		const { settings } = mapForm(
			{ created_at: "", id: "1", status: "ENABLED", title: "T" },
			questions,
			{ thanktext: "<p>Thanks {email}!</p>" }
		);
		expect(settings.submittedText).toContain('mention-field-id="jf_4"');
	});
});
