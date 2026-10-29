import type { Database } from "@StryveForms/db";
import { form, storedFile, workspace } from "@StryveForms/db/schema/forms";
import type { FormField } from "@StryveForms/forms/types";
import { and, eq, isNull, or } from "drizzle-orm";

import type { Services } from "../context";
import {
	assetKey,
	assetUrl,
	canonicalFileName,
	tempUploadKey,
} from "../lib/files";
import { newId } from "../lib/ids";

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
	readonly status: 400 | 404 | 413;

	constructor(message: string, status: 400 | 404 | 413 = 400) {
		super(message);
		this.status = status;
	}
}

function extensionOf(name: string): string {
	const dot = name.lastIndexOf(".");
	return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Stores a respondent's file temporarily until the submission is sent. */
export async function uploadSubmissionFile(
	db: Database,
	services: Services,
	input: { fieldId: string; file: File; slug: string }
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
	if (row?.form.visibility !== "public") {
		throw new UploadError("Form not found", 404);
	}
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
