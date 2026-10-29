import { Button } from "@StryveForms/ui/components/button";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	ChevronDownIcon,
	ChevronUpIcon,
	GripVerticalIcon,
	RotateCcwIcon,
} from "lucide-react";

export interface ColumnOrderItem {
	/** Column id (field id, or "createdAt"/"status"). */
	id: string;
	label: string;
	visible: boolean;
}

function Row({
	isFirst,
	isLast,
	item,
	onMove,
	onToggle,
}: {
	isFirst: boolean;
	isLast: boolean;
	item: ColumnOrderItem;
	onMove: (id: string, direction: -1 | 1) => void;
	onToggle: (id: string, visible: boolean) => void;
}) {
	const {
		attributes,
		isDragging,
		listeners,
		setNodeRef,
		transform,
		transition,
	} = useSortable({ id: item.id });
	const style = {
		opacity: isDragging ? 0.6 : 1,
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			className="flex items-center gap-1 rounded-lg px-1 py-0.5 hover:bg-muted"
			ref={setNodeRef}
			style={style}
		>
			<button
				aria-label={`Drag to reorder ${item.label}`}
				className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
				type="button"
				{...attributes}
				{...listeners}
			>
				<GripVerticalIcon className="size-4" />
			</button>
			<Checkbox
				checked={item.visible}
				onCheckedChange={(value) => onToggle(item.id, value === true)}
			/>
			<span className="flex-1 truncate text-sm">{item.label}</span>
			<div className="flex shrink-0 items-center">
				<Button
					aria-label={`Move ${item.label} up`}
					disabled={isFirst}
					onClick={() => onMove(item.id, -1)}
					size="icon-sm"
					variant="ghost"
				>
					<ChevronUpIcon />
				</Button>
				<Button
					aria-label={`Move ${item.label} down`}
					disabled={isLast}
					onClick={() => onMove(item.id, 1)}
					size="icon-sm"
					variant="ghost"
				>
					<ChevronDownIcon />
				</Button>
			</div>
		</div>
	);
}

/**
 * Columns menu content: drag handles (or the up/down arrows, for keyboard
 * and touch users) to reorder, checkboxes to show/hide, and a reset.
 */
export function ColumnOrderMenu({
	items,
	onReorder,
	onReset,
	onToggleVisibility,
}: {
	items: ColumnOrderItem[];
	onReorder: (order: string[]) => void;
	onReset: () => void;
	onToggleVisibility: (id: string, visible: boolean) => void;
}) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) {
			return;
		}
		const ids = items.map((item) => item.id);
		const from = ids.indexOf(String(active.id));
		const to = ids.indexOf(String(over.id));
		if (from === -1 || to === -1) {
			return;
		}
		onReorder(arrayMove(ids, from, to));
	};

	const move = (id: string, direction: -1 | 1) => {
		const ids = items.map((item) => item.id);
		const index = ids.indexOf(id);
		const next = index + direction;
		if (index === -1 || next < 0 || next >= ids.length) {
			return;
		}
		onReorder(arrayMove(ids, index, next));
	};

	return (
		<div className="w-64 space-y-2">
			<p className="text-muted-foreground text-xs">
				Drag, or use the arrows, to reorder columns. This also reorders the CSV
				export and the submission detail view.
			</p>
			<DndContext
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}
				sensors={sensors}
			>
				<SortableContext
					items={items.map((item) => item.id)}
					strategy={verticalListSortingStrategy}
				>
					<div className="max-h-72 space-y-0.5 overflow-y-auto">
						{items.map((item, index) => (
							<Row
								isFirst={index === 0}
								isLast={index === items.length - 1}
								item={item}
								key={item.id}
								onMove={move}
								onToggle={onToggleVisibility}
							/>
						))}
					</div>
				</SortableContext>
			</DndContext>
			<div className="border-border border-t pt-2">
				<Button
					className="w-full justify-start"
					onClick={onReset}
					size="sm"
					variant="ghost"
				>
					<RotateCcwIcon /> Reset to default order
				</Button>
			</div>
		</div>
	);
}
