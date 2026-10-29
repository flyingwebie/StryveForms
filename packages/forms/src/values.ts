/**
 * Turns stored answers into human-readable values for tables, CSV exports,
 * emails and webhooks.
 */

import { isInputType } from "./blocks";
import { stripHtml } from "./mentions";
import type { FormField } from "./types";

export interface FileRef {
	name: string;
	url: string;
}

export interface FormatOptions {
	/** Resolves a stored file name to a downloadable URL. */
	fileUrl?: (fieldId: string, fileName: string) => string;
	/** Keep rich text as HTML (emails) instead of plain text (CSV). */
	keepHtml?: boolean;
}

const UUID_SUFFIX =
	/_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\.|$)/i;
const URL_LIKE = /^https?:\/\//i;

/** `report_<uuid>.pdf` → `report.pdf` (stored names carry a uuid suffix). */
export function displayFileName(stored: string): string {
	if (URL_LIKE.test(stored)) {
		const last = stored.split("?")[0]?.split("/").pop() ?? stored;
		return decodeURIComponent(last);
	}
	return stored.replace(UUID_SUFFIX, "");
}

export function fileList(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.flatMap((item) => {
			if (typeof item === "string") {
				return [item];
			}
			if (item && typeof item === "object" && "file_name" in item) {
				return [String((item as { file_name: unknown }).file_name)];
			}
			return [];
		});
	}
	return typeof value === "string" && value.length > 0 ? [value] : [];
}

export function isFileField(
	field: Pick<FormField, "type" | "file_upload">
): boolean {
	return (
		field.type === "files" ||
		field.type === "signature" ||
		Boolean(field.file_upload)
	);
}

function formatDate(field: FormField, value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const datePart =
		field.date_format === "MM-dd-yyyy"
			? `${month}-${day}-${date.getFullYear()}`
			: `${day}/${month}/${date.getFullYear()}`;
	if (!field.with_time) {
		return datePart;
	}
	const hours = date.getHours();
	const minutes = String(date.getMinutes()).padStart(2, "0");
	if (field.time_format === "12") {
		const suffix = hours >= 12 ? "PM" : "AM";
		return `${datePart} ${hours % 12 || 12}:${minutes} ${suffix}`;
	}
	return `${datePart} ${String(hours).padStart(2, "0")}:${minutes}`;
}

/** A display value: a string, a list of strings, or file references. */
export type DisplayValue = string | string[] | FileRef[] | null;

export function formatFieldValue(
	field: FormField,
	value: unknown,
	options: FormatOptions = {}
): DisplayValue {
	if (value === undefined || value === null || value === "") {
		return null;
	}
	if (isFileField(field)) {
		return fileList(value).map((name) => ({
			name: displayFileName(name),
			url: options.fileUrl ? options.fileUrl(field.id, name) : name,
		}));
	}
	switch (field.type) {
		case "checkbox":
			return value === true || value === "true" || value === 1 ? "Yes" : "No";
		case "date":
			return Array.isArray(value)
				? value.map((v) => formatDate(field, String(v))).join(" – ")
				: formatDate(field, String(value));
		case "multi_select":
			return Array.isArray(value) ? value.map(String) : [String(value)];
		case "matrix":
			if (typeof value === "object") {
				return Object.entries(value as Record<string, unknown>)
					.filter(([, v]) => v !== null && v !== undefined && v !== "")
					.map(([row, column]) => `${row}: ${String(column)}`);
			}
			return String(value);
		case "rich_text":
			return options.keepHtml ? String(value) : stripHtml(String(value));
		default:
			return Array.isArray(value) ? value.map(String) : String(value);
	}
}

/** Flattens a display value into one line of text (CSV cells, Slack, etc.). */
export function displayValueToText(value: DisplayValue): string {
	if (value === null) {
		return "";
	}
	if (typeof value === "string") {
		return value;
	}
	return value
		.map((item) => (typeof item === "string" ? item : item.url))
		.join(", ");
}

/** Fields that hold answers (no layout blocks), in form order. */
export function answerFields(
	fields: FormField[],
	removed: FormField[] = []
): FormField[] {
	const seen = new Set<string>();
	return [...fields, ...removed].filter((field) => {
		if (!isInputType(field.type) || seen.has(field.id)) {
			return false;
		}
		seen.add(field.id);
		return true;
	});
}
