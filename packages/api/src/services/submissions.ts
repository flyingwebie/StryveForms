import type { Database } from "@StryveForms/db";
import { form, formSubmission, storedFile } from "@StryveForms/db/schema/forms";
import { evaluateComputedVariables } from "@StryveForms/forms/computed";
import { referencedFieldIds } from "@StryveForms/forms/logic";
import { resolveRedirectUrl } from "@StryveForms/forms/redirect";
import type { ComputedVariable, FormField } from "@StryveForms/forms/types";
import {
	isEmptyValue,
	normalizeSelectValues,
	validateSubmission,
} from "@StryveForms/forms/validation";
import { fileList, isFileField } from "@StryveForms/forms/values";
import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray, sql } from "drizzle-orm";

import type { Services } from "../context";
import { submissionFileKey, tempUploadKey } from "../lib/files";
import { newId, newPublicId } from "../lib/ids";
import type { FormRow } from "../lib/serialize";
import { runIntegrations } from "./integrations/dispatch";
import { sanitizeRichText } from "./sanitize";

const DATA_URL = /^data:image\/png;base64,(.+)$/;
const URL_LIKE = /^https?:\/\//i;

/* ------------------------------ User agent -------------------------------- */
// Deliberately simple pattern checks (common browsers/OSes), not a full
// device database — top-level regex literals per the lint rule.
const UA_IPAD = /iPad/i;
const UA_ANDROID = /Android/i;
const UA_MOBILE_HINT = /Mobile/i;
const UA_MOBILE_DEVICE = /Mobile|iPhone|Android/i;
const UA_WINDOWS = /Windows/i;
const UA_IOS = /iPhone|iPad|iOS/i;
const UA_MACOS = /Mac OS X/i;
const UA_LINUX = /Linux/i;
const UA_EDGE = /Edg\//i;
const UA_OPERA_OPR = /OPR\//i;
const UA_OPERA = /Opera/i;
const UA_CRIOS = /CriOS\//i;
const UA_CHROME = /Chrome\//i;
const UA_CHROMIUM = /Chromium/i;
const UA_FIREFOX = /Firefox\//i;
const UA_SAFARI = /Safari\//i;
const UA_VERSION = /Version\//i;
const ATTRIBUTION_KEYS = new Set([
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_id",
	"utm_term",
	"utm_content",
	"utm_source_platform",
	"utm_creative_format",
	"utm_marketing_tactic",
	"gclid",
	"gbraid",
	"wbraid",
	"dclid",
	"fbclid",
	"ttclid",
	"msclkid",
]);
const MAX_ATTRIBUTION_LENGTH = 2048;

type SubmissionRow = typeof formSubmission.$inferSelect;

export interface SubmitInput {
	completionTime?: number | undefined;
	data: Record<string, unknown>;
	ip: string | null;
	isPartial?: boolean | undefined;
	/** `Referer` request header, if any, for the submission detail view's "source" info. */
	referrer?: string | undefined;
	/** Public id of a submission to update (editable or partial submissions). */
	submissionId?: string | undefined;
	tracking?: Record<string, unknown> | undefined;
	/** `User-Agent` request header, parsed into plain-language browser/OS/device. */
	userAgent?: string | undefined;
}

export interface SubmitResult {
	data: Record<string, unknown>;
	redirectUrl: string | null;
	status: "completed" | "partial";
	submissionId: string;
}

export function isFormClosed(row: FormRow): boolean {
	return (
		row.visibility === "closed" ||
		(row.closesAt !== null && row.closesAt < new Date())
	);
}

export async function completedCount(
	db: Database,
	formId: string
): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(formSubmission)
		.where(
			and(
				eq(formSubmission.formId, formId),
				eq(formSubmission.status, "completed")
			)
		);
	return row?.n ?? 0;
}

export interface ParsedUserAgent {
	browser: string;
	device: "Desktop" | "Mobile" | "Tablet";
	os: string;
}

/**
 * Turns a raw `User-Agent` header into plain words for the submission
 * detail view ("Chrome on macOS"). Deliberately simple: covers the common
 * browsers/OSes, not a full device database.
 */
