import { blockForField, getBlock } from "@StryveForms/forms/blocks";
import { usesFieldWidths } from "@StryveForms/forms/presentation";
import type { FormField } from "@StryveForms/forms/types";
import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	CopyIcon,
	EyeIcon,
	EyeOffIcon,
	GripVerticalIcon,
	MoreVerticalIcon,
	Trash2Icon,
} from "lucide-react";

import { listItemId } from "../dnd/drag-data";
import { DropLine } from "../dnd/drop-line";
import { useCanvasDrag } from "../dnd/editor-dnd-provider";
import { BlockIcon } from "../shared/block-icon";
import { useEditor } from "../state/editor-context";

export function FieldRow({ field }: { field: FormField }) {
	const { duplicateField, readOnly, removeField, select, state, updateField } =
		useEditor();
	const block = blockForField(field) ?? getBlock(field.type);
	const selected = state.selectedFieldId === field.id;
	const itemId = listItemId(field.id);
	const { dropIndicator, overId } = useCanvasDrag();
	const {
		attributes,
		isDragging,
		listeners,
		setNodeRef,
		transform,
		transition,
	} = useSortable({
		data: { fieldId: field.id, type: "list-field" },
		id: itemId,
	});
	const isDropTarget = overId === itemId && !isDragging;

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			className={`relative flex items-center gap-1.5 border p-2 text-xs transition-colors ${
				selected
					? "border-primary bg-primary/5"
					: "border-transparent hover:bg-muted/50"
			}`}
			ref={setNodeRef}
			style={style}
		>
			{isDropTarget && dropIndicator ? (
				<DropLine indicator={dropIndicator} />
			) : null}
			<button
				className="cursor-grab text-muted-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
				disabled={readOnly}
				type="button"
				{...attributes}
				{...(readOnly ? {} : listeners)}
			>
				<GripVerticalIcon className="size-4" />
			</button>
			<button
				className="flex min-w-0 flex-1 items-center gap-2 text-left"
				onClick={() => select(field.id)}
				type="button"
			>
				<BlockIcon
					className="size-4 shrink-0"
					name={block?.icon ?? "FormInput"}
				/>
				<span className="min-w-0 flex-1 truncate">{field.name}</span>
				{usesFieldWidths(state.settings.presentationStyle) &&
				field.width &&
				field.width !== "full" ? (
					<Badge className="shrink-0" variant="outline">
						{field.width}
					</Badge>
				) : null}
				{field.required ? (
					<Badge className="shrink-0" variant="outline">
						Required
					</Badge>
				) : null}
				{field.logic ? (
					<Badge className="shrink-0" variant="secondary">
						Logic
					</Badge>
				) : null}
				{field.hidden ? (
					<Badge className="shrink-0" variant="outline">
						Hidden
					</Badge>
				) : null}
			</button>
			{readOnly ? null : (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button size="icon-xs" type="button" variant="ghost" />}
					>
						<MoreVerticalIcon />
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuItem
							onClick={() => updateField(field.id, { hidden: !field.hidden })}
						>
							{field.hidden ? <EyeIcon /> : <EyeOffIcon />}
							{field.hidden ? "Show" : "Hide"}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() =>
								updateField(field.id, { required: !field.required })
							}
						>
							{field.required ? "Make optional" : "Make required"}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => duplicateField(field.id)}>
							<CopyIcon /> Duplicate
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => removeField(field.id)}
							variant="destructive"
						>
							<Trash2Icon /> Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}
