import type { PublicFormDto } from "@StryveForms/api/lib/serialize";
import { showsClassicLayoutImages } from "@StryveForms/forms/presentation";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ENV } from "@/env";
import { useTRPC } from "@/utils/trpc";
import { BrandingBadge } from "./branding-badge";
import { CaptchaWidget } from "./captcha-widget";
import { ClassicPresentation } from "./classic-presentation";
import { FocusedPresentation, type SplitImage } from "./focused-presentation";
import { type FormDictionary, getDictionary } from "./i18n";
import { ImageCredit } from "./image-credit";
import { SuccessScreen } from "./success-screen";
import {
	FRAME_SHADOW_VALUE,
	fontFamilyStack,
	formColorVars,
	surfaceTheme,
	useResolvedColorScheme,
} from "./theme";
import type { FormRendererProps, RendererMode } from "./types";
import { useFormEngine } from "./use-form-engine";

const AUTOSAVE_DEBOUNCE_MS = 800;
const PARTIAL_SUBMIT_DEBOUNCE_MS = 3000;

/** Picks the light or dark logo for the resolved scheme, falling back to the other one when only it is set (item 17). */
function resolveLogo(
	form: PublicFormDto,
	scheme: "light" | "dark"
): string | null {
	if (scheme === "dark") {
		return form.logoPictureDark || form.logoPicture;
	}
	return form.logoPicture || form.logoPictureDark;
}

/** Inline style for the card ("frame"): brand background/border/shadow when framed, none when frameless. */
function frameStyleFor(
	form: PublicFormDto,
	framed: boolean
): React.CSSProperties {
	if (!framed) {
		return { background: "none", boxShadow: "none" };
	}
	return {
		backgroundColor: form.frameBackgroundColor || undefined,
		borderColor: form.frameBorderColor || undefined,
		borderStyle: form.frameBorderWidth ? "solid" : undefined,
		borderWidth: form.frameBorderWidth
			? `${form.frameBorderWidth}px`
			: undefined,
		boxShadow: FRAME_SHADOW_VALUE[form.frameShadow],
	};
}

/** Full-bleed background image + dim/blur overlay behind the page — only for the "Card on background image" Classic layout, in Classic forms. */
function BackgroundImageLayer({ form }: { form: PublicFormDto }) {
	if (
		!(
			showsClassicLayoutImages(form.presentationStyle) &&
			form.classicLayout === "card-on-background" &&
			form.backgroundImage
		)
	) {
		return null;
	}
	return (
		<div className="absolute inset-0 -z-10 overflow-hidden">
			<div
				aria-hidden="true"
				className="absolute inset-0"
				style={{
					backgroundImage: `url(${form.backgroundImage})`,
					backgroundPosition: `${form.backgroundImagePositionX}% ${form.backgroundImagePositionY}%`,
					backgroundSize: form.backgroundImageFit,
					filter: form.backgroundOverlayBlur
						? `blur(${form.backgroundOverlayBlur}px)`
						: undefined,
				}}
			/>
			{form.backgroundOverlayOpacity ? (
				<div
					aria-hidden="true"
					className="absolute inset-0 bg-black"
					style={{ opacity: form.backgroundOverlayOpacity / 100 }}
				/>
			) : null}
			<ImageCredit credit={form.backgroundImageCredit ?? undefined} />
		</div>
	);
}

/** "Powered by StryveForms" badge, hidden when the brand/form opts out. */
function OptionalBrandingBadge({
	dict,
	form,
}: {
	dict: FormDictionary;
	form: PublicFormDto;
}) {
	return form.noBranding ? null : <BrandingBadge dict={dict} />;
}

/** Form logo above the title, already resolved to the light/dark variant and the "Show brand logo" toggle. */
function FormLogo({ show, src }: { show: boolean; src: string | null }) {
	if (!(show && src)) {
		return null;
	}
	return (
		<img
			alt=""
			className="mx-auto mb-4 h-12 w-auto object-contain"
			height={48}
			src={src}
			width={160}
		/>
	);
}