export function parseUserAgent(ua: string): ParsedUserAgent {
	const isTablet =
		UA_IPAD.test(ua) || (UA_ANDROID.test(ua) && !UA_MOBILE_HINT.test(ua));
	const isMobile = !isTablet && UA_MOBILE_DEVICE.test(ua);
	let device: ParsedUserAgent["device"] = "Desktop";
	if (isTablet) {
		device = "Tablet";
	} else if (isMobile) {
		device = "Mobile";
	}

	let os = "Unknown";
	if (UA_WINDOWS.test(ua)) {
		os = "Windows";
	} else if (UA_IOS.test(ua)) {
		os = "iOS";
	} else if (UA_MACOS.test(ua)) {
		os = "macOS";
	} else if (UA_ANDROID.test(ua)) {
		os = "Android";
	} else if (UA_LINUX.test(ua)) {
		os = "Linux";
	}

	let browser = "Unknown";
	const isChrome =
		UA_CRIOS.test(ua) || (UA_CHROME.test(ua) && !UA_CHROMIUM.test(ua));
	if (UA_EDGE.test(ua)) {
		browser = "Edge";
	} else if (UA_OPERA_OPR.test(ua) || UA_OPERA.test(ua)) {
		browser = "Opera";
	} else if (isChrome) {
		browser = "Chrome";
	} else if (UA_FIREFOX.test(ua)) {
		browser = "Firefox";
	} else if (UA_SAFARI.test(ua) && UA_VERSION.test(ua)) {
		browser = "Safari";
	}

	return { browser, device, os };
}

function cleanAttribution(tracking: Record<string, unknown> | undefined) {
	if (!tracking) {
		return;
	}
	const entries = Object.entries(tracking).filter(
		([key, value]) =>
			ATTRIBUTION_KEYS.has(key) &&
			typeof value === "string" &&
			value.length <= MAX_ATTRIBUTION_LENGTH
	);
	return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/* ------------------------------- Validation ------------------------------ */

/** Field ids whose custom validation uses the `exists_in_submissions` operators. */
function uniquenessFields(fields: FormField[]): string[] {
	return fields.flatMap((field) => {
		const tree = field.validation?.error_conditions?.conditions;
		const json = tree ? JSON.stringify(tree) : "";
		return json.includes("exists_in_submissions")
			? referencedFieldIds(tree)
			: [];
	});
}

async function existingAnswerLookup(
	db: Database,
	formId: string,
	fieldIds: string[],
	data: Record<string, unknown>
) {
	const results = await Promise.all(
		fieldIds.map(async (fieldId) => {
			const value = data[fieldId];
			if (isEmptyValue(value)) {
				return null;
			}
			const [row] = await db
				.select({ id: formSubmission.id })
				.from(formSubmission)
				.where(
					and(
						eq(formSubmission.formId, formId),
						eq(formSubmission.status, "completed"),
						sql`${formSubmission.data}->>${fieldId} = ${String(value)}`
					)
				)
				.limit(1);
			return row ? fieldId : null;
		})
	);
	const found = new Set(results.filter((id): id is string => id !== null));
	return (fieldId: string) => found.has(fieldId);
}

async function validateAnswers(
	db: Database,
	row: FormRow,
	fields: FormField[],
	data: Record<string, unknown>,
	isPartial: boolean
): Promise<Record<string, unknown>> {
	if (isPartial) {
		if (!fields.some((f) => !isEmptyValue(data[f.id]))) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Answer at least one question first.",
			});
		}
		return data;
	}
	const existsInSubmissions = await existingAnswerLookup(
		db,
		row.id,
		uniquenessFields(fields),
		data
	);
	const {
		data: clean,
		errors,
		valid,
	} = validateSubmission(fields, data, { existsInSubmissions });
	if (!valid) {
		throw new TRPCError({
			cause: { fieldErrors: errors },
			code: "BAD_REQUEST",
			message: "Please fix the highlighted answers.",
		});
	}
	for (const field of fields) {
		if (field.type === "rich_text" && typeof clean[field.id] === "string") {
			clean[field.id] = sanitizeRichText(clean[field.id] as string);
		}
	}
	return clean;
}

/* ---------------------------------- Files -------------------------------- */

type SignatureRecord = Omit<typeof storedFile.$inferInsert, "submissionId">;

/** Files a submission brings along, written to storage before the row exists. */
interface PendingFiles {
	signatures: SignatureRecord[];
	uploads: string[];
}

/** Writes a drawn signature to storage; its stored_file row is added once the submission is saved. */
async function storeSignature(
	services: Services,
	row: FormRow,
	base64: string
): Promise<{ name: string; record: SignatureRecord }> {
	const name = `sign_${crypto.randomUUID()}.png`;
	const key = submissionFileKey(row.id, name);
	const bytes = Buffer.from(base64, "base64");
	await services.storage.put(key, bytes, "image/png");
	return {
		name,
		record: {
			formId: row.id,
			id: newId(),
			key,
			kind: "signature",
			mimeType: "image/png",
			originalName: "signature.png",
			size: bytes.length,
			workspaceId: row.workspaceId,
		},
	};
}

