import { BLOCKS, type BlockDefinition } from "@StryveForms/forms/blocks";
import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { useDraggable } from "@dnd-kit/core";
import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { paletteItemId } from "../dnd/drag-data";
import { BlockIcon } from "../shared/block-icon";
import { useEditor } from "../state/editor-context";

const CATEGORIES: { label: string; value: string }[] = [
	{ label: "Input", value: "input" },
	{ label: "Choice", value: "choice" },
	{ label: "Advanced", value: "advanced" },
	{ label: "Layout", value: "layout" },
	{ label: "Media", value: "media" },
];

function PaletteBlockCard({
	block,
	onAdd,
}: {
	block: BlockDefinition;
	onAdd: () => void;
}) {
	const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
		data: { blockId: block.id, type: "palette-block" },
		id: paletteItemId(block.id),
	});

	return (
		<button
			className={`flex items-start gap-3 rounded-lg border p-2.5 text-left transition-colors hover:border-primary hover:bg-primary/5 ${
				isDragging ? "opacity-40" : ""
			}`}
			onClick={onAdd}
			ref={setNodeRef}
			type="button"
			{...attributes}
			{...listeners}
		>
			<div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
				<BlockIcon className="size-4.5" name={block.icon} />
			</div>
			<div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
				<p className="font-medium text-sm">{block.title}</p>
				<p className="text-muted-foreground text-xs leading-snug">
					{block.description}
				</p>
			</div>
		</button>
	);
}

/**
 * Slide-out block library: opened from the left panel's "+ Add block"
 * button, the floating canvas "+", or a between-blocks "+" insert
 * affordance. Non-modal (no backdrop) so a block can be dragged straight
 * onto the canvas while it's open; closes on Esc or an outside click.
 */
export function AddBlockPanel() {
	const { addBlockAt, closeAddBlockPanel, state } = useEditor();
	const { addBlockPanel, selectedFieldId, settings } = state;
	const { open } = addBlockPanel;
	const [search, setSearch] = useState("");
	const panelRef = useRef<HTMLDivElement>(null);
	const { properties } = settings;

	useEffect(() => {
		if (!open) {
			return;
		}
		setSearch("");
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") {
				closeAddBlockPanel();
			}
		}
		function onPointerDown(e: PointerEvent) {
			if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
				closeAddBlockPanel();
			}
		}
		document.addEventListener("keydown", onKeyDown);
		// Capture phase: still fires even if a child stops propagation.
		document.addEventListener("pointerdown", onPointerDown, true);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("pointerdown", onPointerDown, true);
		};
	}, [open, closeAddBlockPanel]);

	const available = useMemo(() => {
		const query = search.trim().toLowerCase();
		return BLOCKS.filter((block) => {
			if (!block.availableIn.includes(settings.presentationStyle)) {
				return false;
			}
			if (!query) {
				return true;
			}
			return (
				block.title.toLowerCase().includes(query) ||
				block.description.toLowerCase().includes(query)
			);
		});
	}, [settings.presentationStyle, search]);

	function resolvedInsertIndex(): number {
		if (addBlockPanel.insertIndex !== null) {
			return addBlockPanel.insertIndex;
		}
		const selectedIndex = properties.findIndex((f) => f.id === selectedFieldId);
		return selectedIndex === -1 ? properties.length : selectedIndex + 1;
	}

	function handleAdd(blockId: string) {
		addBlockAt(blockId, resolvedInsertIndex());
		closeAddBlockPanel();
	}

	return (
		<div
			aria-hidden={!open}
			className={`absolute inset-y-0 left-0 flex flex-col rounded-r-xl border-r bg-background shadow-xl transition-transform duration-200 ${
				open ? "" : "pointer-events-none"
			}`}
			data-testid="add-block-panel"
			// Closed: out of the tab order and the accessibility tree, not
			// just visually slid away (aria-hidden alone left its buttons
			// focusable).
			inert={!open}
			ref={panelRef}
			// Inline style for the properties this panel can't risk losing to a
			// stale utility-class generation pass (width/z-index/slide
			// transform): it must always sit above the editor body and off
			// to the side when closed, so it never blocks the canvas.
			style={{
				maxWidth: "90vw",
				transform: open ? "translateX(0)" : "translateX(-100%)",
				width: "24rem",
				zIndex: 30,
			}}
		>
			<div className="flex items-center justify-between gap-2 border-b p-3">
				<p className="font-medium text-sm">Add a block</p>
				<Button
					onClick={closeAddBlockPanel}
					size="icon-xs"
					type="button"
					variant="ghost"
				>
					<XIcon />
				</Button>
			</div>
			<div className="p-3 pb-2">
				<div className="relative">
					<SearchIcon className="absolute top-2.5 left-2 size-3.5 text-muted-foreground" />
					<Input
						className="pl-7"
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search blocks…"
						value={search}
					/>
				</div>
			</div>
			{/* pb-24 (~6rem): the last block card stays clear of the floating
			 * TanStack devtools button that overlaps the bottom of the page. */}
			<div className="flex-1 overflow-y-auto p-3 pt-1 pb-24">
				{CATEGORIES.map((category) => {
					const blocks = available.filter((b) => b.category === category.value);
					if (blocks.length === 0) {
						return null;
					}
					return (
						<div className="mb-4 flex flex-col gap-2" key={category.value}>
							<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
								{category.label}
							</p>
							<div className="flex flex-col gap-1.5">
								{blocks.map((block) => (
									<PaletteBlockCard
										block={block}
										key={block.id}
										onAdd={() => handleAdd(block.id)}
									/>
								))}
							</div>
						</div>
					);
				})}
				{available.length === 0 ? (
					<p className="p-6 text-center text-muted-foreground text-xs">
						No blocks match "{search}".
					</p>
				) : null}
			</div>
		</div>
	);
}
