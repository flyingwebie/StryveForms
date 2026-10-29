import { useDroppable } from "@dnd-kit/core";

import { CANVAS_EMPTY_ID, CANVAS_END_ID } from "../dnd/drag-data";

export function EmptyCanvasDropZone() {
	const { isOver, setNodeRef } = useDroppable({ id: CANVAS_EMPTY_ID });

	return (
		<div
			className={`col-span-12 flex min-h-32 items-center justify-center rounded-md border-2 border-dashed text-muted-foreground text-sm transition-colors ${
				isOver ? "border-primary bg-primary/5 text-primary" : "border-border"
			}`}
			ref={setNodeRef}
		>
			Drag a block here
		</div>
	);
}

/** Trailing sentinel so a palette block (or a reordered field) can be dropped past the last row. */
export function CanvasEndDropZone() {
	const { isOver, setNodeRef } = useDroppable({ id: CANVAS_END_ID });

	return (
		<div
			className={`col-span-12 h-6 rounded-md transition-colors ${
				isOver ? "bg-primary/10" : ""
			}`}
			ref={setNodeRef}
		/>
	);
}
