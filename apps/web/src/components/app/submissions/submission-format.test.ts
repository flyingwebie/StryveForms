import type { FormField } from "@StryveForms/forms/types";
import { describe, expect, test } from "bun:test";

import {
	answerToText,
	formatCompletionTime,
	formatDeviceLabel,
	ratingStars,
} from "./submission-format";

describe("formatCompletionTime", () => {
	test("under a minute", () => {
		expect(formatCompletionTime(45)).toBe("Took 45s");
	});
	test("minutes and seconds", () => {
		expect(formatCompletionTime(134)).toBe("Took 2m 14s");
	});
	test("exactly on a minute boundary pads seconds", () => {
		expect(formatCompletionTime(120)).toBe("Took 2m 00s");
	});
	test("missing or negative is null", () => {
		expect(formatCompletionTime(null)).toBeNull();
		expect(formatCompletionTime(undefined)).toBeNull();
		expect(formatCompletionTime(-1)).toBeNull();
	});
});

describe("formatDeviceLabel", () => {
	test("not recorded when absent", () => {
		expect(formatDeviceLabel(null)).toBe("Not recorded");
		expect(formatDeviceLabel(undefined)).toBe("Not recorded");
	});
	test("desktop has no suffix", () => {
		expect(
			formatDeviceLabel({ browser: "Chrome", device: "Desktop", os: "macOS" })
		).toBe("Chrome on macOS");
	});
	test("non-desktop shows the device kind", () => {
		expect(
			formatDeviceLabel({ browser: "Safari", device: "Mobile", os: "iOS" })
		).toBe("Safari on iOS (Mobile)");
	});
});

describe("answerToText", () => {
	const textField: FormField = { id: "a", name: "Your name", type: "text" };
	const checkboxField: FormField = {
		id: "b",
		name: "Agree?",
		type: "checkbox",
	};

	test("formats a plain value", () => {
		expect(answerToText(textField, "Ada")).toBe("Your name: Ada");
	});
	test("formats an empty value as 'No answer'", () => {
		expect(answerToText(textField, undefined)).toBe("Your name: No answer");
	});
	test("formats a checkbox as Yes/No", () => {
		expect(answerToText(checkboxField, true)).toBe("Agree?: Yes");
	});
});

describe("ratingStars", () => {
	test("clamps to the field's max", () => {
		expect(ratingStars(7, 5)).toEqual({ max: 5, value: 5 });
	});
	test("defaults to a 5-star max when unset", () => {
		expect(ratingStars(3, undefined)).toEqual({ max: 5, value: 3 });
	});
	test("a non-numeric value counts as zero", () => {
		expect(ratingStars("not-a-number", 5)).toEqual({ max: 5, value: 0 });
	});
});
