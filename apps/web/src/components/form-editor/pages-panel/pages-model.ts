/**
 * Pure helpers behind the Pages tab: turning the flat `properties[]` array
 * into page groups, and back again, for add/split/merge/reorder/move-field
 * operations. No React here — every function takes the current properties
 * (+ pageImages map where relevant) and returns the next version, so the
 * panel components just call these and `patch()` the result.
 *
 * Two page models, chosen per-form by whether any `nf-page-break` exists:
 *
 * - **Implicit** (no breaks, the common case, and the only case for a form
 *   with none): one page per question, grouped exactly like the focused
 *   renderer's `focusableSteps` (a leading `nf-text`/`nf-divider` attaches
 *   to the question after it). There's no page-level image store here — an
 *   implicit page's image IS that question's own `field.image` (the
 *   original per-field convention), so the thumbnail/editor reads and writes
 *   `field.image` directly. `EditorPage.imageFieldId` marks this.
 * - **Explicit** (at least one break): a page is a run of fields ending at
 *   an `nf-page-break` (or, for the last page, ending at nothing); its
 *   stable key is that break's id, or `LAST_PAGE_KEY`. A page's image lives
 *   in `settings.settings.pageImages[key]`, so it stays with the page
 *   across field reorders.
 *
 * The first time the user actually GROUPS questions onto one page (moving a
 * question onto another page's card, merging, or "Add page"), the implicit
 * structure is "materialized" into an explicit one first: a break is
 * inserted after every OTHER question (so each keeps its own page, exactly
 * as it already appeared) and each question's `field.image` moves into
 * `pageImages` under its new page's key — see `materializeImplicitPages`.
 * The caller then applies the actual requested change on top of that in the
 * same `patch()` call, so it's one undo step, and nothing visibly changes
 * except the grouping the user asked for.
 */

import { getBlock } from "@StryveForms/forms/blocks";
import { uniqueFieldId } from "@StryveForms/forms/field-ids";
import {
	type BlockImage,
	type FormField,
	LAST_PAGE_KEY,
} from "@StryveForms/forms/types";
import { focusableSteps } from "@/components/form-renderer/use-form-engine";

export interface EditorPage {
	/** This page's own fields, NOT including its trailing `nf-page-break`. */
	fields: FormField[];
	/** Set only for an implicit page: its image is this field's own `image`, not a `pageImages` entry. */
	imageFieldId?: string;
	key: string;
}

/** A fresh, uniquely-named `nf-page-break` field (same construction `createFieldFromBlock` uses). */
function newPageBreak(existing: FormField[]): FormField {
	const block = getBlock("nf-page-break");
	const name = block?.defaultName ?? "Page break";
	return {
		id: uniqueFieldId(
			name,
			existing.map((f) => f.id)
		),
		name,
		type: "nf-page-break",
	};
}

/** Every `nf-page-break` field currently in `properties`, by its own id. */
function breaksById(properties: FormField[]): Map<string, FormField> {
	const map = new Map<string, FormField>();
	for (const field of properties) {
		if (field.type === "nf-page-break") {
			map.set(field.id, field);
		}
	}
	return map;
}

export function hasPageBreaks(properties: FormField[]): boolean {
	return properties.some((f) => f.type === "nf-page-break");
}

/**
 * Splits into EXPLICIT pages: by every `nf-page-break`, regardless of its
 * `hidden` flag or logic — unlike the respondent-facing split, the editor
 * shows every page structurally, the same way the edit canvas counts
 * "Page N" dividers.
 *
 * Deliberately NOT `splitIntoPagesWithKeys` from `@StryveForms/forms/types`:
 * that helper drops a page with no real fields (so respondents never see an
 * empty screen), but the editor needs to keep showing a just-added empty
 * page so there's somewhere for the user to drag a field onto.
 */
function splitByBreaks(properties: FormField[]): EditorPage[] {
	const pages: EditorPage[] = [];
	let current: FormField[] = [];
	for (const field of properties) {
		if (field.type === "nf-page-break") {
			pages.push({ fields: current, key: field.id });
			current = [];
		} else {
			current.push(field);
		}
	}
	pages.push({ fields: current, key: LAST_PAGE_KEY });
	return pages;
}

