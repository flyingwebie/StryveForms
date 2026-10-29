/**
 * Rules for what each form style ("classic" / "focused") shows, and how a
 * form is restructured when it switches between them. Shared by the editor
 * (style switch, Build tab) and the renderer so they always agree.
 *
 * - Classic shows every question on one scrolling page (a grid), with the
 *   Classic layout's header or background image. It has no pages, and
 *   question and page images are not shown.
 * - Focused shows one screen at a time with question/page images. Page
 *   breaks group several questions on one screen. Classic header and
 *   background images are not shown, and divider/image blocks don't exist.
 *
 * Images a style doesn't show are kept, so switching back restores them.
 */
import { BLOCKS, type PresentationStyle } from "./blocks";
import {
	type BlockImage,
	type FormField,
	LAST_PAGE_KEY,
	splitIntoPagesWithKeys,
} from "./types";

/** Block types that only exist in Classic forms (removed when switching to Focused). */
export const CLASSIC_ONLY_TYPES: ReadonlySet<string> = new Set(
	BLOCKS.filter((b) => !b.availableIn.includes("focused")).map((b) => b.type)
);

/** Whether this style uses pages (page breaks and the editor's Pages tab). */
export function usesPages(style: PresentationStyle): boolean {
	return style === "focused";
}

/** Whether field widths apply (Classic's grid). Focused shows every question full width. */
export function usesFieldWidths(style: PresentationStyle): boolean {
	return style === "classic";
}

export function hasPageBreaks(fields: readonly { type: string }[]): boolean {
	return fields.some((f) => f.type === "nf-page-break");
}

/** Whether the renderer shows the Classic layout's header/background image for this style. */
export function showsClassicLayoutImages(style: PresentationStyle): boolean {
	return style === "classic";
}

/** Whether the renderer shows question/page images for this style. */
export function showsQuestionImages(style: PresentationStyle): boolean {
	return style === "focused";
}

export interface PageRestructure {
	pageImages: Record<string, BlockImage>;
	properties: FormField[];
}

/**
 * Drops page images whose page no longer exists (its page break was
 * deleted). With no page breaks at all, page images are never shown, so
 * the map is emptied.
 */
export function prunePageImages(
	fields: readonly FormField[],
	pageImages: Record<string, BlockImage> | undefined
): Record<string, BlockImage> {
	if (!(pageImages && hasPageBreaks(fields))) {
		return {};
	}
	const keys = new Set([
		LAST_PAGE_KEY,
		...fields.filter((f) => f.type === "nf-page-break").map((f) => f.id),
	]);
	return Object.fromEntries(
		Object.entries(pageImages).filter(([key]) => keys.has(key))
	);
}

/**
 * Removes every page break so a Focused form shows one question per
 * screen. Each page's image moves onto the page's first field (unless a
 * field there already has one), so no image is lost.
 */
export function flattenToQuestions(
	fields: readonly FormField[],
	pageImages: Record<string, BlockImage> | undefined
): PageRestructure {
	const properties: FormField[] = [];
	for (const page of splitIntoPagesWithKeys([...fields], () => false)) {
		const pageFields = page.fields.filter((f) => f.type !== "nf-page-break");
		const image = pageImages?.[page.key];
		const needsImage =
			Boolean(image?.url) && !pageFields.some((f) => f.image?.url);
		pageFields.forEach((field, index) => {
			properties.push(needsImage && index === 0 ? { ...field, image } : field);
		});
	}
	return { pageImages: {}, properties };
}

/**
 * Deletes one page break. Its page merges into the next one, which inherits
 * the deleted page's image when it has none. When this was the last page
 * break, the form goes back to one question per screen (`flattenToQuestions`).
 */
export function removePageBreak(
	fields: readonly FormField[],
	pageImages: Record<string, BlockImage> | undefined,
	breakId: string
): PageRestructure {
	const properties = fields.filter((f) => f.id !== breakId);
	if (!hasPageBreaks(properties)) {
		// Last break: every page's image moves onto its own first question.
		return flattenToQuestions(fields, pageImages);
	}
	const pages = splitIntoPagesWithKeys([...fields], () => false);
	const index = pages.findIndex((p) => p.key === breakId);
	const nextImages = { ...pageImages };
	const image = nextImages[breakId];
	delete nextImages[breakId];
	const nextPage = index >= 0 ? pages[index + 1] : undefined;
	if (image?.url && nextPage && !nextImages[nextPage.key]?.url) {
		nextImages[nextPage.key] = image;
	}
	return { pageImages: prunePageImages(properties, nextImages), properties };
}

export interface StyleSwitchImpact {
	/** Question/page images Classic doesn't show (kept for Focused). */
	hiddenQuestionImageCount: number;
	/** Page breaks in the form (Focused asks whether to keep them; Classic removes them). */
	pageBreakCount: number;
	/** Divider/image blocks deleted when switching to Focused. */
	removedBlocks: FormField[];
}

/** What changes when `fields` switches to `target`, for the confirmation dialog. */
export function styleSwitchImpact(
	fields: readonly FormField[],
	pageImages: Record<string, BlockImage> | undefined,
	target: PresentationStyle
): StyleSwitchImpact {
	if (target === "focused") {
		return {
			hiddenQuestionImageCount: 0,
			pageBreakCount: fields.filter((f) => f.type === "nf-page-break").length,
			removedBlocks: fields.filter((f) => CLASSIC_ONLY_TYPES.has(f.type)),
		};
	}
	const pageImageCount = Object.values(
		prunePageImages(fields, pageImages)
	).filter((image) => image.url).length;
	return {
		hiddenQuestionImageCount:
			fields.filter((f) => f.image?.url).length + pageImageCount,
		pageBreakCount: fields.filter((f) => f.type === "nf-page-break").length,
		removedBlocks: [],
	};
}

/**
 * Restructures a form for the target style:
 * - to Focused: removes Classic-only blocks, and (when `onePerScreen`)
 *   removes page breaks so each question gets its own screen;
 * - to Classic: removes page breaks (Classic has no pages). Page images move
 *   onto each page's first question, so switching back restores them;
 * - both ways: drops page images whose page no longer exists.
 */
export function restructureForStyle(
	fields: readonly FormField[],
	pageImages: Record<string, BlockImage> | undefined,
	target: PresentationStyle,
	options: { onePerScreen?: boolean } = {}
): PageRestructure {
	const kept =
		target === "focused"
			? fields.filter((f) => !CLASSIC_ONLY_TYPES.has(f.type))
			: [...fields];
	if (target === "classic" || options.onePerScreen) {
		return flattenToQuestions(kept, pageImages);
	}
	return { pageImages: prunePageImages(kept, pageImages), properties: kept };
}
