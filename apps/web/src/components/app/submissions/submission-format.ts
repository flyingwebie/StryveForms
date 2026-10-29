import type { FormField } from "@StryveForms/forms/types";
import {
	displayValueToText,
	formatFieldValue,
} from "@StryveForms/forms/values";

/** Device/browser recorded at submit time (services/submissions.ts buildMeta). */
export interface ParsedDevice {
	browser: string;
	device: string;
	os: string;
}

/** "Took 2m 14s" / "Took 45s"; `null` when there's nothing to show. */
export function formatCompletionTime(
	seconds: number | null | undefined
): string | null {
	if (seconds === null || seconds === undefined || seconds < 0) {
		return null;
	}
	const whole = Math.round(seconds);
	const minutes = Math.floor(whole / 60);
	const rest = whole % 60;
	if (minutes === 0) {
		return `Took ${rest}s`;
	}
	return `Took ${minutes}m ${String(rest).padStart(2, "0")}s`;
}

/** "Chrome on macOS" / "Safari on iOS (Mobile)"; "Not recorded" when absent. */
export function formatDeviceLabel(
	device: ParsedDevice | null | undefined
): string {
	if (!device) {
		return "Not recorded";
	}
	const suffix =
		device.device && device.device !== "Desktop" ? ` (${device.device})` : "";
	return `${device.browser} on ${device.os}${suffix}`;
}

/** The plain-text form of an answer, with no field name attached. */
export function answerValueText(field: FormField, value: unknown): string {
	const display = formatFieldValue(field, value);
	return display === null ? "" : displayValueToText(display);
}

/** One "Label: value" line for "Copy all as text". */
export function answerToText(field: FormField, value: unknown): string {
	return `${field.name}: ${answerValueText(field, value) || "No answer"}`;
}

/** How many of the `max` stars are filled for a rating answer. */
export function ratingStars(
	value: unknown,
	max: number | undefined
): { max: number; value: number } {
	const total = Math.max(1, max ?? 5);
	const raw = typeof value === "number" ? value : Number(value);
	const filled = Number.isFinite(raw) ? Math.max(0, Math.min(total, raw)) : 0;
	return { max: total, value: filled };
}
