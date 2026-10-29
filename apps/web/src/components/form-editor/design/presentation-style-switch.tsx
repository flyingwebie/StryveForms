import type { PresentationStyle } from "@StryveForms/forms/blocks";
import {
	restructureForStyle,
	styleSwitchImpact,
} from "@StryveForms/forms/presentation";
import type { BlockImage } from "@StryveForms/forms/types";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@StryveForms/ui/components/alert-dialog";
import {
	Field,
	FieldDescription,
	FieldLabel,
} from "@StryveForms/ui/components/field";
import {
	RadioGroup,
	RadioGroupItem,
} from "@StryveForms/ui/components/radio-group";
import { useState } from "react";

import { useEditor } from "../state/editor-context";
import { usePreviewForm } from "../utils/preview-form";
import { PresentationPreview } from "./illustrations";
import { OptionCard, OptionCardGrid } from "./option-card";

const PRESENTATION_OPTIONS: {
	description: string;
	label: string;
	value: PresentationStyle;
}[] = [
	{
		description: "All questions on one scrolling page.",
		label: "Classic",
		value: "classic",
	},
	{
		description:
			"One question at a time, Typeform-style. Use pages to group questions on one screen.",
		label: "Focused",
		value: "focused",
	},
];

type PageChoice = "one-per-screen" | "keep-pages";

const plural = (count: number, word: string) =>
	`${count} ${word}${count === 1 ? "" : "s"}`;

/** Which Classic layout image (if any) Focused mode will stop showing. */
function classicImageLabel(
	form: ReturnType<typeof usePreviewForm>
): string | null {
	if (form.classicLayout === "card-on-background" && form.backgroundImage) {
		return "background image";
	}
	const hasHeader =
		form.classicLayout === "header-image" ||
		form.classicLayout === "card-with-header";
	return hasHeader && form.headerImage ? "header image" : null;
}

/** The plain-language list of what switching style changes. */
function ChangeList({
	classicImage,
	impact,
	pageChoice,
	target,
}: {
	classicImage: string | null;
	impact: ReturnType<typeof styleSwitchImpact>;
	pageChoice: PageChoice;
	target: PresentationStyle;
}) {
	const items: string[] = [];
	if (target === "focused") {
		if (impact.removedBlocks.length > 0) {
			items.push(
				`${plural(impact.removedBlocks.length, "divider or image block")} will be removed. Focused mode has no place for them.`
			);
		}
		if (impact.pageBreakCount > 0 && pageChoice === "one-per-screen") {
			items.push(
				`${plural(impact.pageBreakCount, "page break")} will be removed. Page images move to the first question of their page.`
			);
		}
		if (classicImage) {
			items.push(
				`The Classic ${classicImage} is hidden. Focused forms use question images instead. It comes back if you switch to Classic.`
			);
		}
	} else {
		if (impact.pageBreakCount > 0) {
			items.push(
				`${plural(impact.pageBreakCount, "page break")} will be removed. Classic shows every question on one scrolling page.`
			);
		}
		if (impact.hiddenQuestionImageCount > 0) {
			items.push(
				`${plural(impact.hiddenQuestionImageCount, "question or page image")} will be hidden. Classic forms show questions without their images. They're kept and come back if you switch to Focused.`
			);
		}
	}
	if (items.length === 0) {
		return null;
	}
	return (
		<ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground text-sm">
			{items.map((item) => (
				<li key={item}>{item}</li>
			))}
		</ul>
	);
}

export function PresentationStyleSwitch() {
	const { patch, state } = useEditor();
	const previewForm = usePreviewForm();
	const [pendingStyle, setPendingStyle] = useState<PresentationStyle | null>(
		null
	);
	const [pageChoice, setPageChoice] = useState<PageChoice>("one-per-screen");
	const { settings } = state;
	const current = settings.presentationStyle;
	const pageImages = settings.settings.pageImages as
		| Record<string, BlockImage>
		| undefined;
	const target = pendingStyle ?? current;
	const impact = styleSwitchImpact(settings.properties, pageImages, target);
	const classicImage = classicImageLabel(previewForm);

	function applyStyle(style: PresentationStyle) {
		const next = restructureForStyle(settings.properties, pageImages, style, {
			onePerScreen: pageChoice === "one-per-screen",
		});
		patch({
			presentationStyle: style,
			properties: next.properties,
			settings: { ...settings.settings, pageImages: next.pageImages },
		});
		setPendingStyle(null);
	}

	function selectStyle(next: PresentationStyle) {
		if (next === current) {
			return;
		}
		const nextImpact = styleSwitchImpact(settings.properties, pageImages, next);
		const needsConfirm =
			next === "focused"
				? nextImpact.removedBlocks.length > 0 ||
					nextImpact.pageBreakCount > 0 ||
					classicImage !== null
				: nextImpact.hiddenQuestionImageCount > 0 ||
					nextImpact.pageBreakCount > 0;
		if (needsConfirm) {
			setPageChoice("one-per-screen");
			setPendingStyle(next);
		} else {
			applyStyle(next);
		}
	}

	const targetLabel = target === "focused" ? "Focused" : "Classic";

	return (
		<>
			<Field>
				<FieldLabel>Form style</FieldLabel>
				<OptionCardGrid>
					{PRESENTATION_OPTIONS.map((option) => (
						<OptionCard
							illustration={<PresentationPreview variant={option.value} />}
							key={option.value}
							label={option.label}
							onSelect={() => selectStyle(option.value)}
							selected={current === option.value}
						/>
					))}
				</OptionCardGrid>
				<FieldDescription>
					{PRESENTATION_OPTIONS.find((o) => o.value === current)?.description}
				</FieldDescription>
			</Field>
			<AlertDialog
				onOpenChange={(next) => {
					if (!next) {
						setPendingStyle(null);
					}
				}}
				open={pendingStyle !== null}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Switch to {targetLabel}?</AlertDialogTitle>
						<AlertDialogDescription>
							Here's what changes so the form looks right in {targetLabel} mode.
							You can undo it with the undo arrow at the top.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{target === "focused" && impact.pageBreakCount > 0 ? (
						<RadioGroup
							aria-label="Page breaks in focused mode"
							onValueChange={(value) => setPageChoice(value as PageChoice)}
							value={pageChoice}
						>
							<Field orientation="horizontal">
								<RadioGroupItem id="pages-one" value="one-per-screen" />
								<div className="flex flex-col">
									<FieldLabel htmlFor="pages-one">
										One question per screen
									</FieldLabel>
									<FieldDescription>
										Removes the page breaks. Best for the Typeform-style feel.
									</FieldDescription>
								</div>
							</Field>
							<Field orientation="horizontal">
								<RadioGroupItem id="pages-keep" value="keep-pages" />
								<div className="flex flex-col">
									<FieldLabel htmlFor="pages-keep">Keep my pages</FieldLabel>
									<FieldDescription>
										Each page's questions show together on one screen.
									</FieldDescription>
								</div>
							</Field>
						</RadioGroup>
					) : null}
					<ChangeList
						classicImage={classicImage}
						impact={impact}
						pageChoice={pageChoice}
						target={target}
					/>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => pendingStyle && applyStyle(pendingStyle)}
						>
							Switch to {targetLabel}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
