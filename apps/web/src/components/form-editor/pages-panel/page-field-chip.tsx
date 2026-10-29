import { blockForField, getBlock } from "@StryveForms/forms/blocks";
import type { FormField } from "@StryveForms/forms/types";
import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import {
	GripVerticalIcon,
	MoreVerticalIcon,
	ScissorsIcon,
	SendToBackIcon,
} from "lucide-react";
import { useState } from "react";
import { BlockIcon } from "../shared/block-icon";
import { useEditor } from "../state/editor-context";
import type { EditorPage } from "./pages-model";

/** The `dataTransfer` MIME type used to carry a field id across a native HTML5 drag between page cards. */
export const FIELD_DRAG_TYPE = "application/x-stryveforms-field-id";

/**
 * One field row inside a page card: drag it onto another page card (or
 * another chip) to move it there, or use the menu — "Move to page" works
 * the same without a mouse. This is a plain HTML5 drag (not the dnd-kit
 * `DndContext` the Build tab/canvas share), so it can live inside the same
 * tab without a second, conflicting drag system.
 */
export function PageFieldChip({
	canSplit,
	field,
	isLast,
	onDropOnField,
	onMoveToPage,
	onSplitAfter,
	pageIndex,
	pages,
	readOnly,
}: {
	/** False for an implicit page (one question each — nothing to split). */
	canSplit: boolean;
	field: FormField;
	/** True when this is the last field in its page (splitting after it would do nothing). */
	isLast: boolean;
	onDropOnField: (draggedFieldId: string, targetFieldId: string) => void;
	onMoveToPage: (fieldId: string, targetPageIndex: number) => void;
	onSplitAfter: (fieldId: string) => void;
	pageIndex: number;
	pages: EditorPage[];
	readOnly?: boolean;
}) {
	const { select, state } = useEditor();
	const block = blockForField(field) ?? getBlock(field.type);
	const selected = state.selectedFieldId === field.id;
	const [dropTarget, setDropTarget] = useState(false);
	let rowClass = "border-transparent hover:bg-muted/50";
	if (dropTarget) {
		rowClass = "border-primary bg-primary/10";
	} else if (selected) {
		rowClass = "border-primary bg-primary/5";
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: native HTML5 drag/drop target — the row's own content (name button, menu) stays independently operable
		// biome-ignore lint/a11y/noNoninteractiveElementInteractions: same as above
		<div
			className={`group relative flex items-center gap-1.5 rounded-lg border p-1.5 text-xs transition-colors ${rowClass}`}
			draggable={!readOnly}
			onDragLeave={() => setDropTarget(false)}
			onDragOver={(e) => {
				if (readOnly) {
					return;
				}
				e.preventDefault();
				setDropTarget(true);
			}}
			onDragStart={(e) => {
				e.dataTransfer.setData(FIELD_DRAG_TYPE, field.id);
				e.dataTransfer.effectAllowed = "move";
			}}
			onDrop={(e) => {
				e.preventDefault();
				e.stopPropagation();
				setDropTarget(false);
				if (readOnly) {
					return;
				}
				const draggedId = e.dataTransfer.getData(FIELD_DRAG_TYPE);
				if (draggedId && draggedId !== field.id) {
					onDropOnField(draggedId, field.id);
				}
			}}
		>
			<GripVerticalIcon className="size-3.5 shrink-0 cursor-grab text-muted-foreground" />
			<button
				className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
				onClick={() => select(field.id)}
				type="button"
			>
				<BlockIcon
					className="size-3.5 shrink-0"
					name={block?.icon ?? "FormInput"}
				/>
				<span className="min-w-0 flex-1 truncate">{field.name}</span>
			</button>
			{readOnly ? null : (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button size="icon-xs" type="button" variant="ghost" />}
					>
						<MoreVerticalIcon className="size-3.5" />
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>
								<SendToBackIcon /> Move to page
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								{pages.map((target, i) =>
									i === pageIndex ? null : (
										<DropdownMenuItem
											key={target.key}
											onClick={() => onMoveToPage(field.id, i)}
										>
											Page {i + 1}
										</DropdownMenuItem>
									)
								)}
							</DropdownMenuSubContent>
						</DropdownMenuSub>
						{canSplit && !isLast ? (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => onSplitAfter(field.id)}>
									<ScissorsIcon /> Split page after this field
								</DropdownMenuItem>
							</>
						) : null}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}
