import { blockForField, getBlock } from "@StryveForms/forms/blocks";
import type { FormField } from "@StryveForms/forms/types";
import {
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";
import { BlockIcon } from "../shared/block-icon";
import { useEditor } from "../state/editor-context";
import { CANVAS_EMPTY_ID, CANVAS_END_ID, type DragData } from "./drag-data";
import {
	type DropIndicator,
	insertionIndex,
	resolveDropPosition,
} from "./drop-position";

interface CanvasDragState {
	activeFieldId: string | null;
	/** Where, relative to `overId`, the drag will land if dropped now. */
	dropIndicator: DropIndicator | null;
	overId: string | null;
}

const CanvasDragContext = createContext<CanvasDragState>({
	activeFieldId: null,
	dropIndicator: null,
	overId: null,
});

/** Lets a canvas/list block know whether it's the one being dragged, or the current drop target. */
export function useCanvasDrag(): CanvasDragState {
	return useContext(CanvasDragContext);
}

function dataOf(
	entity: { data: { current?: unknown } } | null | undefined
): DragData | undefined {
	return entity?.data.current as DragData | undefined;
}

/** The field id a `list-field` / `canvas-field` drag entity carries, or `undefined` for anything else. */
function fieldIdOf(data: DragData | undefined): string | undefined {
	return data && data.type !== "palette-block" ? data.fieldId : undefined;
}

/**
 * Where the drag would land relative to `over`, from the dragged element's
 * live rect vs. the hovered block's rect — `null` when either rect isn't
 * measured yet (e.g. the very first frame of a drag).
 */
function dropIndicatorFor(
	active: DragOverEvent["active"] | DragEndEvent["active"],
	over: DragOverEvent["over"] | DragEndEvent["over"]
): DropIndicator | null {
	const activeRect = active.rect.current.translated;
	if (!(activeRect && over)) {
		return null;
	}
	return resolveDropPosition(activeRect, over.rect);
}

function OverlayGhost({
	field,
	blockId,
}: {
	blockId?: string;
	field?: FormField;
}) {
	const block = field
		? (blockForField(field) ?? getBlock(field.type))
		: getBlock(blockId ?? "");
	const label = field?.name ?? block?.title ?? "Block";
	return (
		<div className="flex items-center gap-2 rounded-md border border-primary bg-background px-3 py-2 text-xs shadow-lg">
			<BlockIcon
				className="size-4 shrink-0 text-primary"
				name={block?.icon ?? "FormInput"}
			/>
			<span className="truncate font-medium">{label}</span>
		</div>
	);
}

/**
 * Single DndContext for the whole editor: the left Build list, the block
 * palette, and the canvas all register their draggables/droppables here so a
 * palette block (or a list row) can be dropped straight onto the canvas.
 * Ids are namespaced per origin (`list:`, `canvas:`, `palette:`) so the same
 * field can be represented by both a list row and a canvas block at once.
 */
export function EditorDndProvider({ children }: { children: ReactNode }) {
	const { addBlockAt, closeAddBlockPanel, moveField, moveFieldToEnd, state } =
		useEditor();
	const properties = state.settings.properties as FormField[];
	const [activeData, setActiveData] = useState<DragData | null>(null);
	const [overId, setOverId] = useState<string | null>(null);
	const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(
		null
	);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);

	function handleDragStart(event: DragStartEvent) {
		setActiveData(dataOf(event.active) ?? null);
	}

	function handleDragOver(event: DragOverEvent) {
		setOverId(event.over ? String(event.over.id) : null);
		setDropIndicator(dropIndicatorFor(event.active, event.over));
	}

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		const indicator = dropIndicatorFor(active, over);
		setActiveData(null);
		setOverId(null);
		setDropIndicator(null);
		if (!over) {
			return;
		}
		const activeInfo = dataOf(active);
		const overInfo = dataOf(over);
		if (!activeInfo) {
			return;
		}

		if (activeInfo.type === "palette-block") {
			const overFieldId = fieldIdOf(overInfo);
			let index = properties.length;
			if (overFieldId !== undefined) {
				const overIndex = properties.findIndex((f) => f.id === overFieldId);
				index = insertionIndex(overIndex, indicator?.position ?? "after", -1);
			}
			addBlockAt(activeInfo.blockId, index);
			closeAddBlockPanel();
			return;
		}

		// A list row or a canvas block was dragged.
		const activeFieldId = activeInfo.fieldId;
		const overFieldId = fieldIdOf(overInfo);
		if (overFieldId !== undefined) {
			if (activeFieldId !== overFieldId) {
				moveField(activeFieldId, overFieldId, indicator?.position ?? "after");
			}
			return;
		}
		if (over.id === CANVAS_END_ID || over.id === CANVAS_EMPTY_ID) {
			moveFieldToEnd(activeFieldId);
		}
	}

	const activeField = useMemo(() => {
		if (!activeData || activeData.type === "palette-block") {
			return null;
		}
		return properties.find((f) => f.id === activeData.fieldId) ?? null;
	}, [activeData, properties]);

	const dragState = useMemo<CanvasDragState>(
		() => ({
			activeFieldId:
				activeData && activeData.type !== "palette-block"
					? activeData.fieldId
					: null,
			dropIndicator,
			overId,
		}),
		[activeData, dropIndicator, overId]
	);

	return (
		<DndContext
			onDragEnd={handleDragEnd}
			onDragOver={handleDragOver}
			onDragStart={handleDragStart}
			sensors={sensors}
		>
			<CanvasDragContext.Provider value={dragState}>
				{children}
			</CanvasDragContext.Provider>
			<DragOverlay>
				{activeData ? (
					<OverlayGhost
						blockId={
							activeData.type === "palette-block"
								? activeData.blockId
								: undefined
						}
						field={activeField ?? undefined}
					/>
				) : null}
			</DragOverlay>
		</DndContext>
	);
}
