import type { MouseEvent } from "react";
import { useRef, useState } from "react";

/**
 * Checkbox selection over an ordered list, with shift-click range select and
 * select-all. `items` is the currently visible, filtered/sorted list — the
 * same order the checkboxes are rendered in.
 */
export function useBulkSelection<T extends { id: string }>(items: T[]) {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const lastClickedIndexRef = useRef<number | null>(null);

	function toggle(item: T, index: number, event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		setSelectedIds((prev) => {
			const next = new Set(prev);
			const last = lastClickedIndexRef.current;
			if (event.shiftKey && last !== null) {
				const start = Math.min(last, index);
				const end = Math.max(last, index);
				for (let i = start; i <= end; i += 1) {
					const target = items[i];
					if (target) {
						next.add(target.id);
					}
				}
			} else if (next.has(item.id)) {
				next.delete(item.id);
			} else {
				next.add(item.id);
			}
			return next;
		});
		lastClickedIndexRef.current = index;
	}

	function toggleAll() {
		setSelectedIds((prev) =>
			prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))
		);
	}

	function clear() {
		setSelectedIds(new Set());
	}

	const allSelected =
		items.length > 0 && items.every((item) => selectedIds.has(item.id));

	return { allSelected, clear, selectedIds, toggle, toggleAll };
}
