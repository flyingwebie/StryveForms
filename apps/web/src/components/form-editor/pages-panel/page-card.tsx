import type { BlockImage, FormField } from "@StryveForms/forms/types";
import { resolvePageImage } from "@StryveForms/forms/types";
import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	MergeIcon,
	MoreVerticalIcon,
	XIcon,
} from "lucide-react";
import { useState } from "react";
import { FIELD_DRAG_TYPE, PageFieldChip } from "./page-field-chip";
import { PageImagePanel } from "./page-image-panel";
import type { EditorPage } from "./pages-model";

export function PageCard({
	canRemove,
	canSplit,
	index,
	onImageChange,
	onMergeWithNext,
	onMoveDown,
	onMoveToPage,
	onMoveUp,
	onRemove,
	onReorderOverField,
	onSplitAfter,
	page,
	pageImages,
	pages,
	properties,
	readOnly,
}: {
	/** True for an already-empty explicit page — offers "Remove page". */
	canRemove: boolean;
	/** False for an implicit page (one question each — nothing to split). */
	canSplit: boolean;
	index: number;
	onImageChange: (pageIndex: number, patch: Partial<BlockImage>) => void;
	onMergeWithNext: (pageIndex: number) => void;
	onMoveDown: (pageIndex: number) => void;
	/** "Move to page" (menu) and dropping onto the page card's empty area — always appends to the end of the target page. */
	onMoveToPage: (fieldId: string, targetPageIndex: number) => void;
	onMoveUp: (pageIndex: number) => void;
	onRemove: (pageIndex: number) => void;
	/** Dropping one field chip onto another — a precise same-page reorder, or (different pages) a move-to-page. */
	onReorderOverField: (draggedFieldId: string, targetFieldId: string) => void;
	onSplitAfter: (fieldId: string) => void;
	page: EditorPage;
	pageImages: Record<string, BlockImage>;
	pages: EditorPage[];
	/** Needed to resolve an implicit page's image: `field.image` of `page.imageFieldId`. */
	properties: FormField[];
	readOnly?: boolean;
}) {
	const [isOver, setIsOver] = useState(false);
	const isFirst = index === 0;
	const isLast = index === pages.length - 1;
	const resolvedImage = page.imageFieldId
		? properties.find((f) => f.id === page.imageFieldId)?.image
		: resolvePageImage(page.fields, pageImages, page.key);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: native HTML5 drop target for cross-page field moves; every interactive control inside stays independently operable
		// biome-ignore lint/a11y/noNoninteractiveElementInteractions: same as above
		<div
			className={`flex flex-col gap-2 rounded-xl border p-3 transition-colors ${isOver ? "border-primary bg-primary/5" : ""}`}
			onDragLeave={() => setIsOver(false)}
			onDragOver={(e) => {
				if (readOnly) {
					return;
				}
				e.preventDefault();
				setIsOver(true);
			}}
			onDrop={(e) => {
				e.preventDefault();
				setIsOver(false);
				if (readOnly) {
					return;
				}
				const draggedId = e.dataTransfer.getData(FIELD_DRAG_TYPE);
				if (draggedId) {
					onMoveToPage(draggedId, index);
				}
			}}
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<p className="font-medium text-sm">Page {index + 1}</p>
					<Badge variant="outline">
						{page.fields.length} field{page.fields.length === 1 ? "" : "s"}
					</Badge>
				</div>
				{readOnly ? null : (
					<div className="flex items-center gap-0.5">
						{canRemove ? (
							<Button
								onClick={() => onRemove(index)}
								size="icon-xs"
								title="Remove this empty page"
								type="button"
								variant="ghost"
							>
								<XIcon />
							</Button>
						) : null}
						<DropdownMenu>
							<DropdownMenuTrigger
								render={<Button size="icon-xs" type="button" variant="ghost" />}
							>
								<MoreVerticalIcon />
							</DropdownMenuTrigger>
							<DropdownMenuContent>
								<DropdownMenuItem
									disabled={isFirst}
									onClick={() => onMoveUp(index)}
								>
									<ArrowUpIcon /> Move page up
								</DropdownMenuItem>
								<DropdownMenuItem
									disabled={isLast}
									onClick={() => onMoveDown(index)}
								>
									<ArrowDownIcon /> Move page down
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									disabled={isLast}
									onClick={() => onMergeWithNext(index)}
								>
									<MergeIcon /> Merge with next page
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				)}
			</div>
			<div className="flex gap-2">
				<PageImagePanel
					image={resolvedImage}
					label={`Page ${index + 1}`}
					onChange={(patch) => onImageChange(index, patch)}
					pageKey={page.key}
				/>
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					{page.fields.length === 0 ? (
						<p className="rounded-lg border border-dashed p-3 text-center text-muted-foreground text-xs">
							No fields yet — drag one here from another page.
						</p>
					) : (
						page.fields.map((field, i) => (
							<PageFieldChip
								canSplit={canSplit}
								field={field}
								isLast={i === page.fields.length - 1}
								key={field.id}
								onDropOnField={onReorderOverField}
								onMoveToPage={onMoveToPage}
								onSplitAfter={onSplitAfter}
								pageIndex={index}
								pages={pages}
								readOnly={readOnly}
							/>
						))
					)}
				</div>
			</div>
		</div>
	);
}
