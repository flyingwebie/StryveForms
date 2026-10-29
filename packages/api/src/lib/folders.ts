import type { Database } from "@StryveForms/db";
import { folder } from "@StryveForms/db/schema/forms";
import { and, eq } from "drizzle-orm";

export interface FolderParentRow {
	id: string;
	parentId: string | null;
}

/**
 * Pure tree walk: `rootId` plus every folder nested under it, given the
 * flat (id, parentId) rows of a workspace+kind. Split out from
 * `folderSubtreeIds` so the traversal itself is unit-testable without a DB.
 */
export function computeSubtreeIds(
	rows: FolderParentRow[],
	rootId: string
): string[] {
	const childrenOf = new Map<string, string[]>();
	for (const row of rows) {
		if (row.parentId) {
			const list = childrenOf.get(row.parentId) ?? [];
			list.push(row.id);
			childrenOf.set(row.parentId, list);
		}
	}
	const ids: string[] = [];
	const stack = [rootId];
	while (stack.length > 0) {
		const id = stack.pop();
		if (!id) {
			continue;
		}
		ids.push(id);
		stack.push(...(childrenOf.get(id) ?? []));
	}
	return ids;
}

/**
 * `rootId` plus every folder nested under it, so filtering a list by a
 * parent folder also picks up items filed in its subfolders.
 */
export async function folderSubtreeIds(
	db: Database,
	workspaceId: string,
	kind: "form" | "template",
	rootId: string
): Promise<string[]> {
	const rows = await db
		.select({ id: folder.id, parentId: folder.parentId })
		.from(folder)
		.where(and(eq(folder.workspaceId, workspaceId), eq(folder.kind, kind)));
	return computeSubtreeIds(rows, rootId);
}
