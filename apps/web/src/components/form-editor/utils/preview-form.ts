import type { PublicFormDto } from "@StryveForms/api/lib/serialize";
import {
	applyWorkspaceBrand,
	extractNestedBrandValues,
	type FormBrandLink,
	resolveClassicLayout,
	resolveTopImage,
	type WorkspaceBrand,
} from "@StryveForms/forms/brand";
import type { FormSettings, ImageCredit } from "@StryveForms/forms/settings";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/utils/trpc";
import { useEditor } from "../state/editor-context";
import type { EditorFormMeta } from "../types";

/**
 * Classic-layout-related fields, split out of `toPreviewForm` to
 * keep that function's complexity down. Mirrors
 * `@StryveForms/api/lib/serialize`'s `resolveClassicPresentation`.
 */
function resolveClassicPresentation(
	branded: Record<string, unknown>,
	coverPicture: string | null
) {
	const headerImage = resolveTopImage({
		coverPicture,
		headerImage: (branded.headerImage as string | null | undefined) ?? null,
	});
	const classicLayout = resolveClassicLayout({
		backgroundImage:
			(branded.backgroundImage as string | null | undefined) ?? null,
		classicLayout: branded.classicLayout as
			| "card"
			| "card-on-background"
			| "header-image"
			| "card-with-header"
			| undefined,
		coverPicture,
		headerImage: (branded.headerImage as string | null | undefined) ?? null,
		layout: (branded.layout as "framed" | "frameless" | undefined) ?? null,
	});
	return {
		backgroundImageCredit:
			(branded.backgroundImageCredit as ImageCredit | null | undefined) ?? null,
		classicLayout,
		headerImage,
		headerImageCredit:
			(branded.headerImageCredit as ImageCredit | null | undefined) ?? null,
		logoAlignment:
			(branded.logoAlignment as "left" | "center" | "right" | undefined) ??
			null,
		showBrandLogo: (branded.showBrandLogo as boolean | undefined) ?? true,
	};
}

/**
 * Builds the `PublicFormDto` shape the renderer expects out of editor state.
 * Pass the workspace's `brand` to preview the effective design a respondent
 * would see (brand-controlled keys applied, except the form's own overrides).
 */
