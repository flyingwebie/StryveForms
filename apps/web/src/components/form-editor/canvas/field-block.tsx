import { usesFieldWidths } from "@StryveForms/forms/presentation";
import type { FieldWidth, FormField } from "@StryveForms/forms/types";
import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	CopyIcon,
	EyeOffIcon,
	GripVerticalIcon,
	PlusIcon,
	SettingsIcon,
	Trash2Icon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FieldRendererProps } from "@/components/form-renderer/field-renderer";
import { FieldRenderer } from "@/components/form-renderer/field-renderer";
import { widthClassFor } from "@/components/form-renderer/field-wrapper";
import { canvasItemId } from "../dnd/drag-data";
import { DropLine } from "../dnd/drop-line";
import { useCanvasDrag } from "../dnd/editor-dnd-provider";
import { BlockIcon } from "../shared/block-icon";
import { useEditor } from "../state/editor-context";
import {
	nearestAllowedSpan,
	nextWidth,
	SPAN_BY_WIDTH,
	widthForSpan,
	widthLabel,
} from "./width-utils";

type RendererBase = Pick<
	FieldRendererProps,
	| "borderRadius"
	| "formSlug"
	| "presentation"
	| "size"
	| "theme"
	| "uppercaseLabels"
>;

/**
 * Right-edge drag handle: steps `field.width` between the renderer's allowed
 * spans. Reports the live snapped width on every move (not just on release)
 * so the field itself — and its 12-col neighbours — visibly resize/reflow
 * while the pointer is still down; the model only commits on release.
 */
function ResizeHandle({
	field,
	onResizing,
	readOnly,
}: {
	field: FormField;
	onResizing: (width: FieldWidth | null) => void;
	readOnly: boolean;
}) {
	const { updateField } = useEditor();
	const liveSpanRef = useRef(SPAN_BY_WIDTH[field.width ?? "full"]);

	function startResize(e: React.PointerEvent) {
		if (readOnly) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		const blockEl = (e.currentTarget as HTMLElement).closest(
			"[data-field-block]"
		) as HTMLElement | null;
		if (!blockEl) {
			return;
		}
		const rect = blockEl.getBoundingClientRect();
		const startSpan = SPAN_BY_WIDTH[field.width ?? "full"];
		const pxPerCol = rect.width / startSpan;
		const startX = e.clientX;
		liveSpanRef.current = startSpan;
		onResizing(field.width ?? "full");

		function onMove(ev: PointerEvent) {
			const deltaCols = Math.round((ev.clientX - startX) / pxPerCol);
			const estimate = Math.max(3, Math.min(12, startSpan + deltaCols));
			const snapped = nearestAllowedSpan(estimate);
			if (snapped === liveSpanRef.current) {
				return;
			}
			liveSpanRef.current = snapped;
			onResizing(widthForSpan(snapped));
		}
		function onUp() {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			updateField(field.id, { width: widthForSpan(liveSpanRef.current) });
			onResizing(null);
		}
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	}

	if (readOnly) {
		return null;
	}
	return (
		<div
			className="absolute inset-y-0 right-0 z-10 flex w-2.5 cursor-col-resize items-center justify-center opacity-0 group-hover:opacity-100"
			onPointerDown={startResize}
		>
			<div className="h-8 w-1 rounded-full bg-border" />
		</div>
	);
}

function BlockToolbar({
	dragAttributes,
	dragListeners,
	field,
	showWidth,
	visible,
}: {
	dragAttributes: ReturnType<typeof useSortable>["attributes"];
	dragListeners: ReturnType<typeof useSortable>["listeners"];
	field: FormField;
	/** False in Focused forms, where every question is full width. */
	showWidth: boolean;
	visible: boolean;
}) {
	const { duplicateField, removeField, select, updateField } = useEditor();

	return (
		<div
			className={`absolute -top-3 left-2 z-10 flex items-center gap-0.5 rounded-lg bg-foreground p-1 text-background shadow-md transition-opacity ${
				visible ? "opacity-100" : "opacity-0 group-hover:opacity-100"
			}`}
		>
			<button
				aria-label="Drag to reorder"
				className="cursor-grab px-1 opacity-80 active:cursor-grabbing"
				type="button"
				{...dragAttributes}
				{...dragListeners}
			>
				<GripVerticalIcon className="size-3.5" />
			</button>
			{showWidth ? (
				<Button
					className="text-background hover:bg-background/20 hover:text-background"
					onClick={() =>
						updateField(field.id, { width: nextWidth(field.width ?? "full") })
					}
					size="icon-xs"
					title={`Width: ${widthLabel(field.width ?? "full")}. Click to change.`}
					type="button"
					variant="ghost"
				>
					<span className="text-[10px]">
						{widthLabel(field.width ?? "full")}
					</span>
				</Button>
			) : null}
			<Button
				className="text-background hover:bg-background/20 hover:text-background"
				onClick={() => select(field.id)}
				size="icon-xs"
				title="Settings"
				type="button"
				variant="ghost"
			>
				<SettingsIcon />
			</Button>
			<Button
				className="text-background hover:bg-background/20 hover:text-background"
				onClick={() => duplicateField(field.id)}
				size="icon-xs"
				title="Duplicate"
				type="button"
				variant="ghost"
			>
				<CopyIcon />
			</Button>
			<Button
				className="text-background hover:bg-background/20 hover:text-background"
				onClick={() => removeField(field.id)}
				size="icon-xs"
				title="Delete"
				type="button"
				variant="ghost"
			>
				<Trash2Icon />
			</Button>
		</div>
	);
}

