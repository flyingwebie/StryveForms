import type { PdfZone } from "@StryveForms/api/services/pdf/model";
import { cn } from "@StryveForms/ui/lib/utils";
import { useRef } from "react";

import { clamp, snap, ZONE_ICONS } from "./types";

/** One positioned zone on the page canvas: draggable, resizable (bottom-right handle), snaps to a 1% grid. */
export default function ZoneBox({
	label,
	onBeginEdit,
	onChange,
	onSelect,
	selected,
	zone,
}: {
	label: string;
	onBeginEdit: () => void;
	onChange: (next: PdfZone) => void;
	onSelect: () => void;
	selected: boolean;
	zone: PdfZone;
}) {
	const elementRef = useRef<HTMLDivElement>(null);
	const Icon = ZONE_ICONS[zone.type];

	function startDrag(event: React.PointerEvent, mode: "move" | "resize") {
		event.stopPropagation();
		event.preventDefault();
		onSelect();
		onBeginEdit();
		const container = elementRef.current?.parentElement;
		if (!container) {
			return;
		}
		const rect = container.getBoundingClientRect();
		const startX = event.clientX;
		const startY = event.clientY;
		const start = { ...zone };

		function onMove(ev: PointerEvent) {
			const dx = (ev.clientX - startX) / rect.width;
			const dy = (ev.clientY - startY) / rect.height;
			if (mode === "move") {
				onChange({
					...start,
					x: snap(clamp(start.x + dx, 0, 1 - start.w)),
					y: snap(clamp(start.y + dy, 0, 1 - start.h)),
				});
			} else {
				onChange({
					...start,
					h: snap(clamp(start.h + dy, 0.01, 1 - start.y)),
					w: snap(clamp(start.w + dx, 0.01, 1 - start.x)),
				});
			}
		}
		function onUp() {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		}
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	}

	return (
		<div
			className={cn(
				"group absolute cursor-move select-none rounded border bg-primary/10 text-[10px]",
				selected
					? "z-10 border-primary ring-2 ring-primary/40"
					: "border-primary/40 hover:border-primary"
			)}
			onPointerDown={(e) => startDrag(e, "move")}
			ref={elementRef}
			style={{
				height: `${zone.h * 100}%`,
				left: `${zone.x * 100}%`,
				top: `${zone.y * 100}%`,
				width: `${zone.w * 100}%`,
			}}
		>
			<div className="flex h-full w-full items-center gap-1 overflow-hidden px-1 text-primary">
				<Icon className="size-3 shrink-0" />
				<span className="truncate">{label}</span>
			</div>
			<button
				aria-label="Resize zone"
				className="absolute right-0 bottom-0 size-2.5 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-full border border-background bg-primary opacity-0 group-hover:opacity-100 data-selected:opacity-100"
				data-selected={selected || undefined}
				onPointerDown={(e) => startDrag(e, "resize")}
				type="button"
			/>
		</div>
	);
}
