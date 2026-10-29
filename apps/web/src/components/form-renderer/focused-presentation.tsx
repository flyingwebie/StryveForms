import type { PublicFormDto } from "@StryveForms/api/lib/serialize";
import { isInputType } from "@StryveForms/forms/blocks";
import { resolveMentions } from "@StryveForms/forms/mentions";
import type { BlockImage, FormField } from "@StryveForms/forms/types";
import {
	resolvePageImage,
	splitIntoPagesWithKeys,
} from "@StryveForms/forms/types";
import { validateSubmission } from "@StryveForms/forms/validation";
import { Button } from "@StryveForms/ui/components/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { FieldRenderer } from "./field-renderer";
import type { FormDictionary } from "./i18n";
import { ImageCredit } from "./image-credit";
import { normalizeImageLayout } from "./image-layout";
import { outlineButtonTheme, submitButtonTheme } from "./theme";
import type { FormEngine } from "./use-form-engine";
import { focusableSteps } from "./use-form-engine";

const AUTO_NEXT_TYPES = new Set([
	"select",
	"checkbox",
	"rating",
	"scale",
	"date",
	"multi_select",
]);

export interface FocusedPresentationProps {
	dict: FormDictionary;
	disabled: boolean;
	engine: FormEngine;
	fields: FormField[];
	form: PublicFormDto;
	formSlug: string;
	/** Called when the current question's split photo changes (null = none), so the page can show it across half the screen. */
	onSplitImageChange?: (split: SplitImage | null) => void;
	onSubmit: () => void;
	submitting: boolean;
}

/** A question photo the page shows: across half of it (split-left / split-right) or behind everything (wallpaper). */
export interface SplitImage {
	image: BlockImage;
	side: "left" | "right" | "full";
}

/**
 * One focused-mode screen. Without page breaks (the common case) each
 * `Step` is exactly one real question, built
 * by `focusableSteps`. With page breaks, each `Step` is a whole page — every
 * field up to the next break — shown and validated together, same as a
 * classic page; `validateIds` then holds every one of those fields instead
 * of a single id.
 */
interface Step {
	fields: FormField[];
	image?: BlockImage;
	validateIds: string[];
}

/** `object-position` / `filter` for a question image, from its focal point + brightness. */
function imageCss(image: BlockImage | undefined): React.CSSProperties {
	const x = image?.focal_point?.x ?? 50;
	const y = image?.focal_point?.y ?? 50;
	const brightness = image?.brightness ?? 0;
	return {
		filter: brightness ? `brightness(${1 + brightness / 100})` : undefined,
		objectPosition: `${x}% ${y}%`,
	};
}

/** Normalizes a possibly-undefined image into the stack/split/wallpaper flags `StepBody`/`StepFields` key off. */
function imageInfo(image: BlockImage | undefined) {
	const layout = image?.url ? normalizeImageLayout(image.layout) : null;
	return {
		image,
		isSplit: layout === "split-left" || layout === "split-right",
		isStack: layout === "stack",
		isWallpaper: layout === "wallpaper",
		layout,
	};
}

/**
 * Builds the list of focused-mode screens.
 *
 * - No page breaks anywhere in the form: one question per screen
 *   (`focusableSteps`) — a layout block like
 *   `nf-text` rides along with the next real question instead of getting
 *   its own screen. The step's image is whichever field in it carries one
 *   (the "first field with an image" convention) — the Pages
 *   tab shows this same per-question grouping as one implicit "page" each,
 *   editing that field's own `image` directly, so this matches what's
 *   shown there exactly. `pageImages` is never consulted here: it only
 *   holds anything once the form has real page breaks (see below).
 * - At least one page break: each page (`splitIntoPagesWithKeys`) becomes
 *   one screen showing every one of its fields, like a classic page. The
 *   step's image is the page's own stored image (`pageImages`, keyed by the
 *   page's trailing break id / `LAST_PAGE_KEY`), falling back to a field's
 *   image for pages saved before this round.
 */
