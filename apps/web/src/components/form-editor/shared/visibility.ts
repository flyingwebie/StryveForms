import type { VISIBILITIES } from "@StryveForms/forms/settings";

export type Visibility = (typeof VISIBILITIES)[number];

/**
 * Single source of truth for how a form's `visibility` is labelled and
 * explained, used by both the top bar's status control and the settings
 * dialog's General section so the wording never drifts between the two.
 */
export const VISIBILITY_META: Record<
	Visibility,
	{ description: string; dotClassName: string; label: string }
> = {
	closed: {
		description: "No longer accepting submissions, but the page still loads.",
		dotClassName: "bg-muted-foreground",
		label: "Closed",
	},
	draft: {
		description: "Hidden from respondents. Only you can preview it.",
		dotClassName: "bg-amber-500",
		label: "Draft",
	},
	public: {
		description: "Live — anyone with the link can open and submit it.",
		dotClassName: "bg-emerald-500",
		label: "Published",
	},
};
