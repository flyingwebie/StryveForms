import {
	BLOCKS,
	type BlockDefinition,
	type PresentationStyle,
} from "@StryveForms/forms/blocks";
import { useDroppable } from "@dnd-kit/core";
import { LayoutGridIcon } from "lucide-react";
import { CANVAS_EMPTY_ID, CANVAS_END_ID } from "../dnd/drag-data";
import { BlockIcon } from "../shared/block-icon";
import { useEditor } from "../state/editor-context";

/** A handful of common blocks offered as one-click starters on an empty form. */
const QUICK_START_IDS = ["text", "email", "multi_select", "rating", "date"];

function quickStartBlocks(
	presentationStyle: PresentationStyle
): BlockDefinition[] {
	const result: BlockDefinition[] = [];
	for (const id of QUICK_START_IDS) {
		const block = BLOCKS.find((b) => b.id === id);
		if (block?.availableIn.includes(presentationStyle)) {
			result.push(block);
		}
	}
	return result;
}

function QuickStartBlocks() {
	const { addBlockAt, readOnly, state } = useEditor();
	if (readOnly) {
		return null;
	}
	const blocks = quickStartBlocks(state.settings.presentationStyle);

	return (
		<div className="mt-4 flex flex-wrap justify-center gap-2">
			{blocks.map((block) => (
				<button
					className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors hover:border-primary hover:bg-primary-soft"
					key={block.id}
					onClick={() => addBlockAt(block.id, state.settings.properties.length)}
					type="button"
				>
					<BlockIcon
						className="size-3.5 text-muted-foreground"
						name={block.icon}
					/>
					{block.title}
				</button>
			))}
		</div>
	);
}

export function EmptyCanvasDropZone() {
	const { isOver, setNodeRef } = useDroppable({ id: CANVAS_EMPTY_ID });

	return (
		<div className="col-span-12 flex flex-col items-center">
			<div
				className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
					isOver ? "border-primary bg-primary-soft" : "border-border"
				}`}
				ref={setNodeRef}
			>
				<div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
					<LayoutGridIcon className="size-5" />
				</div>
				<p className="font-semibold text-sm">Drag a block here</p>
				<p className="text-muted-foreground text-xs">
					or choose a quick start below
				</p>
			</div>
			<QuickStartBlocks />
		</div>
	);
}

/** Trailing sentinel so a palette block (or a reordered field) can be dropped past the last row. */
export function CanvasEndDropZone() {
	const { isOver, setNodeRef } = useDroppable({ id: CANVAS_END_ID });

	return (
		<div
			className={`col-span-12 h-6 rounded-md transition-colors ${
				isOver ? "bg-primary-soft" : ""
			}`}
			ref={setNodeRef}
		/>
	);
}