/** A real question — not a layout-only block (`nf-text`/`nf-divider`), which never gets its own implicit page. */
function isRealField(field: FormField): boolean {
	return field.type !== "nf-text" && field.type !== "nf-divider";
}

/** The field that "leads" a focusable group: the real question, or (a trailing layout-only group) its first block. */
function groupAnchor(group: FormField[]): FormField | undefined {
	return group.find(isRealField) ?? group[0];
}

/**
 * True when `fields` has 2+ real questions. A page like that can only be
 * told apart from separate implicit (one-per-question) pages by an actual
 * `nf-page-break` somewhere in the form — see `guardAgainstImplicitCollapse`.
 */
function hasMultipleRealFields(fields: FormField[]): boolean {
	return fields.filter(isRealField).length > 1;
}

/** Splits into IMPLICIT pages: one per question, grouped exactly like the focused renderer (`focusableSteps`). */
function splitIntoImplicitPages(properties: FormField[]): EditorPage[] {
	return focusableSteps(properties).map((group) => {
		const anchor = groupAnchor(group);
		return {
			fields: group,
			imageFieldId: anchor?.id,
			key: anchor?.id ?? LAST_PAGE_KEY,
		};
	});
}

/**
 * The pages the Pages tab shows: implicit (one per question) while the form
 * has no `nf-page-break`, explicit once it does. Use this for display, and
 * to resolve "which page is this card, now" (by array index) across a
 * `materializeImplicitPages` call — see the module doc.
 */
export function toEditorPages(properties: FormField[]): EditorPage[] {
	return hasPageBreaks(properties)
		? splitByBreaks(properties)
		: splitIntoImplicitPages(properties);
}

/** Flattens EXPLICIT pages back into a flat `properties[]`, inserting (or reusing) a break between consecutive pages. */
function fromEditorPages(
	pages: EditorPage[],
	breaks: Map<string, FormField>
): FormField[] {
	const out: FormField[] = [];
	pages.forEach((page, i) => {
		out.push(...page.fields);
		if (i < pages.length - 1) {
			const existing =
				page.key === LAST_PAGE_KEY ? undefined : breaks.get(page.key);
			out.push(existing ?? newPageBreak(out));
		}
	});
	return out;
}

export interface PageMutation {
	pageImages: Record<string, BlockImage>;
	properties: FormField[];
}

/**
 * Converts implicit pages into explicit ones: a real `nf-page-break` after
 * every question (so each keeps its own page, exactly as it already
 * appeared), and each question's `field.image` moved into `pageImages`
 * under its new page's key. A no-op (returns `properties` as-is, empty
 * `pageImages`) when the form already has breaks, or has ≤1 implicit page.
 *
 * Callers apply the actual requested grouping change on top of the result
 * in the SAME `patch()` call, so materializing is never its own undo step.
 */
export function materializeImplicitPages(
	properties: FormField[]
): PageMutation {
	if (hasPageBreaks(properties)) {
		return { pageImages: {}, properties };
	}
	const groups = focusableSteps(properties);
	if (groups.length <= 1) {
		return { pageImages: {}, properties };
	}
	const pageImages: Record<string, BlockImage> = {};
	const out: FormField[] = [];
	groups.forEach((group, i) => {
		const anchor = groupAnchor(group);
		const image = anchor?.image?.url ? anchor.image : undefined;
		// Strip the image off its field — once a page is explicit, the image
		// is page-owned (via `pageImages`), not field-owned, so there's one
		// source of truth instead of a dangling, now-superseded field image.
		for (const field of group) {
			out.push(field === anchor && image ? strippedOfImage(field) : field);
		}
		if (i < groups.length - 1) {
			const brk = newPageBreak(out);
			if (image) {
				pageImages[brk.id] = image;
			}
			out.push(brk);
		} else if (image) {
			pageImages[LAST_PAGE_KEY] = image;
		}
	});
	return { pageImages, properties: out };
}

function strippedOfImage(field: FormField): FormField {
	const { image: _image, ...rest } = field;
	return rest as FormField;
}

