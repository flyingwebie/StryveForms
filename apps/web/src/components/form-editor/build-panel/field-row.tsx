import { blockForField, getBlock } from "@StryveForms/forms/blocks";
import { usesFieldWidths } from "@StryveForms/forms/presentation";
import type { FormField } from "@StryveForms/forms/types";
import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	CircleDashedIcon,
	CopyIcon,
	EyeIcon,
	EyeOffIcon,
	GripVerticalIcon,
	MoreHorizontalIcon,
	Trash2Icon,
} from "lucide-react";

import { listItemId } from "../dnd/drag-data";
import { DropLine } from "../dnd/drop-line";
import { useCanvasDrag } from "../dnd/editor-dnd-provider";
import { BlockIcon } from "../shared/block-icon";
import { useEditor } from "../state/editor-context";

/** Row badges summarising a field's state: its width (non-full), required, logic and hidden flags. */
function fieldRowBadges(
	field: FormField,
	presentationStyle: Parameters<typeof usesFieldWidths>[0]
): { label: string; variant: "neutral" | "soft" }[] {
	const badges: { label: string; variant: "neutral" | "soft" }[] = [];
	if (
		usesFieldWidths(presentationStyle) &&
		field.width &&
		field.width !== "full"
	) {
		badges.push({ label: field.width, variant: "neutral" });
	}
	if (field.required) {
		badges.push({ label: "Required", variant: "neutral" });
	}
	if (field.logic) {
		badges.push({ label: "Logic", variant: "soft" });
	}
	if (field.hidden) {
		badges.push({ label: "Hidden", variant: "neutral" });
	}
	return badges;
}

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

	const badges = fieldRowBadges(field, state.settings.presentationStyle);

	return (
		<div
			className={`relative flex items-center gap-1.5 rounded-md p-2 text-xs transition-colors ${
				selected ? "bg-primary-soft" : "hover:bg-muted/50"
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
					className="size-4 shrink-0 text-muted-foreground"
					name={block?.icon ?? "FormInput"}
				/>
				<span className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
					<span className="min-w-0 truncate font-medium text-foreground text-sm">
						{field.name}
					</span>
					{badges.length > 0 ? (
						<span className="flex flex-wrap items-center gap-1">
							{badges.map((badge) => (
								<Badge key={badge.label} variant={badge.variant}>
									{badge.label}
								</Badge>
							))}
						</span>
					) : null}
				</span>
			</button>
			{readOnly ? null : (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button size="icon-xs" type="button" variant="ghost" />}
					>
						<MoreHorizontalIcon />
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuItem
							onClick={() => updateField(field.id, { hidden: !field.hidden })}
						>
							{field.hidden ? <EyeIcon /> : <EyeOffIcon />}
							{field.hidden ? "Show field" : "Hide field"}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() =>
								updateField(field.id, { required: !field.required })
							}
						>
							<CircleDashedIcon />
							{field.required ? "Make optional" : "Make required"}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => duplicateField(field.id)}>
							<CopyIcon /> Duplicate
						</DropdownMenuItem>
						<DropdownMenuSeparator />
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
