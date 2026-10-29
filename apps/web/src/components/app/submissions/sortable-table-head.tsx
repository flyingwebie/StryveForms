import { TableHead } from "@StryveForms/ui/components/table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import type { ReactNode } from "react";

/** A table header cell that can be dragged to reorder columns. */
export function SortableTableHead({
	children,
	draggable,
	id,
}: {
	children: ReactNode;
	draggable: boolean;
	id: string;
}) {
	const {
		attributes,
		isDragging,
		listeners,
		setNodeRef,
		transform,
		transition,
	} = useSortable({ disabled: !draggable, id });

	if (!draggable) {
		return <TableHead>{children}</TableHead>;
	}

	const style = {
		opacity: isDragging ? 0.6 : 1,
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<TableHead className="group/head" ref={setNodeRef} style={style}>
			<div className="flex items-center gap-1">
				<button
					aria-label={`Drag to reorder ${typeof children === "string" ? children : "column"}`}
					className="flex size-5 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground opacity-0 transition-opacity active:cursor-grabbing group-hover/head:opacity-100"
					type="button"
					{...attributes}
					{...listeners}
				>
					<GripVerticalIcon className="size-3.5" />
				</button>
				{children}
			</div>
		</TableHead>
	);
}
