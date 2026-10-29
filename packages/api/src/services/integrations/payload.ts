import type { formSubmission } from "@StryveForms/db/schema/forms";
import type { FormField } from "@StryveForms/forms/types";
import {
	answerFields,
	type DisplayValue,
	formatFieldValue,
} from "@StryveForms/forms/values";

import type { AppConfig } from "../../context";
import { shareUrl, submissionFileUrl } from "../../lib/files";
import type { FormRow } from "../../lib/serialize";

export type SubmissionRow = typeof formSubmission.$inferSelect;

/** File links in notifications stay valid for 7 days. */
const NOTIFICATION_FILE_TTL = 7 * 24 * 60 * 60;

export interface FormattedField {
	display: DisplayValue;
	hidden: boolean;
	id: string;
	name: string;
	raw: unknown;
	type: string;
}

export function formatSubmissionFields(
	form: FormRow,
	submission: SubmissionRow,
	config: AppConfig,
	options: { keepHtml?: boolean; includeHidden?: boolean } = {}
): FormattedField[] {
	const fields = answerFields(form.properties as FormField[]);
	return fields
		.filter((field) => options.includeHidden || !field.hidden)
		.map((field) => {
			const raw = submission.data[field.id];
			return {
				display: formatFieldValue(field, raw, {
					fileUrl: (_id, name) =>
						submissionFileUrl(config, form.id, name, NOTIFICATION_FILE_TTL),
					keepHtml: options.keepHtml,
				}),
				hidden: Boolean(field.hidden),
				id: field.id,
				name: field.name,
				raw,
				type: field.type,
			};
		});
}

/** Values for mention resolution: answers with files turned into links. */
export function mentionValues(
	fields: FormattedField[]
): Record<string, unknown> {
	return Object.fromEntries(
		fields.map((f) => {
			if (
				Array.isArray(f.display) &&
				f.display.some((d) => typeof d !== "string")
			) {
				return [f.id, (f.display as { url: string }[]).map((d) => d.url)];
			}
			return [f.id, f.raw];
		})
	);
}

export function editSubmissionUrl(
	form: FormRow,
	submission: SubmissionRow,
	config: AppConfig
) {
	return `${shareUrl(config, form.slug, form.customDomain)}?submission_id=${submission.publicId}`;
}

/** OpnForm-compatible webhook body, so existing automations keep working. */
export function webhookPayload(
	form: FormRow,
	submission: SubmissionRow,
	config: AppConfig,
	{
		flat = false,
		includeMetadata = true,
		legacy = true,
		test = false,
	}: {
		/** "flat": `data` is `{ id: value }` — simplest shape for no-code tools. */
		flat?: boolean;
		includeMetadata?: boolean;
		legacy?: boolean;
		/** Marks a "Send test" payload so the receiver can tell it apart. */
		test?: boolean;
	} = {}
) {
	const fields = formatSubmissionFields(form, submission, config, {
		includeHidden: true,
	});
	const fieldValue = (f: FormattedField) =>
		Array.isArray(f.display) && f.display.some((d) => typeof d !== "string")
			? (f.display as { url: string }[]).map((d) => d.url)
			: f.raw;
	const payload: Record<string, unknown> = {
		form_id: form.id,
		form_slug: form.slug,
		form_title: form.title,
		submission_id: submission.publicId,
		created_at: submission.createdAt.toISOString(),
		data: flat
			? Object.fromEntries(fields.map((f) => [f.id, fieldValue(f)]))
			: Object.fromEntries(
					fields.map((f) => [
						f.id,
						{ name: f.name, type: f.type, value: fieldValue(f) },
					])
				),
	};
	if (legacy) {
		payload.submission = Object.fromEntries(
			fields.map((f) => [f.name, fieldValue(f)])
		);
		payload.message =
			"Please do not use the `submission` field. It is deprecated; use `data` instead.";
	}
	if (form.editableSubmissions) {
		payload.edit_link = editSubmissionUrl(form, submission, config);
	}
	const { attribution } = submission.meta as { attribution?: unknown };
	if (
		includeMetadata &&
		attribution &&
		typeof attribution === "object" &&
		Object.keys(attribution).length > 0
	) {
		payload.meta = { attribution };
	}
	if (test) {
		payload.test = true;
	}
	return payload;
}
