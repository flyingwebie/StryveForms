/**
 * The workspace's "Library" tab in the shared `ImagePicker`: previously
 * uploaded images (kind "asset"), newest first. Membership is checked by
 * the caller (routers/media.ts, via `requireWorkspace`) — this is a plain
 * read, no access logic of its own.
 */

import type { Database } from "@StryveForms/db";
import { storedFile } from "@StryveForms/db/schema/forms";
import { and, desc, eq, like } from "drizzle-orm";

import type { AppConfig } from "../../context";
import { assetUrl } from "../../lib/files";

const ASSETS_PREFIX = "assets/";
const LIBRARY_PAGE_SIZE = 60;

export interface LibraryImage {
	createdAt: Date;
	id: string;
	name: string;
	url: string;
}

/** Strips the `assets/` storage-key prefix back to the canonical file name `assetUrl` expects. */
export function fileNameOf(key: string): string {
	return key.startsWith(ASSETS_PREFIX) ? key.slice(ASSETS_PREFIX.length) : key;
}

/** Maps one `stored_file` row to the picker's `LibraryImage` shape — exported so it's testable without a database. */
export function toLibraryImage(
	row: { createdAt: Date; id: string; key: string; originalName: string },
	config: AppConfig
): LibraryImage {
	return {
		createdAt: row.createdAt,
		id: row.id,
		name: row.originalName,
		url: assetUrl(config, fileNameOf(row.key)),
	};
}

/** The most recent image assets uploaded to this workspace (any tab's "Upload" writes here too). */
export async function listWorkspaceLibrary(
	db: Database,
	config: AppConfig,
	workspaceId: string
): Promise<LibraryImage[]> {
	const rows = await db
		.select({
			createdAt: storedFile.createdAt,
			id: storedFile.id,
			key: storedFile.key,
			originalName: storedFile.originalName,
		})
		.from(storedFile)
		.where(
			and(
				eq(storedFile.workspaceId, workspaceId),
				eq(storedFile.kind, "asset"),
				like(storedFile.mimeType, "image/%")
			)
		)
		.orderBy(desc(storedFile.createdAt))
		.limit(LIBRARY_PAGE_SIZE);
	return rows.map((row) => toLibraryImage(row, config));
}
