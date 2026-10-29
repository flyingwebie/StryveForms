import type { VISIBILITIES } from "@StryveForms/forms/settings";

export type Visibility = (typeof VISIBILITIES)[number];

/**
 * Single source of truth for how a form's `visibility` is labelled and
 * explained, used by both the top bar's status control and the settings
 * dialog's General section so the wording never drifts between the two.
 */
export const VISIBILITY_META: Record<
	Visibility,
	{
		badgeVariant: "neutral" | "success" | "warning";
		description: string;
		dotClassName: string;
		label: string;
	}
> = {
	closed: {
		badgeVariant: "warning",
		description:
			"The form is visible but no longer accepting responses — submissions stay closed until you publish it again.",
		dotClassName: "bg-warning",
		label: "Closed",
	},
	draft: {
		badgeVariant: "neutral",
		description: "Only you and workspace members can see this form.",
		dotClassName: "bg-muted-foreground",
		label: "Draft",
	},
	public: {
		badgeVariant: "success",
		description: "Published — anyone with the link can view and respond.",
		dotClassName: "bg-success",
		label: "Live",
	},
};
