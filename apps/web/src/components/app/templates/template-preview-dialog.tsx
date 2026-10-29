import type { PublicFormDto } from "@StryveForms/api/lib/serialize";
import { blockForField } from "@StryveForms/forms/blocks";
import {
	resolveClassicLayout,
	resolveTopImage,
} from "@StryveForms/forms/brand";
import {
	defaultFormSettings,
	type ImageCredit,
} from "@StryveForms/forms/settings";
import type { FormField } from "@StryveForms/forms/types";
import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@StryveForms/ui/components/dialog";
import { InfoIcon, SparklesIcon } from "lucide-react";

import { FormRenderer } from "@/components/form-renderer/form-renderer";

const LAYOUT_TYPES = new Set([
	"nf-page-break",
	"nf-divider",
	"nf-image",
	"nf-video",
	"nf-audio",
	"nf-code",
]);

/** Human label for a field's type, for the preview dialog's field list (e.g. "Rating", "Single choice"). */
function fieldTypeLabel(field: FormField): string {
	return blockForField(field)?.title ?? field.type;
}

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
		logoAlignment:
			(nested.logoAlignment as "left" | "center" | "right" | undefined) ?? null,
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
		captchaSiteKey: null,
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
		pageBackgroundColorDark:
			(nested.pageBackgroundColorDark as string | null | undefined) ?? null,
		frameBackgroundColorDark:
			(nested.frameBackgroundColorDark as string | null | undefined) ?? null,
		frameBorderColorDark:
			(nested.frameBorderColorDark as string | null | undefined) ?? null,
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
		logoAlignment: classicPresentation.logoAlignment,
		showBrandLogo: classicPresentation.showBrandLogo,
		focusedImageLayoutDefault:
			(nested.focusedImageLayoutDefault as string | undefined) ?? "none",
	};
}

export default function TemplatePreviewDialog({
	category,
	name,
	onOpenChange,
	onUse,
	open,
	structure,
}: {
	category?: string | null;
	name: string;
	onOpenChange: (open: boolean) => void;
	/** Omitted hides the sidebar's "Use template" action (e.g. no workspace yet to create into). */
	onUse?: () => void;
	open: boolean;
	structure: Record<string, unknown>;
}) {
	const form = buildPreviewForm(name, structure);
	const fields = (
		(structure.properties as FormField[] | undefined) ?? []
	).filter((field) => !(field.hidden || LAYOUT_TYPES.has(field.type)));

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>{name}</DialogTitle>
				</DialogHeader>
				<div className="grid gap-4 md:grid-cols-[1fr_240px]">
					<div className="space-y-3">
						<div className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2 text-info text-xs">
							<InfoIcon className="mt-0.5 size-3.5 shrink-0" />
							<DialogDescription className="text-info text-xs">
								Preview — nothing you fill in here is saved
							</DialogDescription>
						</div>
						<div className="rounded-xl border border-border p-4">
							<FormRenderer form={form} mode="preview" />
						</div>
					</div>
					<div className="flex flex-col gap-4 md:border-l md:pl-4">
						{category ? (
							<div className="space-y-1">
								<p className="text-subtle-foreground text-xs">Category</p>
								<p className="font-semibold text-sm">{category}</p>
							</div>
						) : null}
						<div className="space-y-2">
							<p className="text-subtle-foreground text-xs">Fields</p>
							<ul className="space-y-2">
								{fields.map((field) => (
									<li
										className="flex items-center justify-between gap-2 text-sm"
										key={field.id}
									>
										<span className="truncate">{field.name}</span>
										<Badge className="shrink-0" variant="outline">
											{fieldTypeLabel(field)}
										</Badge>
									</li>
								))}
							</ul>
						</div>
						{onUse ? (
							<Button className="mt-auto" onClick={onUse}>
								<SparklesIcon /> Use template
							</Button>
						) : null}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
