import type { Database } from "@StryveForms/db";
import { form, storedFile, workspace } from "@StryveForms/db/schema/forms";
import {
	formAvailability,
	showsFormFields,
} from "@StryveForms/forms/availability";
import type { FormField } from "@StryveForms/forms/types";
import { and, eq, isNull, or } from "drizzle-orm";

import type { Services } from "../context";
import { getMembership } from "../lib/access";
import {
	assetKey,
	assetUrl,
	canonicalFileName,
	tempUploadKey,
} from "../lib/files";
import { newId } from "../lib/ids";
import { completedCount } from "./submissions";

const MB = 1024 * 1024;
const LEADING_DOT = /^\./;
const ASSET_MAX_BYTES = 10 * MB;
const IMAGE_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
	"image/svg+xml",
	"image/avif",
]);
const MEDIA_TYPES = new Set([
	"video/mp4",
	"video/webm",
	"audio/mpeg",
	"audio/mp4",
	"audio/ogg",
	"audio/wav",
]);
const DANGEROUS_EXTENSIONS = new Set([
	"exe",
	"bat",
	"cmd",
	"com",
	"msi",
	"scr",
	"js",
	"vbs",
	"ps1",
	"sh",
	"php",
	"html",
	"htm",
]);

export class UploadError extends Error {
	readonly status: 400 | 401 | 404 | 413;

	constructor(message: string, status: 400 | 401 | 404 | 413 = 400) {
		super(message);
		this.status = status;
	}
}

function extensionOf(name: string): string {
	const dot = name.lastIndexOf(".");
	return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/**
 * Checks this person may upload to the form — the same rules the public page
 * and `public.submit` apply. They must be able to see the questions (workspace
 * members can while previewing a draft or closed form; respondents only while
 * it's open), and on a password-protected form a respondent must send the
 * right password.
 */
async function requireUploadAccess(
	db: Database,
	row: typeof form.$inferSelect,
	viewer: { password?: string | null | undefined; userId?: string | null }
): Promise<void> {
	const isMember = viewer.userId
		? (await getMembership(db, row.workspaceId, viewer.userId)) !== null
		: false;
	const completed =
		row.maxSubmissionsCount === null ? 0 : await completedCount(db, row.id);
	const availability = formAvailability({ ...row, completedCount: completed });
	if (!showsFormFields(availability, isMember)) {
		throw new UploadError("Form not found", 404);
	}
	if (!row.passwordHash || isMember) {
		return;
	}
	const unlocked = viewer.password
		? await Bun.password.verify(viewer.password, row.passwordHash)
		: false;
	if (!unlocked) {
		throw new UploadError("This form is protected by a password.", 401);
	}
}

/** Stores a respondent's file temporarily until the submission is sent. */
export async function uploadSubmissionFile(
	db: Database,
	services: Services,
	input: {
		fieldId: string;
		file: File;
		/** The form's password, required from respondents when the form has one. */
		password?: string | null;
		slug: string;
		/** The signed-in uploader, if any — lets workspace members upload while previewing. */
		userId?: string | null;
	}
) {
	const [row] = await db
		.select({ form, maxFileSize: workspace.maxFileSize })
		.from(form)
		.innerJoin(workspace, eq(workspace.id, form.workspaceId))
		.where(
			and(
				or(eq(form.slug, input.slug), eq(form.legacySlug, input.slug)),
				isNull(form.deletedAt)
			)
		)
		.limit(1);
	if (!row) {
		throw new UploadError("Form not found", 404);
	}
	await requireUploadAccess(db, row.form, input);
	const field = (row.form.properties as FormField[]).find(
		(f) => f.id === input.fieldId
	);
	if (
		!(
			field &&
			(field.type === "files" ||
				field.type === "signature" ||
				field.file_upload)
		)
	) {
		throw new UploadError("This question doesn't accept files");
	}
	const limitMb = Math.min(
		field.max_file_size ?? row.maxFileSize,
		row.maxFileSize
	);
	if (input.file.size > limitMb * MB) {
		throw new UploadError(`Files must be ${limitMb} MB or smaller`, 413);
	}
	const ext = extensionOf(input.file.name);
	const allowed = (field.allowed_file_types ?? "")
		.split(",")
		.map((t) => t.trim().toLowerCase().replace(LEADING_DOT, ""))
		.filter(Boolean);
	if (
		allowed.length > 0 ? !allowed.includes(ext) : DANGEROUS_EXTENSIONS.has(ext)
	) {
		throw new UploadError("This file type isn't allowed");
	}
	const name = canonicalFileName(input.file.name);
	const key = tempUploadKey(name);
	await services.storage.put(key, input.file, input.file.type || undefined);
	await db.insert(storedFile).values({
		formId: row.form.id,
		id: newId(),
		key,
		kind: "upload",
		mimeType: input.file.type || null,
		originalName: input.file.name,
		size: input.file.size,
		temporary: true,
		workspaceId: row.form.workspaceId,
	});
	return { name, originalName: input.file.name, size: input.file.size };
}

/** Stores an image or media file used in a form (logo, cover, image block). */
export async function uploadAsset(
	db: Database,
	services: Services,
	input: { file: File; workspaceId: string | null }
) {
	const { type } = input.file;
	if (!(IMAGE_TYPES.has(type) || MEDIA_TYPES.has(type))) {
		throw new UploadError("Please upload an image, video or audio file");
	}
	const maxBytes = MEDIA_TYPES.has(type) ? 50 * MB : ASSET_MAX_BYTES;
	if (input.file.size > maxBytes) {
		throw new UploadError(`Files must be ${maxBytes / MB} MB or smaller`, 413);
	}
	const name = canonicalFileName(input.file.name);
	await services.storage.put(assetKey(name), input.file, type);
	await db.insert(storedFile).values({
		id: newId(),
		key: assetKey(name),
		kind: "asset",
		mimeType: type,
		originalName: input.file.name,
		size: input.file.size,
		workspaceId: input.workspaceId,
	});
	return { url: assetUrl(services.config, name) };
}
