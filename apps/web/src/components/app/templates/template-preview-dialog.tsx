import type { PublicFormDto } from "@StryveForms/api/lib/serialize";
import {
	resolveClassicLayout,
	resolveTopImage,
} from "@StryveForms/forms/brand";
import {
	defaultFormSettings,
	type ImageCredit,
} from "@StryveForms/forms/settings";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@StryveForms/ui/components/dialog";

import { FormRenderer } from "@/components/form-renderer/form-renderer";

/** Classic-layout-related fields, split out of `buildPreviewForm` to keep
 * its complexity down — same migration-on-read as `toPublicFormDto`. */
function classicPresentationFor(
	nested: Record<string, unknown>,
	coverPicture: string | null
) {
	const headerImage = resolveTopImage({
		coverPicture,
		headerImage: (nested.headerImage as string | null | undefined) ?? null,
	});
	const classicLayout = resolveClassicLayout({
		backgroundImage:
			(nested.backgroundImage as string | null | undefined) ?? null,
		classicLayout: nested.classicLayout as
			| "card"
			| "card-on-background"
			| "header-image"
			| "card-with-header"
			| undefined,
		coverPicture,
		headerImage: (nested.headerImage as string | null | undefined) ?? null,
		layout: (nested.layout as "framed" | "frameless" | undefined) ?? null,
	});
	return {
		backgroundImageCredit:
			(nested.backgroundImageCredit as ImageCredit | null | undefined) ?? null,
		classicLayout,
		headerImage,
		headerImageCredit:
			(nested.headerImageCredit as ImageCredit | null | undefined) ?? null,
		showBrandLogo: (nested.showBrandLogo as boolean | undefined) ?? true,
	};
}

/**
 * Builds a throwaway `PublicFormDto` from a template's structure, purely for
 * the preview dialog — nothing here is saved or submitted anywhere.
 */
function buildPreviewForm(
	name: string,
	structure: Record<string, unknown>
): PublicFormDto {
	const settings = { ...defaultFormSettings(), ...structure };
	// Round-5 brand extras (layout, frame colours, background/header image…)
	// live inside `settings.settings` instead of their own field; this preview
	// has no workspace brand to merge, so just read the form's own value.
	const nested = (settings.settings ?? {}) as Record<string, unknown>;
	const classicPresentation = classicPresentationFor(
		nested,
		settings.coverPicture
	);
	return {
		...settings,
		title: (structure.title as string | undefined) ?? name,
		id: "preview",
		slug: "preview",
		useCaptcha: false,
		autoSave: false,
		properties: settings.properties as PublicFormDto["properties"],
		computedVariables:
			settings.computedVariables as PublicFormDto["computedVariables"],
		hasPassword: false,
		shareUrl: "",
		logoPictureDark:
			(nested.logoPictureDark as string | null | undefined) ?? null,
		layout: (nested.layout as "framed" | "frameless" | undefined) ?? "framed",
		pageBackgroundColor:
			(nested.pageBackgroundColor as string | null | undefined) ?? null,
		frameBackgroundColor:
			(nested.frameBackgroundColor as string | null | undefined) ?? null,
		frameBorderColor:
			(nested.frameBorderColor as string | null | undefined) ?? null,
		frameBorderWidth: (nested.frameBorderWidth as number | undefined) ?? 0,
		frameShadow:
			(nested.frameShadow as "none" | "sm" | "md" | "lg" | undefined) ?? "sm",
		backgroundImage:
			(nested.backgroundImage as string | null | undefined) ?? null,
		backgroundImageFit:
			(nested.backgroundImageFit as "cover" | "contain" | undefined) ?? "cover",
		backgroundImagePositionX:
			(nested.backgroundImagePositionX as number | undefined) ?? 50,
		backgroundImagePositionY:
			(nested.backgroundImagePositionY as number | undefined) ?? 50,
		backgroundOverlayOpacity:
			(nested.backgroundOverlayOpacity as number | undefined) ?? 0,
		backgroundOverlayBlur:
			(nested.backgroundOverlayBlur as number | undefined) ?? 0,
		backgroundImageCredit: classicPresentation.backgroundImageCredit,
		headerImage: classicPresentation.headerImage,
		headerImageHeight: (nested.headerImageHeight as number | undefined) ?? 160,
		headerImageCredit: classicPresentation.headerImageCredit,
		classicLayout: classicPresentation.classicLayout,
		showBrandLogo: classicPresentation.showBrandLogo,
		focusedImageLayoutDefault:
			(nested.focusedImageLayoutDefault as string | undefined) ?? "none",
	};
}

export default function TemplatePreviewDialog({
	name,
	onOpenChange,
	open,
	structure,
}: {
	name: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	structure: Record<string, unknown>;
}) {
	const form = buildPreviewForm(name, structure);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{name}</DialogTitle>
					<DialogDescription>
						A live preview — nothing you fill in here is saved.
					</DialogDescription>
				</DialogHeader>
				<div className="rounded-xl border border-border p-4">
					<FormRenderer form={form} mode="preview" />
				</div>
			</DialogContent>
		</Dialog>
	);
}