export function toPreviewForm(
	settings: FormSettings,
	meta: EditorFormMeta,
	brand?: WorkspaceBrand | null
): PublicFormDto {
	const link: FormBrandLink = {
		brandOverrides: settings.brandOverrides,
		useWorkspaceBrand: settings.useWorkspaceBrand,
	};
	const nestedSettings = (settings.settings ?? {}) as Record<string, unknown>;
	// Round-5 brand extras (layout, frame colours, background/header image…)
	// live inside `settings.settings` instead of their own field — flatten
	// them for the merge, same as `toPublicFormDto` in packages/api does.
	const branded = applyWorkspaceBrand(
		{ ...settings, ...extractNestedBrandValues(nestedSettings) },
		link,
		brand
	);
	const classicPresentation = resolveClassicPresentation(
		branded,
		settings.coverPicture
	);
	return {
		id: meta.id,
		slug: meta.slug,
		title: settings.title,
		visibility: settings.visibility,
		properties: settings.properties as PublicFormDto["properties"],
		computedVariables:
			settings.computedVariables as PublicFormDto["computedVariables"],
		language: settings.language,
		fontFamily: branded.fontFamily,
		size: branded.size,
		borderRadius: branded.borderRadius,
		theme: branded.theme,
		presentationStyle: settings.presentationStyle,
		width: branded.width,
		layoutRtl: settings.layoutRtl,
		coverPicture: settings.coverPicture,
		coverSettings: settings.coverSettings,
		logoPicture: branded.logoPicture,
		logoPictureDark:
			(branded.logoPictureDark as string | null | undefined) ?? null,
		darkMode: branded.darkMode,
		color: branded.color,
		uppercaseLabels: branded.uppercaseLabels,
		noBranding: branded.noBranding as boolean,
		transparentBackground: settings.transparentBackground,
		translations: settings.translations,
		settings: settings.settings,
		layout: (branded.layout as "framed" | "frameless" | undefined) ?? "framed",
		pageBackgroundColor:
			(branded.pageBackgroundColor as string | null | undefined) ?? null,
		frameBackgroundColor:
			(branded.frameBackgroundColor as string | null | undefined) ?? null,
		frameBorderColor:
			(branded.frameBorderColor as string | null | undefined) ?? null,
		pageBackgroundColorDark:
			(branded.pageBackgroundColorDark as string | null | undefined) ?? null,
		frameBackgroundColorDark:
			(branded.frameBackgroundColorDark as string | null | undefined) ?? null,
		frameBorderColorDark:
			(branded.frameBorderColorDark as string | null | undefined) ?? null,
		frameBorderWidth: (branded.frameBorderWidth as number | undefined) ?? 0,
		frameShadow:
			(branded.frameShadow as "none" | "sm" | "md" | "lg" | undefined) ?? "sm",
		backgroundImage:
			(branded.backgroundImage as string | null | undefined) ?? null,
		backgroundImageFit:
			(branded.backgroundImageFit as "cover" | "contain" | undefined) ??
			"cover",
		backgroundImagePositionX:
			(branded.backgroundImagePositionX as number | undefined) ?? 50,
		backgroundImagePositionY:
			(branded.backgroundImagePositionY as number | undefined) ?? 50,
		backgroundOverlayOpacity:
			(branded.backgroundOverlayOpacity as number | undefined) ?? 0,
		backgroundOverlayBlur:
			(branded.backgroundOverlayBlur as number | undefined) ?? 0,
		backgroundImageCredit: classicPresentation.backgroundImageCredit,
		// Migration-on-read, same as `toPublicFormDto`: unify the
		// legacy `coverPicture` with `headerImage`, and derive `classicLayout`
		// from the old layout/background/header combination when unset.
		headerImage: classicPresentation.headerImage,
		headerImageHeight: (branded.headerImageHeight as number | undefined) ?? 160,
		headerImageCredit: classicPresentation.headerImageCredit,
		classicLayout: classicPresentation.classicLayout,
		logoAlignment: classicPresentation.logoAlignment,
		showBrandLogo: classicPresentation.showBrandLogo,
		focusedImageLayoutDefault:
			(nestedSettings.focusedImageLayoutDefault as string | undefined) ??
			"none",
		customCode: settings.customCode,
		customCss: settings.customCss,
		pdfDownloadButtonText: settings.pdfDownloadButtonText,
		pdfDownloadEnabled: settings.pdfDownloadEnabled,
		submitButtonText: settings.submitButtonText,
		reFillable: settings.reFillable,
		reFillButtonText: settings.reFillButtonText,
		submittedText: settings.submittedText,
		useCaptcha: settings.useCaptcha,
		captchaProvider: settings.captchaProvider,
		captchaSiteKey: null,
		closedText: settings.closedText,
		maxSubmissionsReachedText: settings.maxSubmissionsReachedText,
		editableSubmissions: settings.editableSubmissions,
		editableSubmissionsButtonText: settings.editableSubmissionsButtonText,
		confettiOnSubmission: settings.confettiOnSubmission,
		showProgressBar: settings.showProgressBar,
		autoSave: settings.autoSave,
		autoFocus: settings.autoFocus,
		enablePartialSubmissions: settings.enablePartialSubmissions,
		canBeIndexed: settings.canBeIndexed,
		seoMeta: settings.seoMeta,
		analytics: settings.analytics,
		shareUrl: meta.shareUrl,
		hasPassword: meta.hasPassword,
	};
}

/**
 * Editor preview with the workspace brand applied, same as what a respondent
 * would see on the public page. Use this instead of calling `toPreviewForm`
 * directly so the canvas/preview always reflects brand inheritance live.
 */
export function usePreviewForm(): PublicFormDto {
	const { meta, state } = useEditor();
	const trpc = useTRPC();
	const query = useQuery(
		trpc.workspace.get.queryOptions({ id: meta.workspaceId })
	);
	const brand = (query.data?.brand as WorkspaceBrand | undefined) ?? null;
	return toPreviewForm(state.settings, meta, brand);
}
