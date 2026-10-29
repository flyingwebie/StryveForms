import type { form } from "@StryveForms/db/schema/forms";
import {
	applyWorkspaceBrand,
	extractNestedBrandValues,
	type FormBrandLink,
	resolveClassicLayout,
	resolveTopImage,
	type WorkspaceBrand,
} from "@StryveForms/forms/brand";
import type {
	FormSettings,
	FormUpdate,
	ImageCredit,
} from "@StryveForms/forms/settings";
import type { ComputedVariable, FormField } from "@StryveForms/forms/types";

import type { AppConfig } from "../context";
import { shareUrl } from "./files";

export type FormRow = typeof form.$inferSelect;
export type FormInsert = typeof form.$inferInsert;

/** Everything the editor needs. Never includes the password hash. */
export function toFormDto(row: FormRow, config: AppConfig) {
	const settings: FormSettings = {
		title: row.title,
		visibility: row.visibility,
		tags: row.tags,
		properties: row.properties as FormSettings["properties"],
		computedVariables:
			row.computedVariables as FormSettings["computedVariables"],
		language: row.language as FormSettings["language"],
		fontFamily: row.fontFamily,
		customDomain: row.customDomain,
		size: row.size as FormSettings["size"],
		borderRadius: row.borderRadius as FormSettings["borderRadius"],
		theme: row.theme as FormSettings["theme"],
		presentationStyle:
			row.presentationStyle as FormSettings["presentationStyle"],
		width: row.width as FormSettings["width"],
		layoutRtl: row.layoutRtl,
		coverPicture: row.coverPicture,
		coverSettings: (row.coverSettings ?? null) as FormSettings["coverSettings"],
		logoPicture: row.logoPicture,
		darkMode: row.darkMode as FormSettings["darkMode"],
		color: row.color,
		uppercaseLabels: row.uppercaseLabels,
		useWorkspaceBrand: row.useWorkspaceBrand,
		brandOverrides: row.brandOverrides as FormSettings["brandOverrides"],
		noBranding: row.noBranding,
		transparentBackground: row.transparentBackground,
		translations: (row.translations ?? {}) as FormSettings["translations"],
		settings: row.settings as FormSettings["settings"],
		customCode: row.customCode,
		customCss: row.customCss,
		submitButtonText: row.submitButtonText,
		databaseFieldsUpdate: row.databaseFieldsUpdate ?? null,
		clearEmptyFieldsOnUpdate: row.clearEmptyFieldsOnUpdate,
		reFillable: row.reFillable,
		reFillButtonText: row.reFillButtonText,
		submittedText: row.submittedText,
		redirectUrl: row.redirectUrl,
		useCaptcha: row.useCaptcha,
		captchaProvider: row.captchaProvider as FormSettings["captchaProvider"],
		closesAt: row.closesAt ? row.closesAt.toISOString() : null,
		closedText: row.closedText,
		maxSubmissionsCount: row.maxSubmissionsCount,
		maxSubmissionsReachedText: row.maxSubmissionsReachedText,
		editableSubmissions: row.editableSubmissions,
		editableSubmissionsButtonText: row.editableSubmissionsButtonText,
		/** Shows a "Download PDF" button on the respondent success screen (pdf feature). */
		pdfDownloadEnabled: row.pdfDownloadEnabled,
		pdfDownloadButtonText: row.pdfDownloadButtonText,
		confettiOnSubmission: row.confettiOnSubmission,
		showProgressBar: row.showProgressBar,
		autoSave: row.autoSave,
		autoFocus: row.autoFocus,
		enablePartialSubmissions: row.enablePartialSubmissions,
		enableIpTracking: row.enableIpTracking,
		submissionRetentionValue: row.submissionRetentionValue,
		submissionRetentionUnit:
			row.submissionRetentionUnit as FormSettings["submissionRetentionUnit"],
		canBeIndexed: row.canBeIndexed,
		seoMeta: row.seoMeta as FormSettings["seoMeta"],
		analytics: row.analytics as FormSettings["analytics"],
	};
	return {
		...settings,
		id: row.id,
		slug: row.slug,
		workspaceId: row.workspaceId,
		creatorId: row.creatorId,
		hasPassword: row.passwordHash !== null,
		removedProperties: row.removedProperties as FormField[],
		shareUrl: shareUrl(config, row.slug, row.customDomain),
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

export type FormDto = ReturnType<typeof toFormDto>;

/** Maps an update payload onto DB columns. */
export function toFormColumns(update: FormUpdate): Partial<FormInsert> {
	const { closesAt, coverSettings, ...rest } = update;
	const columns: Partial<FormInsert> = { ...rest } as Partial<FormInsert>;
	if (closesAt !== undefined) {
		columns.closesAt = closesAt ? new Date(closesAt) : null;
	}
	if (coverSettings !== undefined) {
		columns.coverSettings = coverSettings ?? null;
	}
	return columns;
}

/**
 * Classic-layout-related fields, split out of `toPublicFormDto` to
 * keep that function's complexity down. `branded` is the form's brand-merged
 * values (see `applyWorkspaceBrand`); `coverPicture` is the form's own raw
 * (never brand-controlled) legacy field.
 */
function resolveClassicPresentation(
	branded: Record<string, unknown>,
	coverPicture: string | null
) {
	const headerImage = resolveTopImage({
		coverPicture,
		headerImage: (branded.headerImage as string | null | undefined) ?? null,
	});
	// Migration-on-read: older forms never set `classicLayout` explicitly —
	// derive the matching preset from their `layout` + background/header
	// image combination so they keep rendering exactly as before. See
	// `resolveClassicLayout` for the full migration rules.
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
		showBrandLogo: (branded.showBrandLogo as boolean | undefined) ?? true,
	};
}

/**
 * Subset of a form safe to send to respondents. When `brand` is given and the
 * form follows its workspace brand, brand-controlled design values (color,
 * font, theme, border radius, size, dark mode, uppercase labels, logo, width)
 * are replaced by the workspace's, except the keys the form overrides itself.
 */
export function toPublicFormDto(
	row: FormRow,
	config: AppConfig,
	brand?: WorkspaceBrand | null
) {
	const dto = toFormDto(row, config);
	const link: FormBrandLink = {
		brandOverrides: dto.brandOverrides,
		useWorkspaceBrand: dto.useWorkspaceBrand,
	};
	const nestedSettings = (dto.settings ?? {}) as Record<string, unknown>;
	// The round-5 brand extras (layout, frame colours, background/header image…)
	// live inside the `settings` jsonb blob instead of their own column; flatten
	// them alongside the real columns so `applyWorkspaceBrand` can merge all of
	// them the same way, then read the merged values back out below.
	const branded = applyWorkspaceBrand(
		{ ...dto, ...extractNestedBrandValues(nestedSettings) },
		link,
		brand
	);
	const classicPresentation = resolveClassicPresentation(
		branded,
		dto.coverPicture
	);
	return {
		id: dto.id,
		slug: dto.slug,
		title: dto.title,
		visibility: dto.visibility,
		properties: dto.properties as FormField[],
		computedVariables: dto.computedVariables as ComputedVariable[],
		language: dto.language,
		fontFamily: branded.fontFamily,
		size: branded.size,
		borderRadius: branded.borderRadius,
		theme: branded.theme,
		presentationStyle: dto.presentationStyle,
		width: branded.width,
		layoutRtl: dto.layoutRtl,
		coverPicture: dto.coverPicture,
		coverSettings: dto.coverSettings,
		logoPicture: branded.logoPicture,
		logoPictureDark:
			(branded.logoPictureDark as string | null | undefined) ?? null,
		darkMode: branded.darkMode,
		color: branded.color,
		uppercaseLabels: branded.uppercaseLabels,
		noBranding: branded.noBranding as boolean,
		transparentBackground: dto.transparentBackground,
		translations: dto.translations,
		settings: dto.settings,
		layout: (branded.layout as "framed" | "frameless" | undefined) ?? "framed",
		pageBackgroundColor:
			(branded.pageBackgroundColor as string | null | undefined) ?? null,
		frameBackgroundColor:
			(branded.frameBackgroundColor as string | null | undefined) ?? null,
		frameBorderColor:
			(branded.frameBorderColor as string | null | undefined) ?? null,
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
		/** Attribution for `backgroundImage`, when picked from Unsplash (T's ImagePicker). */
		backgroundImageCredit: classicPresentation.backgroundImageCredit,
		// Migration-on-read: the legacy `coverPicture` field was saved
		// but never rendered; it's now folded into the single "top image"
		// concept alongside `headerImage`, and `classicLayout` is derived from
		// the old layout/background/header combination when unset — see
		// `resolveClassicPresentation` above.
		headerImage: classicPresentation.headerImage,
		headerImageHeight: (branded.headerImageHeight as number | undefined) ?? 160,
		/** Attribution for `headerImage`, when picked from Unsplash (T's ImagePicker). */
		headerImageCredit: classicPresentation.headerImageCredit,
		classicLayout: classicPresentation.classicLayout,
		showBrandLogo: classicPresentation.showBrandLogo,
		focusedImageLayoutDefault:
			(nestedSettings.focusedImageLayoutDefault as string | undefined) ??
			"none",
		customCode: dto.customCode,
		customCss: dto.customCss,
		submitButtonText: dto.submitButtonText,
		reFillable: dto.reFillable,
		reFillButtonText: dto.reFillButtonText,
		submittedText: dto.submittedText,
		useCaptcha: dto.useCaptcha,
		captchaProvider: dto.captchaProvider,
		closedText: dto.closedText,
		maxSubmissionsReachedText: dto.maxSubmissionsReachedText,
		editableSubmissions: dto.editableSubmissions,
		editableSubmissionsButtonText: dto.editableSubmissionsButtonText,
		pdfDownloadEnabled: dto.pdfDownloadEnabled,
		pdfDownloadButtonText: dto.pdfDownloadButtonText,
		confettiOnSubmission: dto.confettiOnSubmission,
		showProgressBar: dto.showProgressBar,
		autoSave: dto.autoSave,
		autoFocus: dto.autoFocus,
		enablePartialSubmissions: dto.enablePartialSubmissions,
		canBeIndexed: dto.canBeIndexed,
		seoMeta: dto.seoMeta,
		analytics: dto.analytics,
		shareUrl: dto.shareUrl,
		hasPassword: dto.hasPassword,
	};
}

export type PublicFormDto = ReturnType<typeof toPublicFormDto>;