function buildSteps(
	fields: FormField[],
	isHidden: (field: FormField) => boolean,
	pageImages: Record<string, BlockImage> | undefined
): Step[] {
	const hasPageBreaks = fields.some((f) => f.type === "nf-page-break");
	if (hasPageBreaks) {
		return splitIntoPagesWithKeys(fields, isHidden).map((page) => {
			const pageFields = page.fields.filter(
				(f) => f.type !== "nf-page-break" && !isHidden(f)
			);
			return {
				fields: pageFields,
				image: resolvePageImage(pageFields, pageImages, page.key),
				validateIds: pageFields.map((f) => f.id),
			};
		});
	}
	const visible = fields.filter(
		(f) => f.type !== "nf-page-break" && !isHidden(f)
	);
	return focusableSteps(visible).map((step) => {
		const inputField = step.find(
			(f) => f.type !== "nf-text" && f.type !== "nf-divider"
		);
		return {
			fields: step,
			image: step.find((f) => f.image?.url)?.image,
			validateIds: inputField ? [inputField.id] : [],
		};
	});
}

/**
 * The step's fields, with a top banner on narrow screens for a split image,
 * and the navigation row. The nav is a separate child so the container's
 * `justify-between` keeps it at the bottom of the card on every step.
 */
function StepBody({
	fields,
	info,
	nav,
}: {
	fields: ReactNode;
	info: ReturnType<typeof imageInfo>;
	nav: ReactNode;
}) {
	const { image, isSplit } = info;
	if (isSplit && image?.url) {
		// Wide screens: the page shows this photo across half the screen (see
		// `onSplitImageChange`). Narrow screens: a banner above the question.
		return (
			<>
				<div className="flex flex-col gap-5">
					<div className="relative @3xl/page:hidden shrink-0">
						<img
							alt={image.alt ?? ""}
							className="h-40 w-full rounded-xl object-cover"
							height={320}
							src={image.url}
							style={imageCss(image)}
							width={720}
						/>
						<ImageCredit credit={image.credit} />
					</div>
					{fields}
				</div>
				{nav}
			</>
		);
	}
	return (
		<>
			{fields}
			{nav}
		</>
	);
}

/** The step's fields, plus a "stack" image above them when the page/lead field has one. */
function StepFields({
	disabled,
	errors,
	form,
	formSlug,
	image,
	index,
	mergedContext,
	onChange,
	size,
	step,
	stateFor,
	values,
}: {
	disabled: boolean;
	errors: Record<string, string>;
	form: PublicFormDto;
	formSlug: string;
	image: ReturnType<typeof imageInfo>;
	index: number;
	mergedContext: Record<string, unknown>;
	onChange: (field: FormField, value: unknown) => void;
	size: PublicFormDto["size"];
	step: FormField[];
	stateFor: FormEngine["stateFor"];
	values: Record<string, unknown>;
}) {
	return (
		<div
			className="fade-in slide-in-from-bottom-2 flex animate-in flex-col gap-5 duration-300"
			key={index}
		>
			{image.isStack && image.image?.url ? (
				<div className="relative">
					<img
						alt={image.image.alt ?? ""}
						className="max-h-56 w-full rounded-xl object-cover"
						height={280}
						src={image.image.url}
						style={imageCss(image.image)}
						width={720}
					/>
					<ImageCredit credit={image.image.credit} />
				</div>
			) : null}
			{step.map((field) => {
				const state = stateFor(field);
				return (
					<FieldRenderer
						borderRadius={form.borderRadius}
						disabled={disabled || state.disabled}
						error={errors[field.id]}
						field={field}
						formSlug={formSlug}
						hidden={state.hidden}
						key={field.id}
						mentionValues={mergedContext}
						onChange={(value) => onChange(field, value)}
						presentation="focused"
						required={state.required}
						size={size}
						theme={form.theme}
						uppercaseLabels={form.uppercaseLabels}
						value={values[field.id]}
					/>
				);
			})}
		</div>
	);
}

