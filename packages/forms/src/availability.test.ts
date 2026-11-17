import { describe, expect, test } from "bun:test";

import {
	canViewForm,
	formAvailability,
	isAtSubmissionLimit,
	isPastClosing,
	showsFormFields,
} from "./availability";

const NOW = new Date("2026-06-01T12:00:00Z");
const PAST = new Date("2026-05-31T12:00:00Z");
const FUTURE = new Date("2026-06-02T12:00:00Z");

describe("formAvailability", () => {
	test("a public form with no limits is open", () => {
		expect(
			formAvailability({ closesAt: null, visibility: "public" }, NOW)
		).toBe("open");
	});

	test("a draft stays a draft whatever its dates or counts", () => {
		expect(
			formAvailability(
				{
					closesAt: PAST,
					completedCount: 9,
					maxSubmissionsCount: 1,
					visibility: "draft",
				},
				NOW
			)
		).toBe("draft");
	});

	test("closes when the owner closes it or the date passes", () => {
		expect(
			formAvailability({ closesAt: null, visibility: "closed" }, NOW)
		).toBe("closed");
		expect(
			formAvailability({ closesAt: PAST, visibility: "public" }, NOW)
		).toBe("closed");
		expect(
			formAvailability({ closesAt: FUTURE, visibility: "public" }, NOW)
		).toBe("open");
	});

	test("accepts the closing date as an ISO string", () => {
		expect(
			formAvailability(
				{ closesAt: PAST.toISOString(), visibility: "public" },
				NOW
			)
		).toBe("closed");
	});

	test("is full once completed submissions reach the limit", () => {
		const base = {
			closesAt: null,
			maxSubmissionsCount: 3,
			visibility: "public",
		};
		expect(formAvailability({ ...base, completedCount: 2 }, NOW)).toBe("open");
		expect(formAvailability({ ...base, completedCount: 3 }, NOW)).toBe("full");
		expect(formAvailability(base, NOW)).toBe("open");
	});

	test("closed wins over full", () => {
		expect(
			formAvailability(
				{
					closesAt: PAST,
					completedCount: 3,
					maxSubmissionsCount: 3,
					visibility: "public",
				},
				NOW
			)
		).toBe("closed");
	});
});

describe("isPastClosing", () => {
	test("matches the closed state", () => {
		expect(isPastClosing({ closesAt: PAST, visibility: "public" }, NOW)).toBe(
			true
		);
		expect(isPastClosing({ closesAt: null, visibility: "draft" }, NOW)).toBe(
			false
		);
	});
});

describe("what each viewer may do", () => {
	test("only members can load a draft", () => {
		expect(canViewForm("draft", false)).toBe(false);
		expect(canViewForm("draft", true)).toBe(true);
		expect(canViewForm("closed", false)).toBe(true);
		expect(canViewForm("full", false)).toBe(true);
	});

	test("respondents see the questions only while the form is open", () => {
		expect(showsFormFields("open", false)).toBe(true);
		expect(showsFormFields("closed", false)).toBe(false);
		expect(showsFormFields("full", false)).toBe(false);
		expect(showsFormFields("closed", true)).toBe(true);
		expect(showsFormFields("full", true)).toBe(true);
	});

	test("the limit only applies when one is set", () => {
		expect(isAtSubmissionLimit(null, 100)).toBe(false);
		expect(isAtSubmissionLimit(undefined, 100)).toBe(false);
		expect(isAtSubmissionLimit(3, 2)).toBe(false);
		expect(isAtSubmissionLimit(3, 3)).toBe(true);
	});
});