/** Banner image above the form — for the "Header image" and "Card with header image" Classic layouts, in Classic forms. */
function HeaderImage({ form }: { form: PublicFormDto }) {
	const showsHeader =
		showsClassicLayoutImages(form.presentationStyle) &&
		(form.classicLayout === "header-image" ||
			form.classicLayout === "card-with-header");
	if (!(showsHeader && form.headerImage)) {
		return null;
	}
	return (
		<div className="relative mb-4">
			<img
				alt=""
				className="w-full rounded-xl object-cover"
				height={form.headerImageHeight}
				src={form.headerImage}
				style={{ height: form.headerImageHeight }}
				width={1200}
			/>
			<ImageCredit credit={form.headerImageCredit ?? undefined} />
		</div>
	);
}

/** "Transparent background": the page
 * behind the form shows through instead of a solid colour. In embed mode
 * this is what lets the host page's own background show through the iframe
 * (see routes/forms/$slug.tsx, which also clears the surrounding html/body
 * background when embedded). */
function resolvedPageBackgroundColor(form: PublicFormDto): string | undefined {
	return form.transparentBackground
		? "transparent"
		: form.pageBackgroundColor || undefined;
}

/** Page padding/height for the live (non-preview) renderer: a full-viewport
 * height with generous padding normally, or — embedded (`?embed=1`) — no
 * forced min-height, so the iframe's auto-resize can shrink to fit the form. */
function livePagePadding(
	mode: RendererMode,
	embed: boolean | undefined
): string {
	if (mode !== "live") {
		return "";
	}
	return embed ? "px-3 py-4" : "min-h-svh px-4 py-10";
}

/**
 * Moves keyboard focus to a field's input (after a page change has
 * rendered), so keyboard and screen-reader users land on the first error
 * instead of staying on the submit button.
 */
function focusField(fieldId: string) {
	if (typeof window === "undefined") {
		return;
	}
	window.requestAnimationFrame(() => {
		const el = document.getElementById(fieldId);
		if (!el) {
			return;
		}
		const target = el.matches(FOCUSABLE)
			? el
			: el.querySelector<HTMLElement>(FOCUSABLE);
		(target ?? el).focus({ preventScroll: true });
		el.scrollIntoView({ behavior: "smooth", block: "center" });
	});
}

const FOCUSABLE =
	'input:not([type="hidden"]), textarea, select, button, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function autosaveKey(formId: string): string {
	return `stryveforms:autosave:${formId}`;
}

/** Pulls `error.data.fieldErrors` out of a tRPC BAD_REQUEST without importing trpc/client's generics. */
function fieldErrorsOf(error: unknown): Record<string, string> | null {
	if (!(error && typeof error === "object" && "data" in error)) {
		return null;
	}
	const { data } = error as { data: unknown };
	if (!(data && typeof data === "object" && "fieldErrors" in data)) {
		return null;
	}
	const { fieldErrors } = data as { fieldErrors: unknown };
	return fieldErrors && typeof fieldErrors === "object"
		? (fieldErrors as Record<string, string>)
		: null;
}

function captchaSiteKeyFor(
	provider: "hcaptcha" | "recaptcha" | "turnstile"
): string {
	const keys = {
		hcaptcha: ENV.VITE_HCAPTCHA_SITE_KEY,
		recaptcha: ENV.VITE_RECAPTCHA_SITE_KEY,
		turnstile: ENV.VITE_TURNSTILE_SITE_KEY,
	};
	return keys[provider] ?? "";
}

function readAutosave(formId: string): Record<string, unknown> | undefined {
	if (typeof window === "undefined") {
		return;
	}
	try {
		const raw = window.localStorage.getItem(autosaveKey(formId));
		return raw ? (JSON.parse(raw) as Record<string, unknown>) : undefined;
	} catch {
		// Corrupt or inaccessible storage — ignore and start fresh.
	}
}

/**
 * Renders a public form: all field types, classic/focused presentation,
 * live logic & validation, theming, and (in `live` mode) submission to the API.
 */
/** Pushes the form into the other half of the page while a split photo shows (wide layouts only). */
function splitOffsetClass(split: SplitImage | null): string {
	if (!split || split.side === "full") {
		return "";
	}
	return split.side === "left"
		? "@3xl/page:ml-[50%] @3xl/page:pl-6"
		: "@3xl/page:mr-[50%] @3xl/page:pr-6";
}