/** Adds a new, empty page at the end. The previous last page's image (if any) moves with it to its new, real key. */
export function addPage(
	properties: FormField[],
	pageImages: Record<string, BlockImage>
): PageMutation {
	const pages = splitByBreaks(properties);
	const lastKey = pages.at(-1)?.key ?? LAST_PAGE_KEY;
	const newBreak = newPageBreak(properties);
	const breaks = breaksById(properties);
	breaks.set(newBreak.id, newBreak);

	const nextPages = [...pages];
	const previousLast = nextPages.at(-1);
	if (previousLast) {
		nextPages[nextPages.length - 1] = { ...previousLast, key: newBreak.id };
	}
	nextPages.push({ fields: [], key: LAST_PAGE_KEY });

	const nextPageImages = { ...pageImages };
	if (nextPageImages[lastKey]) {
		nextPageImages[newBreak.id] = nextPageImages[lastKey];
		if (lastKey === LAST_PAGE_KEY) {
			delete nextPageImages[lastKey];
		}
	}
	return {
		pageImages: nextPageImages,
		properties: fromEditorPages(nextPages, breaks),
	};
}

/**
 * Splits a page into two right after `afterFieldId`. The first half gets a
 * brand-new key (no stored image yet — falls back to a field-level image if
 * one of its own fields carries one); the second half keeps the original
 * key, so its stored image (if any) stays with it. Explicit pages only —
 * callers materialize first.
 */
export function splitPage(
	properties: FormField[],
	afterFieldId: string
): FormField[] {
	const pages = splitByBreaks(properties);
	const pageIndex = pages.findIndex((p) =>
		p.fields.some((f) => f.id === afterFieldId)
	);
	if (pageIndex === -1) {
		return properties;
	}
	const page = pages[pageIndex];
	const splitAt = page.fields.findIndex((f) => f.id === afterFieldId);
	if (splitAt === -1 || splitAt >= page.fields.length - 1) {
		return properties;
	}
	const newBreak = newPageBreak(properties);
	const breaks = breaksById(properties);
	breaks.set(newBreak.id, newBreak);

	const nextPages = [...pages];
	nextPages.splice(
		pageIndex,
		1,
		{ fields: page.fields.slice(0, splitAt + 1), key: newBreak.id },
		{ fields: page.fields.slice(splitAt + 1), key: page.key }
	);
	return fromEditorPages(nextPages, breaks);
}

/**
 * Merges the page keyed `pageKey` into the page right after it. The merged
 * page keeps the NEXT page's stored image; if the next page had none, the
 * merged-away page's image (if any) carries forward instead of being lost.
 * Explicit pages only — callers materialize first.
 */
export function mergeWithNextPage(
	properties: FormField[],
	pageImages: Record<string, BlockImage>,
	pageKey: string
): PageMutation {
	const pages = splitByBreaks(properties);
	const index = pages.findIndex((p) => p.key === pageKey);
	if (index === -1 || index === pages.length - 1) {
		return { pageImages, properties };
	}
	const next = pages[index + 1];
	const mergedFields = [...pages[index].fields, ...next.fields];
	const nextPages = [...pages];
	nextPages.splice(index, 2, { fields: mergedFields, key: next.key });

	const breaks = breaksById(properties);
	const nextPageImages = { ...pageImages };
	delete nextPageImages[pageKey];
	if (!nextPageImages[next.key] && pageImages[pageKey]) {
		nextPageImages[next.key] = pageImages[pageKey];
	}

	guardAgainstImplicitCollapse(nextPages, breaks, nextPageImages, properties);

	return {
		pageImages: nextPageImages,
		properties: fromEditorPages(nextPages, breaks),
	};
}

/**
 * Collapsing a merge/removal down to exactly one remaining page with 2+
 * real questions can't be represented by zero `nf-page-break`s — read back,
 * that would look like separate implicit (one-per-question) pages again,
 * silently undoing the grouping. When that happens, mutates `pages` in
 * place to keep it explicit: the survivor gets a fresh, real page-break
 * key, and a new empty page (removable — see `removeEmptyPage`) takes over
 * `LAST_PAGE_KEY`. Also moves that key's `pageImages` entry, if any.
 */