async function attachTemporaryUploads(
	db: Database,
	services: Services,
	row: FormRow,
	submissionId: string,
	names: string[]
) {
	if (names.length === 0) {
		return;
	}
	const temps = await db
		.select()
		.from(storedFile)
		.where(
			and(
				inArray(storedFile.key, names.map(tempUploadKey)),
				eq(storedFile.temporary, true)
			)
		);
	await Promise.all(
		temps.map(async (temp) => {
			const blob = await services.storage.get(temp.key);
			if (!blob) {
				return;
			}
			const target = submissionFileKey(row.id, temp.key.slice("tmp/".length));
			await services.storage.put(target, blob, temp.mimeType ?? undefined);
			await services.storage.delete(temp.key);
			await db
				.update(storedFile)
				.set({
					formId: row.id,
					key: target,
					submissionId,
					temporary: false,
					workspaceId: row.workspaceId,
				})
				.where(eq(storedFile.id, temp.id));
		})
	);
}

/** Moves temporary uploads into the form's folder and decodes drawn signatures. */
/**
 * Decodes drawn signatures into files (rewriting `data` to their names) and
 * collects the temporary uploads to attach. Nothing references the
 * submission yet: `attachFiles` links them after the row is saved, because
 * stored_file.submission_id is a foreign key.
 */
async function prepareFiles(
	services: Services,
	row: FormRow,
	fields: FormField[],
	data: Record<string, unknown>
): Promise<PendingFiles> {
	const fileFields = fields.filter(
		(f) => isFileField(f) && !isEmptyValue(data[f.id])
	);
	const pending: PendingFiles = { signatures: [], uploads: [] };
	await Promise.all(
		fileFields.map(async (field) => {
			const value = data[field.id];
			const signature =
				typeof value === "string" ? value.match(DATA_URL)?.[1] : undefined;
			if (field.type === "signature" && signature) {
				const stored = await storeSignature(services, row, signature);
				data[field.id] = stored.name;
				pending.signatures.push(stored.record);
				return;
			}
			pending.uploads.push(
				...fileList(value).filter((name) => !URL_LIKE.test(name))
			);
		})
	);
	return pending;
}

/** Links prepared files to a saved submission. */
async function attachFiles(
	db: Database,
	services: Services,
	row: FormRow,
	submissionId: string,
	pending: PendingFiles
) {
	if (pending.signatures.length > 0) {
		await db
			.insert(storedFile)
			.values(pending.signatures.map((r) => ({ ...r, submissionId })));
	}
	await attachTemporaryUploads(
		db,
		services,
		row,
		submissionId,
		pending.uploads
	);
}

/* ----------------------------- Hidden defaults --------------------------- */

async function nextAutoIncrement(
	db: Database,
	formId: string
): Promise<string> {
	const [next] = await db
		.update(form)
		.set({ autoIncrementSequence: sql`${form.autoIncrementSequence} + 1` })
		.where(eq(form.id, formId))
		.returning({ value: form.autoIncrementSequence });
	return String(next?.value ?? 1);
}

/** Fills hidden fields: static prefill, generated UUIDs and auto-increment ids. */
async function applyHiddenDefaults(
	db: Database,
	row: FormRow,
	fields: FormField[],
	data: Record<string, unknown>,
	isPartial: boolean
) {
	const empty = fields.filter((f) => isEmptyValue(data[f.id]));
	for (const field of empty) {
		if (field.generates_uuid) {
			data[field.id] = crypto.randomUUID();
		} else if (field.hidden && field.type === "date" && field.prefill_today) {
			data[field.id] = new Date().toISOString();
		} else if (
			field.hidden &&
			field.prefill !== undefined &&
			!isFileField(field)
		) {
			data[field.id] = field.prefill;
		}
	}
	if (isPartial) {
		return;
	}
	const counters = empty.filter((f) => f.generates_auto_increment_id);
	const values = await Promise.all(
		counters.map(() => nextAutoIncrement(db, row.id))
	);
	counters.forEach((field, index) => {
		data[field.id] = values[index];
	});
}

/* --------------------------------- Saving -------------------------------- */

async function findTarget(
	db: Database,
	row: FormRow,
	input: SubmitInput,
	data: Record<string, unknown>
): Promise<SubmissionRow | null> {
	if (input.submissionId) {
		const [existing] = await db
			.select()
			.from(formSubmission)
			.where(
				and(
					eq(formSubmission.formId, row.id),
					eq(formSubmission.publicId, input.submissionId)
				)
			);
		const resumable =
			row.enablePartialSubmissions && existing?.status === "partial";
		if (existing && (row.editableSubmissions || resumable)) {
			return existing;
		}
	}
	const keys = row.databaseFieldsUpdate ?? [];
	if (keys.length === 0 || keys.some((k) => isEmptyValue(data[k]))) {
		return null;
	}
	const [existing] = await db
		.select()
		.from(formSubmission)
		.where(
			and(
				eq(formSubmission.formId, row.id),
				...keys.map(
					(k) => sql`${formSubmission.data}->>${k} = ${String(data[k])}`
				)
			)
		)
		.limit(1);
	return existing ?? null;
}