/** A focused question's photo: one half of the page (split) or the whole background (wallpaper), Typeform-style. */
function SplitImagePanel({ split }: { split: SplitImage | null }) {
	if (!split) {
		return null;
	}
	const { image, side } = split;
	const x = image.focal_point?.x ?? 50;
	const y = image.focal_point?.y ?? 50;
	if (side === "full") {
		return (
			<div className="absolute inset-0 -z-10 overflow-hidden">
				<div aria-hidden="true" className="absolute inset-0">
					<img
						alt=""
						className="fade-in size-full animate-in object-cover duration-500"
						height={900}
						key={image.url}
						src={image.url}
						style={{
							filter: image.brightness
								? `brightness(${1 + image.brightness / 100})`
								: undefined,
							objectPosition: `${x}% ${y}%`,
						}}
						width={1440}
					/>
					<div className="absolute inset-0 bg-black/35" />
				</div>
				<ImageCredit credit={image.credit} />
			</div>
		);
	}
	return (
		<div
			className={`absolute inset-y-0 @3xl/page:block hidden w-1/2 ${side === "left" ? "left-0" : "right-0"}`}
		>
			<img
				alt={image.alt ?? ""}
				className="fade-in size-full animate-in object-cover duration-500"
				height={900}
				key={image.url}
				src={image.url}
				style={{
					filter: image.brightness
						? `brightness(${1 + image.brightness / 100})`
						: undefined,
					objectPosition: `${x}% ${y}%`,
				}}
				width={720}
			/>
			<ImageCredit credit={image.credit} />
		</div>
	);
}

