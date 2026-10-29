import { isInputType } from "@StryveForms/forms/blocks";
import { stripHtml } from "@StryveForms/forms/mentions";
import type { FormField } from "@StryveForms/forms/types";

export type SubmissionSectionKind = "page" | "hidden" | "removed";

export interface SubmissionSection {
	fields: FormField[];
	kind: SubmissionSectionKind;
	title: string;
}

/**
 * Groups a form's answer fields into labeled sections for the submission
 * detail view, following the form's own structure:
 * - one section per page, titled "Page N" (or "Answers" for a single-page
 *   form), unless it starts with an `nf-text` heading, in which case the
 *   heading's text is used instead;
 * - an `nf-text` heading inside a page starts a new sub-section titled by
 *   its (HTML-stripped) text;
 * - hidden fields (prefilled statically or via the submission URL) are
 *   pulled out into their own "Hidden & URL fields" section, regardless of
 *   which page they live on;
 * - fields present in `removedProperties` but no longer in `properties`
 *   (deleted from the form since this submission was made) go under
 *   "Fields no longer in the form".
 *
 * A hidden `nf-page-break` doesn't actually split anything (it mirrors
 * `splitIntoPages` in `@StryveForms/forms/types`), so it's skipped entirely.
 */
export function buildSubmissionSections(
	properties: FormField[],
	removedProperties: FormField[] = []
): SubmissionSection[] {
	const totalPages =
		1 +
		properties.filter(
			(field) => field.type === "nf-page-break" && !field.hidden
		).length;

	const sections: SubmissionSection[] = [];
	const hiddenFields: FormField[] = [];
	const seenIds = new Set<string>();

	let pageIndex = 1;
	let sectionTitle: string | null = null;
	let current: FormField[] = [];

	const flush = () => {
		if (current.length > 0) {
			sections.push({
				fields: current,
				kind: "page",
				title:
					sectionTitle ?? (totalPages > 1 ? `Page ${pageIndex}` : "Answers"),
			});
			current = [];
		}
	};

	for (const field of properties) {
		if (field.type === "nf-page-break") {
			if (field.hidden) {
				continue; // doesn't actually split the page, same as splitIntoPages
			}
			flush();
			pageIndex += 1;
			sectionTitle = null;
			continue;
		}
		if (field.type === "nf-text") {
			if (field.hidden) {
				continue;
			}
			flush();
			sectionTitle = stripHtml(field.content ?? "").trim() || null;
			continue;
		}
		if (!isInputType(field.type)) {
			continue; // layout blocks (divider/image/video/audio/code) aren't answers
		}
		seenIds.add(field.id);
		if (field.hidden) {
			hiddenFields.push(field);
			continue;
		}
		current.push(field);
	}
	flush();

	if (hiddenFields.length > 0) {
		sections.push({
			fields: hiddenFields,
			kind: "hidden",
			title: "Hidden & URL fields",
		});
	}

	const removedAnswers = removedProperties.filter(
		(field) => isInputType(field.type) && !seenIds.has(field.id)
	);
	if (removedAnswers.length > 0) {
		sections.push({
			fields: removedAnswers,
			kind: "removed",
			title: "Fields no longer in the form",
		});
	}

	return sections;
}
