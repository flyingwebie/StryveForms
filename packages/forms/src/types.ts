/**
 * Form field model. Deliberately identical to OpnForm's `forms.properties[]`
 * JSON so imported forms render without conversion. Unknown keys are kept.
 */

import type { FieldType } from "./blocks";
import type { ConditionNode, FieldLogic } from "./logic";

export type FieldWidth = "full" | "1/2" | "1/3" | "2/3" | "1/4" | "3/4";
export type FieldAlign = "left" | "center" | "right" | "justify";

export interface SelectOption {
	id: string;
	image?: string | null;
	name: string;
}

export interface BlockImage {
	alt?: string;
	brightness?: number;
	/**
	 * Attribution for an image picked from an external source (the
	 * shared `ImagePicker`, e.g. Unsplash). Absent for an uploaded file.
	 * Shown as "Photo by {name} on Unsplash", both links pointing at `url`
	 * (the photographer profile) and the Unsplash homepage respectively, per
	 * the Unsplash API attribution guideline. See
	 * apps/web/src/components/app/media/README.md.
	 */
	credit?: { name: string; source: "unsplash"; url: string };
	focal_point?: { x: number; y: number };
	/**
	 * Current focused-mode image layout values: "stack" (image
	 * above the question), "split-left"/"split-right" (image fills half the
	 * screen, Typeform-style), "wallpaper" (full-bleed background with a dim
	 * overlay). Legacy values ("between", "left-small",
	 * "right-small", "left-split", "right-split", "background") are still
	 * accepted on read and normalized, see `form-renderer/image-layout.ts`.
	 */
	layout?:
		| "stack"
		| "split-left"
		| "split-right"
		| "wallpaper"
		| "between"
		| "left-small"
		| "right-small"
		| "left-split"
		| "right-split"
		| "background";
	url?: string;
}

export interface FieldValidation {
	error_conditions: { actions?: []; conditions: ConditionNode | null };
	error_message: string;
}

export interface FormField {
	align?: FieldAlign;
	allow_creation?: boolean;
	allowed_file_types?: string;
	audio_block?: string;
	camera_upload?: boolean;
	columns?: (string | number)[];
	/** HTML for nf-text / nf-code blocks. */
	content?: string;
	date_format?: "dd/MM/yyyy" | "MM-dd-yyyy";
	date_range?: boolean;
	decoders?: string[];
	disable_future_dates?: boolean;
	disable_past_dates?: boolean;
	disabled?: boolean;
	/** URL field that accepts an uploaded file instead of a link. */
	file_upload?: boolean;
	generates_auto_increment_id?: boolean;
	generates_uuid?: boolean;
	help?: string;
	help_position?: "below_input" | "above_input";
	hidden?: boolean;
	hide_field_name?: boolean;
	id: string;
	image?: BlockImage;
	image_block?: string;
	input_mask?: string;
	logic?: FieldLogic | null;
	max_char_limit?: number;
	max_file_size?: number;
	max_selection?: number | null;
	min_selection?: number | null;
	multi_lines?: boolean;
	multi_select?: { options: SelectOption[] };
	multiple?: boolean;
	name: string;
	next_btn_text?: string | null;
	option_display_mode?: "text_only" | "text_and_image" | "image_only";
	option_image_size?: "sm" | "md" | "lg";
	placeholder?: string;
	prefill?: unknown;
	prefill_today?: boolean;
	previous_btn_text?: string | null;
	rating_max_value?: number;
	required?: boolean;
	rows?: string[];
	scale_max_value?: number;
	scale_min_value?: number;
	scale_step_value?: number;
	secret_input?: boolean;
	select?: { options: SelectOption[] };
	selection_data?: Record<string, string | number | null>;
	show_char_limit?: boolean;
	shuffle_options?: boolean;
	slider_max_value?: number;
	slider_min_value?: number;
	slider_step_value?: number;
	slot_char?: string;
	time_format?: "24" | "12";
	timezone?: string;
	type: FieldType | (string & {});
	unavailable_countries?: string[];
	use_focused_selector?: boolean;
	use_focused_toggle?: boolean;
	use_simple_text_input?: boolean;
	use_toggle_switch?: boolean;
	validation?: FieldValidation | null;
	video_block?: string;
	width?: FieldWidth;
	with_time?: boolean;
	without_dropdown?: boolean;
	[key: string]: unknown;
}

