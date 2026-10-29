/**
 * Shared "render one submission's PDF for a template" helper, used by the
 * owner download/preview routes, the "attach PDF" email integration, and
 * the bulk ZIP export — so they all compute fields/filename the same way.
 */

import type { pdfTemplate } from "@StryveForms/db/schema/features";
import type { formSubmission } from "@StryveForms/db/schema/forms";
import type { FormField } from "@StryveForms/forms/types";
import { answerFields } from "@StryveForms/forms/values";

import type { Services } from "../../context";
import type { FormRow } from "../../lib/serialize";
import type { PdfPage, PdfZone } from "./model";
import { renderFilenamePattern } from "./model";
import { renderPdf } from "./render";

export type PdfTemplateRow = typeof pdfTemplate.$inferSelect;
export type SubmissionRow = typeof formSubmission.$inferSelect;

export async function renderTemplatePdfForSubmission(
	services: Services,
	template: PdfTemplateRow,
	form: FormRow,
	submission: SubmissionRow
): Promise<{ bytes: Uint8Array; filename: string }> {
	const fields = answerFields(
		form.properties as FormField[],
		form.removedProperties as FormField[]
	);
	const bytes = await renderPdf({
		fields,
		form: { id: form.id, title: form.title },
		pages: template.pages as PdfPage[],
		services,
		sourceFileKey: template.sourceFileKey,
		submissionMeta: {
			createdAt: submission.createdAt,
			publicId: submission.publicId,
		},
		values: submission.data as Record<string, unknown>,
		zones: template.zones as PdfZone[],
	});
	const filename = renderFilenamePattern(template.filenamePattern, {
		date: submission.createdAt.toISOString().slice(0, 10),
		formTitle: form.title,
		submissionId: submission.publicId,
		templateName: template.name,
	});
	return { bytes, filename };
}
