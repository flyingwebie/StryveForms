import type { PdfPage } from "@StryveForms/api/services/pdf/model";
import { Button } from "@StryveForms/ui/components/button";
import { cn } from "@StryveForms/ui/lib/utils";
import { PlusIcon, Trash2Icon } from "lucide-react";

/** Left column: one thumbnail per page. Add/remove only applies to blank (non-uploaded) templates. */
export default function ThumbnailsPanel({
	currentPage,
	onAddPage,
	onRemovePage,
	onSelectPage,
	pages,
	zoneCountByPage,
	canEditPages,
}: {
	canEditPages: boolean;
	currentPage: number;
	onAddPage: () => void;
	onRemovePage: (index: number) => void;
	onSelectPage: (index: number) => void;
	pages: PdfPage[];
	zoneCountByPage: (index: number) => number;
}) {
	return (
		<div className="flex w-40 flex-col gap-2 overflow-y-auto border-r p-3">
			{pages.map((page, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: pages have no id; position is the identity (reordering isn't supported)
				<div className="group relative" key={index}>
					<button
						className={cn(
							"mx-auto flex w-full items-center justify-center rounded-lg border bg-white",
							index === currentPage
								? "border-primary ring-2 ring-primary/40"
								: "border-border hover:border-primary/50"
						)}
						onClick={() => onSelectPage(index)}
						style={{ aspectRatio: `${page.width} / ${page.height}` }}
						type="button"
					>
						<span className="text-muted-foreground text-xs">{index + 1}</span>
					</button>
					<div className="mt-1 flex items-center justify-between px-0.5 text-[10px] text-muted-foreground">
						<span>
							{zoneCountByPage(index)} zone
							{zoneCountByPage(index) === 1 ? "" : "s"}
						</span>
						{canEditPages && pages.length > 1 ? (
							<button
								aria-label={`Delete page ${index + 1}`}
								className="opacity-0 group-hover:opacity-100"
								onClick={() => onRemovePage(index)}
								type="button"
							>
								<Trash2Icon className="size-3" />
							</button>
						) : null}
					</div>
				</div>
			))}
			{canEditPages ? (
				<Button
					className="w-full"
					onClick={onAddPage}
					size="sm"
					variant="outline"
				>
					<PlusIcon /> Add page
				</Button>
			) : null}
		</div>
	);
}
