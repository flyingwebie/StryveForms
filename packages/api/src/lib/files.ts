import type { AppConfig } from "../context";
import { signPath } from "./signing";

const UNSAFE_NAME_CHARS = /[^\w.-]+/g;
const MAX_BASE_LENGTH = 50;

/** Storage key for a respondent's file, same layout as OpnForm. */
export function submissionFileKey(formId: string, fileName: string): string {
	return `forms/${formId}/submissions/${fileName}`;
}

export function tempUploadKey(fileName: string): string {
	return `tmp/${fileName}`;
}

export function assetKey(fileName: string): string {
	return `assets/${fileName}`;
}

/** `My report.pdf` → `My_report_<uuid>.pdf`, the canonical stored name. */
export function canonicalFileName(
	originalName: string,
	uuid = crypto.randomUUID()
): string {
	const dot = originalName.lastIndexOf(".");
	const hasExt = dot > 0 && dot < originalName.length - 1;
	const ext = hasExt
		? originalName
				.slice(dot + 1)
				.toLowerCase()
				.replace(UNSAFE_NAME_CHARS, "")
		: "";
	const base = (hasExt ? originalName.slice(0, dot) : originalName)
		.replace(UNSAFE_NAME_CHARS, "_")
		.slice(0, MAX_BASE_LENGTH);
	const name = base ? `${base}_${uuid}` : uuid;
	return ext ? `${name}.${ext}` : name;
}

/** Temporary, signed link to a respondent's uploaded file. */
export function submissionFileUrl(
	config: AppConfig,
	formId: string,
	fileName: string,
	ttlSeconds?: number
): string {
	const path = `/api/files/${encodeURIComponent(formId)}/${encodeURIComponent(fileName)}`;
	return `${config.serverUrl}${signPath(config.signingSecret, path, ttlSeconds)}`;
}

/** Public link to a form asset (logo, cover, image block). */
export function assetUrl(config: AppConfig, fileName: string): string {
	return `${config.serverUrl}/api/assets/${encodeURIComponent(fileName)}`;
}

export function shareUrl(
	config: AppConfig,
	slug: string,
	customDomain?: string | null
): string {
	if (customDomain) {
		return `https://${customDomain}/forms/${slug}`;
	}
	return `${config.appUrl}/forms/${slug}`;
}
