import type { PublicFormDto } from "@StryveForms/api/lib/serialize";
import { resolveMentions } from "@StryveForms/forms/mentions";
import { Button } from "@StryveForms/ui/components/button";
import { DownloadIcon } from "lucide-react";
import { useEffect } from "react";

import { apiBase } from "@/lib/api-url";

import type { FormDictionary } from "./i18n";

export interface SuccessScreenProps {
	data: Record<string, unknown>;
	dict: FormDictionary;
	form: PublicFormDto;
	onEditSubmission?: () => void;
	onRefill: () => void;
	redirectUrl?: string | null;
	submissionId?: string;
}

/** Shown after a final (non-partial) submission: thank-you message, confetti, redirect, refill. */
export function SuccessScreen({
	data,
	dict,
	form,
	onEditSubmission,
	onRefill,
	redirectUrl,
	submissionId,
}: SuccessScreenProps) {
	const html = resolveMentions(form.submittedText, data);

	useEffect(() => {
		if (form.confettiOnSubmission) {
			import("canvas-confetti").then(({ default: confetti }) => {
				confetti({ origin: { y: 0.6 }, particleCount: 140, spread: 70 });
			});
		}
	}, [form.confettiOnSubmission]);

	// "Open in a new tab" is a free-form settings flag (not a dedicated column),
	// set by the redirect builder in the form editor's Submissions section.
	const openInNewTab = Boolean(
		(form.settings as Record<string, unknown> | undefined)?.redirectOpenInNewTab
	);

	useEffect(() => {
		if (!redirectUrl) {
			return;
		}
		const timer = setTimeout(() => {
			if (openInNewTab) {
				window.open(redirectUrl, "_blank", "noopener,noreferrer");
			} else {
				window.location.href = redirectUrl;
			}
		}, 1200);
		return () => clearTimeout(timer);
	}, [redirectUrl, openInNewTab]);

	return (
		<div className="flex flex-col items-center gap-4 py-10 text-center">
			<div
				className="prose prose-sm dark:prose-invert max-w-prose"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: form owner's own HTML success message; mentions are HTML-escaped by resolveMentions
				dangerouslySetInnerHTML={{ __html: html || `<p>${dict.thankYou}</p>` }}
			/>
			<div className="flex flex-wrap items-center justify-center gap-2">
				{form.reFillable ? (
					<Button onClick={onRefill} type="button" variant="outline">
						{form.reFillButtonText || dict.fillAnotherResponse}
					</Button>
				) : null}
				{form.editableSubmissions && submissionId && onEditSubmission ? (
					<Button onClick={onEditSubmission} type="button" variant="ghost">
						{form.editableSubmissionsButtonText || dict.edit}
					</Button>
				) : null}
				{form.pdfDownloadEnabled && submissionId ? (
					<Button
						render={
							<a
								href={`${apiBase()}/api/pdf/respond/${form.id}/${submissionId}`}
							/>
						}
						type="button"
						variant="outline"
					>
						<DownloadIcon /> {form.pdfDownloadButtonText || "Download PDF"}
					</Button>
				) : null}
			</div>
		</div>
	);
}