export interface ComputedVariable {
	formula: string;
	id: string;
	name: string;
	result_type?: "auto" | "number" | "text";
}

/** Options of a select or multi-select field. */
export function fieldOptions(field: FormField): SelectOption[] {
	if (field.type === "multi_select") {
		return field.multi_select?.options ?? [];
	}
	return field.select?.options ?? [];
}

/** Splits classic forms into pages on visible page breaks. */
export function splitIntoPages<T extends { hidden?: boolean; type: string }>(
	fields: T[],
	isHidden: (field: T) => boolean = (f) => Boolean(f.hidden)
): T[][] {
	const pages: T[][] = [];
	let current: T[] = [];
	for (const field of fields) {
		current.push(field);
		if (field.type === "nf-page-break" && !isHidden(field)) {
			pages.push(current);
			current = [];
		}
	}
	pages.push(current);
	return pages.filter((page) => page.some((f) => f.type !== "nf-page-break"));
}

/**
 * The key for the LAST page of a form, the one
 * with no trailing `nf-page-break` to anchor it to. Every earlier page is
 * keyed by the id of the `nf-page-break` field that ends it, which is
 * stable across field reordering/moves within the page (unlike an array
 * index) and survives page splits/merges as long as the break field itself
 * isn't deleted.
 */
export const LAST_PAGE_KEY = "__last__";

export interface PageWithKey<T> {
	fields: T[];
	key: string;
}

/**
 * Same split as `splitIntoPages`, but each page also carries a stable key
 * (see `LAST_PAGE_KEY`) used to look up its per-page image in
 * `settings.settings.pageImages` (see `resolvePageImage`). Each page's
 * `fields` still includes its own trailing `nf-page-break`, like
 * `splitIntoPages`, so existing callers can keep reading `next_btn_text` /
 * `previous_btn_text` off it.
 */
export function splitIntoPagesWithKeys<
	T extends { hidden?: boolean; id: string; type: string },
>(
	fields: T[],
	isHidden: (field: T) => boolean = (f) => Boolean(f.hidden)
): PageWithKey<T>[] {
	const pages: PageWithKey<T>[] = [];
	let current: T[] = [];
	for (const field of fields) {
		current.push(field);
		if (field.type === "nf-page-break" && !isHidden(field)) {
			pages.push({ fields: current, key: field.id });
			current = [];
		}
	}
	pages.push({ fields: current, key: LAST_PAGE_KEY });
	return pages.filter((page) =>
		page.fields.some((f) => f.type !== "nf-page-break")
	);
}

/**
 * Resolves the image a page should show (a page, not just its
 * first field, can carry an illustration, with layout stack/split-left/
 * split-right/wallpaper).
 *
 * Storage model: a page's image lives in `settings.settings.pageImages`,
 * keyed by `LAST_PAGE_KEY` or the id of the page's terminating
 * `nf-page-break` (see `splitIntoPagesWithKeys`). That key is a field id,
 * so it's stable no matter how the page's OWN fields get reordered —
 * dragging fields around within a page never moves its image. Moving a
 * page's trailing break to merge/split pages intentionally moves the image
 * with it (editor-side page operations keep this consistent; see
 * `apps/web/.../form-editor/pages-panel/pages-model.ts`).
 *
 * Backward compatibility: forms saved before this round have no
 * `pageImages` entry at all — their image sits on whichever field in the
 * page happens to have `image.url` set (the old "first field in the step"
 * convention). When `pageImages` has no entry for `key`, this falls back to
 * searching `fields` for one, so those forms keep rendering unchanged.
 */
export function resolvePageImage(
	fields: FormField[],
	pageImages: Record<string, BlockImage> | undefined,
	key: string
): BlockImage | undefined {
	const stored = pageImages?.[key];
	if (stored?.url) {
		return stored;
	}
	return fields.find((f) => f.image?.url)?.image;
}