export function FieldBlock({
	disabled,
	effectiveHidden,
	field,
	mentionValues,
	onChange,
	onInsertAfter,
	rendererBase,
	required,
	value,
}: {
	disabled: boolean;
	effectiveHidden: boolean;
	field: FormField;
	mentionValues: Record<string, unknown>;
	onChange: (value: unknown) => void;
	/** Opens the add-block panel pre-targeted to insert right after this field — the "+" shown on hover, between blocks. */
	onInsertAfter?: () => void;
	rendererBase: RendererBase;
	required: boolean;
	value: unknown;
}) {
	const { readOnly, select, state } = useEditor();
	const { dropIndicator, overId } = useCanvasDrag();
	const itemId = canvasItemId(field.id);
	const {
		attributes,
		isDragging,
		listeners,
		setNodeRef,
		transform,
		transition,
	} = useSortable({
		data: { fieldId: field.id, type: "canvas-field" },
		id: itemId,
	});
	const [liveWidth, setLiveWidth] = useState<FieldWidth | null>(null);

	const selected = state.selectedFieldId === field.id;
	const blockRef = useRef<HTMLDivElement | null>(null);
	// Bring the block into view when it becomes selected (newly added, or
	// picked from the Build list), without jumping if it's already visible.
	useEffect(() => {
		if (selected) {
			blockRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "nearest",
			});
		}
	}, [selected]);
	const isDropTarget = overId === itemId && !isDragging;
	const isPageBreak = field.type === "nf-page-break";
	const showWidth =
		usesFieldWidths(state.settings.presentationStyle) && !isPageBreak;
	const widthClass = showWidth
		? widthClassFor(liveWidth ?? field.width)
		: "col-span-12";

	const style = {
		opacity: isDragging ? 0.4 : 1,
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			// Resizing: `widthClassFor(liveWidth ?? field.width)` makes the span
			// (and so the 12-col reflow of every neighbour) update on every
			// snapped step while dragging, not just once on release. The
			// transition animates each snap, including the final commit.
			className={`${widthClass} group relative transition-all duration-150 ease-out`}
			data-field-block
			ref={(node) => {
				setNodeRef(node);
				blockRef.current = node;
			}}
			style={style}
		>
			{/*
			 * A real <button> can't wrap this: some field renderers (select,
			 * date, etc.) render their own interactive <button>s, and nested
			 * buttons are invalid HTML. The div is still keyboard-operable
			 * (role="button", tabIndex, Enter/Space) and its content stays
			 * non-interactive via `pointer-events-none` below.
			 */}
			{/* biome-ignore lint/a11y/useSemanticElements: a <button> here would nest inside field renderers that are themselves buttons (select, date, …), which is invalid HTML */}
			<div
				aria-label={`Select ${field.name}`}
				className={`flex w-full flex-col rounded-lg border-2 p-2 text-left transition-colors ${
					selected ? "border-primary" : "border-transparent hover:border-border"
				} ${effectiveHidden ? "opacity-50" : ""}`}
				onClick={() => select(field.id)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						select(field.id);
					}
				}}
				role="button"
				tabIndex={0}
			>
				{effectiveHidden ? (
					<Badge className="mb-1.5 w-fit gap-1" variant="outline">
						<EyeOffIcon className="size-3" /> Hidden by logic
					</Badge>
				) : null}
				{isPageBreak ? (
					<div className="flex items-center gap-2 border-t py-3 text-muted-foreground text-xs">
						<BlockIcon className="size-3.5" name="SeparatorHorizontal" />
						Page break
					</div>
				) : (
					<div className="pointer-events-none">
						<FieldRenderer
							{...rendererBase}
							disabled={disabled}
							error={undefined}
							field={field}
							hidden={false}
							mentionValues={mentionValues}
							onChange={onChange}
							required={required}
							value={value}
						/>
					</div>
				)}
			</div>

			{readOnly ? null : (
				<BlockToolbar
					dragAttributes={attributes}
					dragListeners={listeners}
					field={field}
					showWidth={showWidth}
					visible={selected || Boolean(liveWidth)}
				/>
			)}
			{liveWidth ? (
				<span className="absolute top-1/2 right-3 z-10 -translate-y-1/2 whitespace-nowrap rounded-md bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
					{widthLabel(liveWidth)}
				</span>
			) : null}
			{showWidth ? (
				<ResizeHandle
					field={field}
					onResizing={setLiveWidth}
					readOnly={readOnly}
				/>
			) : null}
			{isDropTarget && dropIndicator ? (
				<DropLine indicator={dropIndicator} />
			) : null}
			{readOnly || !onInsertAfter ? null : (
				<button
					aria-label={`Insert a block after ${field.name}`}
					className="absolute inset-x-0 -bottom-3 z-20 flex justify-center opacity-0 group-hover:opacity-100"
					onClick={(e) => {
						e.stopPropagation();
						onInsertAfter();
					}}
					type="button"
				>
					<span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-110">
						<PlusIcon className="size-3.5" />
					</span>
				</button>
			)}
		</div>
	);
}
