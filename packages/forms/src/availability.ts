/**
 * The one place that decides whether a form is taking responses.
 *
 * A form's stored `visibility` is only part of the story: a "public" form can
 * still be closed because its closing date has passed, or full because it hit
 * its submission limit. Every surface (public page, submit, uploads, dashboard
 * badges, agent tools) reads the answer from here so they can't disagree.
 *
 *   draft ──publish──▶ open ──closing date passes / owner closes──▶ closed
 *                       │
 *                       └──submission limit reached──▶ full
 *
 * `closed` wins over `full`, and `draft` wins over both.
 */

export const FORM_AVAILABILITIES = ["draft", "open", "closed", "full"] as const;

export type FormAvailability = (typeof FORM_AVAILABILITIES)[number];

export interface AvailabilityInput {
	/** Closing date as a `Date` or ISO string; null when the form never closes. */
	closesAt: Date | string | null;
	/** Completed submissions so far. Leave out when the limit isn't being checked. */
	completedCount?: number | undefined;
	maxSubmissionsCount?: number | null | undefined;
	visibility: string;
}

/** True when the form's closing date has passed or its owner closed it. */
export function isPastClosing(
	input: Pick<AvailabilityInput, "closesAt" | "visibility">,
	now: Date = new Date()
): boolean {
	if (input.visibility === "closed") {
		return true;
	}
	if (input.closesAt === null) {
		return false;
	}
	return new Date(input.closesAt).getTime() < now.getTime();
}

/** True when a submission limit is set and completed submissions have reached it. */
export function isAtSubmissionLimit(
	maxSubmissionsCount: number | null | undefined,
	completedCount: number
): boolean {
	const limit = maxSubmissionsCount ?? null;
	return limit !== null && completedCount >= limit;
}

export function formAvailability(
	input: AvailabilityInput,
	now: Date = new Date()
): FormAvailability {
	if (input.visibility === "draft") {
		return "draft";
	}
	if (isPastClosing(input, now)) {
		return "closed";
	}
	if (
		isAtSubmissionLimit(input.maxSubmissionsCount, input.completedCount ?? 0)
	) {
		return "full";
	}
	return "open";
}

/**
 * Whether this viewer may load the form page at all. Drafts are hidden from
 * everyone except workspace members; closed and full forms still load so the
 * page can show their "closed" / "limit reached" message.
 */
export function canViewForm(
	availability: FormAvailability,
	isMember: boolean
): boolean {
	return availability !== "draft" || isMember;
}

/**
 * Whether this viewer sees the form's questions (rather than the closed or
 * limit-reached screen), and so may also upload files for them. Workspace
 * members always do, so they can preview and test.
 *
 * Seeing the questions is not a promise the submission will be accepted: the
 * submission limit is a hard cap, so on a full form a member's new submission
 * is still refused (see `isAtSubmissionLimit` in services/submissions.ts).
 */
export function showsFormFields(
	availability: FormAvailability,
	isMember: boolean
): boolean {
	return availability === "open" || isMember;
}

/** Plain-language summary for dashboards, the CLI and agent tools. */
export const AVAILABILITY_LABELS: Record<FormAvailability, string> = {
	closed: "Closed",
	draft: "Draft",
	full: "Full",
	open: "Live",
};