function guardAgainstImplicitCollapse(
	pages: EditorPage[],
	breaks: Map<string, FormField>,
	pageImages: Record<string, BlockImage>,
	existingProperties: FormField[]
): void {
	if (pages.length !== 1 || !hasMultipleRealFields(pages[0].fields)) {
		return;
	}
	const survivorKey = pages[0].key;
	const brk = newPageBreak(existingProperties);
	breaks.set(brk.id, brk);
	pages[0] = { fields: pages[0].fields, key: brk.id };
	pages.push({ fields: [], key: LAST_PAGE_KEY });
	if (survivorKey !== brk.id && pageImages[survivorKey]) {
		pageImages[brk.id] = pageImages[survivorKey];
		delete pageImages[survivorKey];
	}
}

/**
 * Removes an EMPTY page (0 fields) — e.g. a just-added page nobody dragged
 * a question onto yet. A no-op if the page still has fields.
 */
export function removeEmptyPage(
	properties: FormField[],
	pageImages: Record<string, BlockImage>,
	pageKey: string
): PageMutation {
	const pages = splitByBreaks(properties);
	const index = pages.findIndex((p) => p.key === pageKey);
	if (index === -1 || pages[index].fields.length > 0) {
		return { pageImages, properties };
	}
	const nextPages = pages.filter((_, i) => i !== index);
	const breaks = breaksById(properties);
	const nextPageImages = { ...pageImages };
	delete nextPageImages[pageKey];

	guardAgainstImplicitCollapse(nextPages, breaks, nextPageImages, properties);

	return {
		pageImages: nextPageImages,
		properties: fromEditorPages(nextPages, breaks),
	};
}

/** Moves a whole EXPLICIT page earlier/later. Each page's own key (and so its stored image) travels with it. */
export function movePage(
	properties: FormField[],
	pageKey: string,
	delta: 1 | -1
): FormField[] {
	const pages = splitByBreaks(properties);
	const index = pages.findIndex((p) => p.key === pageKey);
	const target = index + delta;
	if (index === -1 || target < 0 || target >= pages.length) {
		return properties;
	}
	const nextPages = [...pages];
	const [moved] = nextPages.splice(index, 1);
	if (moved) {
		nextPages.splice(target, 0, moved);
	}
	const breaks = breaksById(properties);
	return fromEditorPages(nextPages, breaks);
}

/**
 * Moves a whole IMPLICIT page (a question, plus any `nf-text`/`nf-divider`
 * attached ahead of it) earlier/later. No breaks involved — reordering
 * never needs to materialize, since each implicit page already stands
 * alone wherever it sits in `properties`.
 */
export function moveImplicitPageBy(
	properties: FormField[],
	groupIndex: number,
	delta: 1 | -1
): FormField[] {
	const groups = focusableSteps(properties);
	const target = groupIndex + delta;
	if (
		groupIndex < 0 ||
		groupIndex >= groups.length ||
		target < 0 ||
		target >= groups.length
	) {
		return properties;
	}
	const next = [...groups];
	const [moved] = next.splice(groupIndex, 1);
	if (moved) {
		next.splice(target, 0, moved);
	}
	return next.flat();
}

/** Moves one field to the end of a (possibly different) EXPLICIT page, for the "Move to page" menu and cross-page drops. */
export function moveFieldToPage(
	properties: FormField[],
	fieldId: string,
	targetPageKey: string
): FormField[] {
	const pages = splitByBreaks(properties);
	let moving: FormField | undefined;
	const withoutField = pages.map((page) => {
		const at = page.fields.findIndex((f) => f.id === fieldId);
		if (at === -1) {
			return page;
		}
		moving = page.fields[at];
		return { ...page, fields: page.fields.filter((f) => f.id !== fieldId) };
	});
	if (!moving) {
		return properties;
	}
	const targetIndex = withoutField.findIndex((p) => p.key === targetPageKey);
	if (targetIndex === -1) {
		return properties;
	}
	const field = moving;
	const nextPages = withoutField.map((page, i) =>
		i === targetIndex ? { ...page, fields: [...page.fields, field] } : page
	);
	const breaks = breaksById(properties);
	return fromEditorPages(nextPages, breaks);
}