export function FocusedPresentation({
	disabled,
	dict,
	engine,
	fields,
	form,
	formSlug,
	onSplitImageChange,
	onSubmit,
	submitting,
}: FocusedPresentationProps) {
	const { errors, mergedContext, setError, setValue, stateFor, values } =
		engine;
	const [stepIndex, setStepIndex] = useState(0);

	const pageImages = (form.settings as Record<string, unknown> | undefined)
		?.pageImages as Record<string, BlockImage> | undefined;

	const steps = useMemo(
		() => buildSteps(fields, (f) => stateFor(f).hidden, pageImages),
		[fields, stateFor, pageImages]
	);
	const index = Math.min(stepIndex, Math.max(steps.length - 1, 0));
	const step = steps[index] ?? { fields: [], validateIds: [] };
	const isLast = index === steps.length - 1;
	const nextLabel = form.translations?.focused_next_button_text || dict.next;
	const showArrows = Boolean(form.settings?.navigation_arrows);
	// A question or a whole page can carry an illustration
	// in one of 4 layouts — "stack" (above), "split-left"/"split-right"
	// (image fills half the step, Typeform-style, collapsing to a top banner
	// on mobile), or "wallpaper" (full-bleed background with a dim overlay).
	const image = imageInfo(step.image);
	const splitUrl =
		image.isSplit || image.isWallpaper ? image.image?.url : undefined;
	let splitSide: SplitImage["side"] = "left";
	if (image.isWallpaper) {
		splitSide = "full";
	} else if (image.layout === "split-right") {
		splitSide = "right";
	}
	useEffect(() => {
		if (!onSplitImageChange) {
			return;
		}
		onSplitImageChange(
			splitUrl && image.image ? { image: image.image, side: splitSide } : null
		);
	}, [splitUrl, splitSide, onSplitImageChange, image.image]);

	// A multi-field page only auto-advances when it has exactly one
	// real (non-layout) question — the same rule a single-question screen
	// already followed, generalized so a page with several questions never
	// jumps forward on the respondent while they're still answering others.
	const autoAdvanceField = useMemo(() => {
		const inputFields = step.fields.filter((f) => isInputType(f.type));
		return inputFields.length === 1 ? inputFields[0] : null;
	}, [step.fields]);

	function advance() {
		if (step.validateIds.length === 0) {
			setStepIndex((i) => Math.min(i + 1, steps.length - 1));
			return;
		}
		const result = validateSubmission(
			fields,
			{ ...values, ...mergedContext },
			{ onlyFieldIds: step.validateIds }
		);
		const relevant = Object.entries(result.errors).filter(([id]) =>
			step.validateIds.includes(id)
		);
		if (relevant.length > 0) {
			for (const [id, message] of relevant) {
				setError(id, message);
			}
			return;
		}
		setStepIndex((i) => Math.min(i + 1, steps.length - 1));
	}

	function back() {
		setStepIndex((i) => Math.max(i - 1, 0));
	}

	function handleChange(field: FormField, value: unknown) {
		setValue(field.id, value);
		if (
			form.settings?.auto_next &&
			autoAdvanceField?.id === field.id &&
			AUTO_NEXT_TYPES.has(field.type)
		) {
			setTimeout(advance, 200);
		}
	}

	const stepFields: ReactNode = (
		<StepFields
			disabled={disabled}
			errors={errors}
			form={form}
			formSlug={formSlug}
			image={image}
			index={index}
			mergedContext={mergedContext}
			onChange={handleChange}
			size={form.size}
			stateFor={stateFor}
			step={step.fields}
			values={values}
		/>
	);
	const nav: ReactNode = (
		<div className="flex items-center justify-between gap-3">
			<div className="flex items-center gap-2">
				{index > 0 ? (
					<button
						className={outlineButtonTheme()}
						disabled={disabled || submitting}
						onClick={back}
						type="button"
					>
						{dict.previous}
					</button>
				) : null}
				{showArrows ? (
					<div className="flex flex-col gap-1">
						<Button
							disabled={index === 0}
							onClick={back}
							size="icon-sm"
							type="button"
							variant="ghost"
						>
							<ChevronUp className="size-4" />
						</Button>
						<Button
							disabled={isLast}
							onClick={advance}
							size="icon-sm"
							type="button"
							variant="ghost"
						>
							<ChevronDown className="size-4" />
						</Button>
					</div>
				) : null}
			</div>
			{isLast ? (
				<button
					className={submitButtonTheme()}
					disabled={disabled || submitting}
					onClick={onSubmit}
					type="button"
				>
					{submitting ? dict.submitting : form.submitButtonText || dict.submit}
				</button>
			) : (
				<button
					className={submitButtonTheme()}
					disabled={disabled}
					onClick={advance}
					type="button"
				>
					{resolveMentions(nextLabel, mergedContext) || nextLabel}
				</button>
			)}
		</div>
	);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Enter-to-advance shortcut on the step container; every focusable control inside remains independently operable
		// biome-ignore lint/a11y/noNoninteractiveElementInteractions: same as above
		<div
			className={
				"flex min-h-80 flex-col justify-between gap-6 transition-all duration-300"
			}
			onKeyDown={(e) => {
				if (
					e.key === "Enter" &&
					(e.target as HTMLElement).tagName !== "TEXTAREA"
				) {
					e.preventDefault();
					if (isLast) {
						onSubmit();
					} else {
						advance();
					}
				}
			}}
		>
			<StepBody fields={stepFields} info={image} nav={nav} />
		</div>
	);
}
