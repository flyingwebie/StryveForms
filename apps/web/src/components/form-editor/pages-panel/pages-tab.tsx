import type { BlockImage, FormField } from "@StryveForms/forms/types";
import { resolvePageImage } from "@StryveForms/forms/types";
import { Button } from "@StryveForms/ui/components/button";
import { PlusIcon } from "lucide-react";
import { useMemo } from "react";

import { useEditor } from "../state/editor-context";
import { PageCard } from "./page-card";
import {
	addPage,
	hasPageBreaks,
	materializeImplicitPages,
	mergeWithNextPage,
	moveFieldToPage,
	moveImplicitPageBy,
	movePage,
	type PageMutation,
	removeEmptyPage,
	splitPage,
	toEditorPages,
} from "./pages-model";

/**
 * The Pages tab (Focused forms only; Classic has no pages). Lists every
 * screen, lets you drag fields between them, add/merge/split/reorder pages,
 * and set each page's image.
 *
 * A form with no `nf-page-break` yet shows one card per question, matching
 * what the focused renderer shows, and that card's image is the question's
 * own `field.image`. The first time the user groups questions onto one page
 * (drag onto another card, merge, or "Add page"), the structure
 * "materializes" into real page breaks. See `pages-model.ts`.
 */
export function PagesTab() {
	const { moveField, patch, readOnly, state, updateField } = useEditor();
	const properties = state.settings.properties as FormField[];
	const nested = (state.settings.settings ?? {}) as Record<string, unknown>;
	const pageImages = (nested.pageImages ?? {}) as Record<string, BlockImage>;
	const implicit = !hasPageBreaks(properties);

	const pages = useMemo(() => toEditorPages(properties), [properties]);

	function patchPages(result: PageMutation) {
		patch({
			properties: result.properties,
			settings: { ...nested, pageImages: result.pageImages },
		});
	}

	/** Materializes implicit→explicit pages (a no-op once breaks exist) so a grouping action lands in one undo step. */
	function materialized(): PageMutation {
		if (!implicit) {
			return { pageImages, properties };
		}
		const result = materializeImplicitPages(properties);
		return {
			pageImages: { ...pageImages, ...result.pageImages },
			properties: result.properties,
		};
	}

	function handleAddPage() {
		const base = materialized();
		const result = addPage(base.properties, base.pageImages);
		patchPages(result);
	}

	function handleMoveUp(pageIndex: number) {
		if (implicit) {
			patch({ properties: moveImplicitPageBy(properties, pageIndex, -1) });
			return;
		}
		const key = pages[pageIndex]?.key;
		if (key) {
			patch({ properties: movePage(properties, key, -1) });
		}
	}

	function handleMoveDown(pageIndex: number) {
		if (implicit) {
			patch({ properties: moveImplicitPageBy(properties, pageIndex, 1) });
			return;
		}
		const key = pages[pageIndex]?.key;
		if (key) {
			patch({ properties: movePage(properties, key, 1) });
		}
	}

	function handleMergeWithNext(pageIndex: number) {
		const base = materialized();
		const key = toEditorPages(base.properties)[pageIndex]?.key;
		if (!key) {
			return;
		}
		patchPages(mergeWithNextPage(base.properties, base.pageImages, key));
	}

	function handleRemovePage(pageIndex: number) {
		// Only offered (see PageCard) for an already-empty explicit page.
		const key = pages[pageIndex]?.key;
		if (key) {
			patchPages(removeEmptyPage(properties, pageImages, key));
		}
	}

	function handleSplitAfter(fieldId: string) {
		patch({ properties: splitPage(properties, fieldId) });
	}

	/** "Move to page" menu and cross-page drops — always lands at the end of the target page. */
	function handleMoveToPageIndex(fieldId: string, targetIndex: number) {
		const base = materialized();
		const key = toEditorPages(base.properties)[targetIndex]?.key;
		if (!key) {
			return;
		}
		patchPages({
			pageImages: base.pageImages,
			properties: moveFieldToPage(base.properties, fieldId, key),
		});
	}

	/** Dropping one field chip onto another: a precise same-page reorder, or (different pages) a move-to-page. */
	function handleReorderOverField(draggedId: string, targetId: string) {
		if (draggedId === targetId) {
			return;
		}
		const fromIndex = pages.findIndex((p) =>
			p.fields.some((f) => f.id === draggedId)
		);
		const toIndex = pages.findIndex((p) =>
			p.fields.some((f) => f.id === targetId)
		);
		if (fromIndex !== -1 && fromIndex === toIndex) {
			moveField(draggedId, targetId, "before");
			return;
		}
		handleMoveToPageIndex(draggedId, toIndex);
	}

	function handleImageChange(
		pageIndex: number,
		imagePatch: Partial<BlockImage>
	) {
		const page = pages[pageIndex];
		if (!page) {
			return;
		}
		if (page.imageFieldId) {
			const field = properties.find((f) => f.id === page.imageFieldId);
			const current = field?.image ?? {};
			updateField(page.imageFieldId, {
				image: { ...current, ...imagePatch },
			});
			return;
		}
		// Seed from whatever's currently showing (the page's own stored image,
		// or, for a form using the legacy per-field image, the field that
		// carries one) so the first edit here "promotes" it into the page-level
		// store instead of discarding it.
		const resolved = resolvePageImage(page.fields, pageImages, page.key);
		const current = pageImages[page.key] ?? resolved ?? {};
		patch({
			settings: {
				...nested,
				pageImages: {
					...pageImages,
					[page.key]: { ...current, ...imagePatch },
				},
			},
		});
	}

	return (
		// pb-24 (~6rem): keeps the Add page button clear of the floating
		// TanStack devtools button that overlaps the bottom of this panel.
		<div className="flex flex-col gap-3 p-3 pb-24">
			<div className="flex items-center justify-between gap-2">
				<p className="font-medium text-subtle-foreground text-xs uppercase tracking-wide">
					Pages
				</p>
				<span className="text-muted-foreground text-xs">{pages.length}</span>
			</div>
			<p className="text-muted-foreground text-xs">
				{implicit
					? "Each question is its own screen for now. Drag one onto another to show them together."
					: "Drag a field onto another page to move it, or use its menu. Fields on the same page show together on one screen."}{" "}
				Click a page's thumbnail to set its image.
			</p>
			{pages.length === 0 ? (
				<p className="p-6 text-center text-muted-foreground text-xs">
					No questions yet. Add a block from the Build tab.
				</p>
			) : (
				pages.map((page, index) => (
					<PageCard
						canRemove={!implicit && page.fields.length === 0}
						canSplit={!implicit}
						index={index}
						key={page.key}
						onImageChange={handleImageChange}
						onMergeWithNext={handleMergeWithNext}
						onMoveDown={handleMoveDown}
						onMoveToPage={handleMoveToPageIndex}
						onMoveUp={handleMoveUp}
						onRemove={handleRemovePage}
						onReorderOverField={handleReorderOverField}
						onSplitAfter={handleSplitAfter}
						page={page}
						pageImages={pageImages}
						pages={pages}
						properties={properties}
						readOnly={readOnly}
					/>
				))
			)}
			{readOnly ? null : (
				<Button onClick={handleAddPage} type="button" variant="outline">
					<PlusIcon /> Add page
				</Button>
			)}
		</div>
	);
}