async function saveSubmission(
	db: Database,
	row: FormRow,
	target: SubmissionRow | null,
	values: {
		completionTime?: number | undefined;
		data: Record<string, unknown>;
		id: string;
		meta: Record<string, unknown>;
		status: "completed" | "partial";
	}
): Promise<SubmissionRow> {
	if (target) {
		const [updated] = await db
			.update(formSubmission)
			.set({
				completionTime: values.completionTime ?? target.completionTime,
				data: row.clearEmptyFieldsOnUpdate
					? values.data
					: { ...target.data, ...values.data },
				meta: values.meta,
				// A finished submission never goes back to partial.
				status: target.status === "completed" ? "completed" : values.status,
			})
			.where(eq(formSubmission.id, target.id))
			.returning();
		if (updated) {
			return updated;
		}
	} else {
		const [inserted] = await db
			.insert(formSubmission)
			.values({ ...values, formId: row.id, publicId: newPublicId() })
			.returning();
		if (inserted) {
			return inserted;
		}
	}
	throw new TRPCError({
		code: "INTERNAL_SERVER_ERROR",
		message: "Could not save submission",
	});
}

function redirectFor(row: FormRow, data: Record<string, unknown>) {
	if (!row.redirectUrl) {
		return null;
	}
	const computed = evaluateComputedVariables(
		row.computedVariables as ComputedVariable[],
		data
	);
	// Hidden fields and computed variables are both already present in `data`
	// (applied by `applyHiddenDefaults` before this runs), so both flow into
	// the redirect's query params the same way as any other answer.
	const settings = (row.settings ?? {}) as {
		redirectKeepEmptyParams?: boolean;
	};
	return resolveRedirectUrl(row.redirectUrl, data, {
		computed,
		dropEmptyParams: !settings.redirectKeepEmptyParams,
	});
}

function buildMeta(
	row: FormRow,
	input: SubmitInput,
	target: SubmissionRow | null
) {
	const meta: Record<string, unknown> = { ...(target?.meta ?? {}) };
	const attribution = cleanAttribution(input.tracking);
	if (attribution && !target) {
		meta.attribution = attribution;
	}
	if (row.enableIpTracking && input.ip) {
		meta.ip_address = input.ip;
	}
	// Device/browser and referrer are only worth recording at the moment the
	// respondent first submits; a later edit keeps the original ones.
	if (input.userAgent && !target) {
		meta.device = parseUserAgent(input.userAgent);
	}
	if (input.referrer && !target) {
		meta.referrer = input.referrer;
	}
	return meta;
}

/** Validates and stores a public submission, then triggers integrations. */
export async function submitForm(
	db: Database,
	services: Services,
	row: FormRow,
	input: SubmitInput
): Promise<SubmitResult> {
	const fields = row.properties as FormField[];
	const isPartial = Boolean(input.isPartial && row.enablePartialSubmissions);
	const status = isPartial ? "partial" : "completed";
	const data = await validateAnswers(
		db,
		row,
		fields,
		normalizeSelectValues(fields, input.data),
		isPartial
	);

	const target = await findTarget(db, row, input, data);
	const limitReached =
		!target &&
		row.maxSubmissionsCount !== null &&
		(await completedCount(db, row.id)) >= row.maxSubmissionsCount;
	if (limitReached) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "This form no longer accepts submissions.",
		});
	}

	const id = target?.id ?? newId();
	await applyHiddenDefaults(db, row, fields, data, isPartial);
	const pendingFiles = await prepareFiles(services, row, fields, data);

	const saved = await saveSubmission(db, row, target, {
		completionTime: input.completionTime,
		data,
		id,
		meta: buildMeta(row, input, target),
		status,
	});
	await attachFiles(db, services, row, saved.id, pendingFiles);

	if (saved.status === "completed" && status === "completed") {
		// Integrations run in the background so the respondent isn't kept waiting.
		runIntegrations(db, services, row, saved).catch((error: unknown) => {
			console.error("[integrations]", error);
		});
	}
	return {
		data: saved.data,
		redirectUrl: status === "completed" ? redirectFor(row, saved.data) : null,
		status: saved.status,
		submissionId: saved.publicId,
	};
}
