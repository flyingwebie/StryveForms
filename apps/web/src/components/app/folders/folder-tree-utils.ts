export interface FolderRow {
	color: string | null;
	count: number;
	icon: string | null;
	id: string;
	name: string;
	parentId: string | null;
	position: number;
}

export interface FolderNode<T extends FolderRow = FolderRow> {
	children: FolderNode<T>[];
	row: T;
	/** This folder's own count plus every descendant's — what filtering by it includes. */
	totalCount: number;
}

/** Groups a flat, position-ordered folder list into a parent/child tree. */
export function buildFolderTree<T extends FolderRow>(
	rows: T[]
): FolderNode<T>[] {
	const byParent = new Map<string | null, T[]>();
	for (const row of rows) {
		const siblings = byParent.get(row.parentId) ?? [];
		siblings.push(row);
		byParent.set(row.parentId, siblings);
	}
	for (const siblings of byParent.values()) {
		siblings.sort((a, b) => a.position - b.position);
	}

	function build(parentId: string | null): FolderNode<T>[] {
		const children = byParent.get(parentId) ?? [];
		return children.map((row) => {
			const childNodes = build(row.id);
			const totalCount =
				row.count + childNodes.reduce((sum, c) => sum + c.totalCount, 0);
			return { children: childNodes, row, totalCount };
		});
	}

	return build(null);
}

/** Every folder id in and under `rootId` (used to filter a list by a parent folder). */
export function subtreeIds(rows: FolderRow[], rootId: string): string[] {
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

/** Is `targetId` the same as, or a descendant of, `ancestorId`? */
export function isSelfOrDescendant(
	rows: FolderRow[],
	ancestorId: string,
	targetId: string
): boolean {
	const parentById = new Map(rows.map((r) => [r.id, r.parentId]));
	let current: string | null = targetId;
	while (current) {
		if (current === ancestorId) {
			return true;
		}
		current = parentById.get(current) ?? null;
	}
	return false;
}

/** Flattens the tree back out, depth-first, with each node's nesting depth — for the parent-folder picker. */
export function flattenWithDepth<T extends FolderRow>(
	nodes: FolderNode<T>[],
	depth = 0
): { depth: number; row: T }[] {
	return nodes.flatMap((node) => [
		{ depth, row: node.row },
		...flattenWithDepth(node.children, depth + 1),
	]);
}
