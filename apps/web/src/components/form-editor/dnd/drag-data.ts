/** Shared `useDraggable`/`useSortable` `data` payloads for the editor's single DndContext. */
export type DragData =
	| { fieldId: string; type: "canvas-field" }
	| { blockId: string; type: "palette-block" }
	| { fieldId: string; type: "list-field" };

export function listItemId(fieldId: string): string {
	return `list:${fieldId}`;
}

export function canvasItemId(fieldId: string): string {
	return `canvas:${fieldId}`;
}

export function paletteItemId(blockId: string): string {
	return `palette:${blockId}`;
}

export const CANVAS_END_ID = "canvas-end";
export const CANVAS_EMPTY_ID = "canvas-empty";
