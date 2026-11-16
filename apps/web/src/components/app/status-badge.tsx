import {
	AVAILABILITY_LABELS,
	type FormAvailability,
	formAvailability,
} from "@StryveForms/forms/availability";
import { Badge } from "@StryveForms/ui/components/badge";

const VARIANTS: Record<FormAvailability, "success" | "neutral" | "warning"> = {
	closed: "warning",
	draft: "neutral",
	full: "warning",
	open: "success",
};

/**
 * Shows whether a form is taking responses. Pass `availability` when the
 * server has worked it out (it knows the closing date and submission limit);
 * `visibility` alone is only for forms we know nothing else about, such as
 * ones listed from another service before an import.
 */
export default function StatusBadge({
	availability,
	visibility,
}: {
	availability?: FormAvailability | undefined;
	visibility?: string | undefined;
}) {
	const key =
		availability ??
		formAvailability({ closesAt: null, visibility: visibility ?? "draft" });
	return (
		<Badge variant={VARIANTS[key]}>
			<span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
			{AVAILABILITY_LABELS[key]}
		</Badge>
	);
}