export function FormRenderer({
	autoSubmit,
	className,
	embed,
	form,
	initialValues,
	mode,
	onPartialSaved,
	onSubmitted,
	submissionId: editingSubmissionId,
	tracking,
}: FormRendererProps) {
	const trpc = useTRPC();
	const dict = useMemo(() => getDictionary(form.language), [form.language]);
	const startedAtRef = useRef(Date.now());
	// SSR renders the form fully (for SEO) but disabled: a respondent on a slow
	// connection could otherwise type into the server-rendered inputs before
	// hydration attaches, and React's hydration pass would then overwrite that
	// text once it syncs the DOM to the (still-empty) initial state. Flipping
	// this after mount re-enables the form without ever risking that stomp.
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);
	const [captchaToken, setCaptchaToken] = useState<string | undefined>();
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | undefined>();
	const [result, setResult] = useState<{
		data: Record<string, unknown>;
		redirectUrl?: string | null;
		submissionId?: string;
	} | null>(null);
	const partialSubmissionIdRef = useRef<string | undefined>(
		editingSubmissionId ?? undefined
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: only ever re-seed from autosave once, on the identity of the form being rendered
	const seededInitialValues = useMemo(() => {
		if (mode !== "live" || !form.autoSave || editingSubmissionId) {
			return initialValues;
		}
		const saved = readAutosave(form.id);
		return saved ? { ...saved, ...initialValues } : initialValues;
	}, [form.id]);

	const engine = useFormEngine(
		form.properties,
		form.computedVariables,
		seededInitialValues
	);

	const submitMutation = useMutation(trpc.public.submit.mutationOptions());

	// Local autosave of in-progress answers.
	useEffect(() => {
		if (mode !== "live" || !form.autoSave || typeof window === "undefined") {
			return;
		}
		const timer = setTimeout(() => {
			window.localStorage.setItem(
				autosaveKey(form.id),
				JSON.stringify(engine.values)
			);
		}, AUTOSAVE_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [engine.values, form.autoSave, form.id, mode]);

	// Debounced partial submission, so an incomplete form is still saved server-side.
	// biome-ignore lint/correctness/useExhaustiveDependencies: `submitMutation`/`tracking`/`onPartialSaved` are stable for the component's lifetime; only re-debounce on answer changes
	useEffect(() => {
		if (mode !== "live" || !form.enablePartialSubmissions || result) {
			return;
		}
		const timer = setTimeout(() => {
			submitMutation.mutate(
				{
					data: engine.values,
					isPartial: true,
					slug: form.slug,
					submissionId: partialSubmissionIdRef.current,
					tracking,
				},
				{
					onSuccess: (res) => {
						if (res.submissionId) {
							partialSubmissionIdRef.current = res.submissionId;
							onPartialSaved?.(res.submissionId);
						}
					},
				}
			);
		}, PARTIAL_SUBMIT_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [engine.values, form.enablePartialSubmissions, form.slug, mode, result]);

	function focusFirstError(errors: Record<string, string>) {
		const firstId = form.properties.find((f) => errors[f.id])?.id;
		if (!firstId) {
			return;
		}
		const pageIndex = engine.pages.findIndex((page) =>
			page.some((f) => f.id === firstId)
		);
		if (pageIndex >= 0) {
			engine.goToPage(pageIndex);
		}
		focusField(firstId);
	}

	function applyFieldErrors(errors: Record<string, string>) {
		for (const [fieldId, message] of Object.entries(errors)) {
			engine.setError(fieldId, message);
		}
		focusFirstError(errors);
	}

	function handleSubmitFailure(error: unknown) {
		const serverFieldErrors = fieldErrorsOf(error);
		if (serverFieldErrors) {
			applyFieldErrors(serverFieldErrors);
		} else {
			setSubmitError(
				"Something went wrong submitting the form. Please try again."
			);
		}
	}

	async function handleSubmit() {
		const validation = engine.validateAll();
		if (!validation.valid) {
			applyFieldErrors(validation.errors);
			return;
		}
		if (form.useCaptcha && !captchaToken) {
			setSubmitError("Please complete the captcha.");
			return;
		}
		setSubmitError(undefined);

		if (mode === "preview") {
			setResult({ data: validation.data });
			onSubmitted?.({ data: validation.data });
			return;
		}

		setSubmitting(true);
		try {
			const completionTime = Math.round(
				(Date.now() - startedAtRef.current) / 1000
			);
			const response = await submitMutation.mutateAsync({
				captchaToken,
				completionTime,
				data: validation.data,
				slug: form.slug,
				submissionId: partialSubmissionIdRef.current,
				tracking,
			});
			if (typeof window !== "undefined" && form.autoSave) {
				window.localStorage.removeItem(autosaveKey(form.id));
			}
			const outcome = {
				completionTime,
				data: response.data as Record<string, unknown>,
				redirectUrl: response.redirectUrl,
				submissionId: response.submissionId,
			};
			setResult(outcome);
			onSubmitted?.(outcome);
		} catch (error) {
			handleSubmitFailure(error);
		} finally {
			setSubmitting(false);
		}
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: fires once on mount to honor `?auto_submit=true`
	useEffect(() => {
		if (!autoSubmit || result) {
			return;
		}
		const validation = engine.validateAll();
		if (validation.valid) {
			handleSubmit();
		}
	}, [autoSubmit]);

	const style = {
		...formColorVars(form.color),
		fontFamily: fontFamilyStack(form.fontFamily),
	};
	// Resolves "auto"/"light"/"dark" to what this respondent actually sees,
	// independent of the host page's own dark mode, so the right logo and
	// brand colours always show (item 17: light/dark logo by resolved scheme).
	const scheme = useResolvedColorScheme(form.darkMode);
	// Focused forms: the current question's split photo, shown across half the page.
	const [splitImage, setSplitImage] = useState<SplitImage | null>(null);
	const schemeClass = scheme === "dark" ? "dark" : "";
	const resolvedLogo = resolveLogo(form, scheme);
	const pageBackgroundColor = resolvedPageBackgroundColor(form);
	const pagePadding = livePagePadding(mode, embed);

	// The Classic layout preset (item 1: "card" / "card-on-background" /
	// "header-image" / "card-with-header") decides whether a Classic form sits
	// in a framed card at all; `BackgroundImageLayer`/`HeaderImage` above
	// decide whether the background/header image for the other presets show.
	// Focused forms always use the card: their images come from questions.
	const framed =
		!showsClassicLayoutImages(form.presentationStyle) ||
		form.classicLayout !== "header-image";
	const frameStyle = frameStyleFor(form, framed);

	const cardClass = `${surfaceTheme({ borderRadius: form.borderRadius, theme: form.theme, transparentBackground: !framed })} @container w-full p-6`;
	const columnClass = `relative mx-auto w-full ${form.width === "full" ? "" : "max-w-2xl"}`;

	if (result) {
		// Same page, header image and card as the form itself, so the
		// thank-you screen doesn't jump to an unstyled page.
		return (
			<div
				className={`${schemeClass} @container/page relative isolate ${pagePadding} ${className ?? ""}`}
				style={{ ...style, backgroundColor: pageBackgroundColor }}
			>
				<BackgroundImageLayer form={form} />
				<div className={columnClass}>
					<HeaderImage form={form} />
					<div
						className={cardClass}
						dir={form.layoutRtl ? "rtl" : "ltr"}
						style={frameStyle}
					>
						<FormLogo show={form.showBrandLogo} src={resolvedLogo} />
						<SuccessScreen
							data={result.data}
							dict={dict}
							form={form}
							onRefill={() => {
								setResult(null);
								engine.reset();
								partialSubmissionIdRef.current = undefined;
							}}
							redirectUrl={result.redirectUrl}
							submissionId={result.submissionId}
						/>
						<OptionalBrandingBadge dict={dict} form={form} />
					</div>
				</div>
			</div>
		);
	}

	const captchaSiteKey = captchaSiteKeyFor(form.captchaProvider);
	// Only the live, SSR'd page needs the hydration gate — the editor's preview
	// mounts client-only, so it can be interactive immediately.
	const notInteractive = mode === "live" && !mounted;

	return (
		<div
			className={`${schemeClass} @container/page relative isolate ${pagePadding} ${className ?? ""}`}
			style={{ ...style, backgroundColor: pageBackgroundColor }}
		>
			<BackgroundImageLayer form={form} />
			<SplitImagePanel split={splitImage} />

			<div className={splitOffsetClass(splitImage)}>
				<div className={columnClass}>
					<HeaderImage form={form} />
					<div
						// `@container`: field widths below respond to this box's own size
						// (e.g. a narrow embed, or a real phone), not the browser viewport.
						className={cardClass}
						dir={form.layoutRtl ? "rtl" : "ltr"}
						style={frameStyle}
					>
						<FormLogo show={form.showBrandLogo} src={resolvedLogo} />
						<h1 className="mb-6 font-semibold text-xl">{form.title}</h1>

						{notInteractive ? (
							<div className="mb-3 flex items-center gap-2 text-neutral-400 text-xs">
								<Loader2 className="size-3.5 animate-spin" />
								{dict.loading}
							</div>
						) : null}

						<div
							aria-busy={notInteractive}
							className={
								notInteractive
									? "pointer-events-none opacity-70 transition-opacity"
									: "transition-opacity"
							}
						>
							{form.presentationStyle === "focused" ? (
								<FocusedPresentation
									dict={dict}
									disabled={submitting || notInteractive}
									engine={engine}
									fields={form.properties}
									form={form}
									formSlug={form.slug}
									onSplitImageChange={setSplitImage}
									onSubmit={handleSubmit}
									submitting={submitting}
								/>
							) : (
								<ClassicPresentation
									dict={dict}
									disabled={submitting || notInteractive}
									engine={engine}
									form={form}
									formSlug={form.slug}
									onSubmit={handleSubmit}
									submitting={submitting}
								/>
							)}
						</div>

						{mode === "live" && form.useCaptcha && captchaSiteKey ? (
							<div className="mt-4">
								<CaptchaWidget
									onToken={setCaptchaToken}
									provider={form.captchaProvider}
									siteKey={captchaSiteKey}
								/>
							</div>
						) : null}

						{submitError ? (
							<p className="mt-3 text-red-500 text-sm">{submitError}</p>
						) : null}

						<OptionalBrandingBadge dict={dict} form={form} />
					</div>
				</div>
			</div>
		</div>
	);
}
