import { resolveFieldState } from "@StryveForms/forms/logic";
import { restructureForStyle } from "@StryveForms/forms/presentation";
import type { BlockImage, FormField } from "@StryveForms/forms/types";
import { Button } from "@StryveForms/ui/components/button";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { PlusIcon } from "lucide-react";
import { Fragment, useMemo } from "react";

import {
	focusableSteps,
	useFormEngine,
} from "@/components/form-renderer/use-form-engine";
import { canvasItemId } from "../dnd/drag-data";
import { useEditor } from "../state/editor-context";
import { usePreviewForm } from "../utils/preview-form";
import { CanvasEndDropZone, EmptyCanvasDropZone } from "./drop-zones";
import { FieldBlock } from "./field-block";
import { PageDivider } from "./page-divider";

const WIDTH_CLASS: Record<"desktop" | "mobile", string> = {
	desktop: "max-w-3xl",
	mobile: "max-w-sm",
};

/** Always-visible shortcut to the add-block panel, independent of scroll position or selection. */
function FloatingAddBlockButton() {
	const { openAddBlockPanel, readOnly } = useEditor();
	if (readOnly) {
		return null;
	}
	return (
		<Button
			className="absolute right-6 bottom-6 z-20 rounded-full shadow-lg"
			onClick={() => openAddBlockPanel(null)}
			size="icon-lg"
			title="Add a block"
			type="button"
		>
			<PlusIcon />
		</Button>
	);
}

/**
 * Classic forms have no pages, but one imported or created before that rule
 * can still carry page breaks (respondents then see it in steps). Offers to
 * remove them, keeping each page's image on its first question.
 */
function ClassicPageBreaksNotice({ count }: { count: number }) {
	const { patch, readOnly, state } = useEditor();
	const { settings } = state;
	if (readOnly) {
		return null;
	}
	function removeBreaks() {
		const next = restructureForStyle(
			settings.properties as FormField[],
			settings.settings.pageImages as Record<string, BlockImage> | undefined,
			"classic"
		);
		patch({
			properties: next.properties,
			settings: { ...settings.settings, pageImages: next.pageImages },
		});
	}
	return (
		<div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
			<p className="text-muted-foreground">
				This form has {count === 1 ? "a page break" : `${count} page breaks`}.
				Classic forms show every question on one page, and pages are a Focused
				feature.
			</p>
			<Button onClick={removeBreaks} size="sm" type="button" variant="outline">
				Remove page breaks
			</Button>
		</div>
	);
}

export function EditCanvas() {
	const { openAddBlockPanel, readOnly, state } = useEditor();
	// Same brand-applied shape the live form and the Preview tab use, so Edit
	// mode's WYSIWYG canvas never drifts from what a respondent actually sees.
	const form = usePreviewForm();
	const properties = form.properties as FormField[];

	const engine = useFormEngine(properties, form.computedVariables);
	const pageBreakCount = properties.filter(
		(f) => f.type === "nf-page-break"
	).length;
	const hasPages = pageBreakCount > 0;
	const isFocused = form.presentationStyle === "focused";
	// A Focused form without page breaks shows one question per screen, so the
	// canvas marks where each screen starts, matching the Pages tab.
	const screenStarts = useMemo(() => {
		const starts = new Map<string, number>();
		if (!isFocused || hasPages) {
			return starts;
		}
		for (const [index, [first]] of focusableSteps(properties).entries()) {
			if (first) {
				starts.set(first.id, index + 1);
			}
		}
		return starts;
	}, [hasPages, isFocused, properties]);

	const rendererBase = useMemo(
		() => ({
			borderRadius: form.borderRadius,
			formSlug: form.slug,
			// The canvas always lays out fields as an editable grid. Focused forms
			// get full-width blocks (see FieldBlock) and the real step-by-step view
			// lives in Preview.
			presentation: "classic" as const,
			size: form.size,
			theme: form.theme,
			uppercaseLabels: form.uppercaseLabels,
		}),
		[form.borderRadius, form.size, form.slug, form.theme, form.uppercaseLabels]
	);

	let pageNumber = 1;

	return (
		<div className="relative flex h-full justify-center overflow-y-auto bg-muted/30 px-6 pt-20 pb-10">
			{/* `@container`: field widths respond to this box's own width (the
			 * desktop/mobile preview toggle below), matching the real form root. */}
			<div className={`@container w-full ${WIDTH_CLASS[state.previewWidth]}`}>
				{hasPages && !isFocused ? (
					<ClassicPageBreaksNotice count={pageBreakCount} />
				) : null}
				<SortableContext
					items={properties.map((f) => canvasItemId(f.id))}
					strategy={rectSortingStrategy}
				>
					<div className="grid grid-cols-12 gap-x-4 gap-y-4">
						{properties.length === 0 ? <EmptyCanvasDropZone /> : null}
						{hasPages ? <PageDivider pageNumber={1} /> : null}
						{properties.map((field, index) => {
							const isBreak = field.type === "nf-page-break";
							const fieldState = resolveFieldState(field, engine.mergedContext);
							const node = (
								<FieldBlock
									disabled={fieldState.disabled}
									effectiveHidden={fieldState.hidden}
									field={field}
									key={field.id}
									mentionValues={engine.mergedContext}
									onChange={(value) => engine.setValue(field.id, value)}
									onInsertAfter={
										readOnly ? undefined : () => openAddBlockPanel(index + 1)
									}
									rendererBase={rendererBase}
									required={fieldState.required}
									value={engine.values[field.id]}
								/>
							);
							const screen = screenStarts.get(field.id);
							if (screen !== undefined) {
								return (
									<Fragment key={field.id}>
										<PageDivider pageNumber={screen} />
										{node}
									</Fragment>
								);
							}
							if (isBreak) {
								pageNumber += 1;
								return (
									<div className="col-span-12" key={field.id}>
										{node}
										<PageDivider pageNumber={pageNumber} />
									</div>
								);
							}
							return node;
						})}
						<CanvasEndDropZone />
					</div>
				</SortableContext>
			</div>
			<FloatingAddBlockButton />
		</div>
	);
}
