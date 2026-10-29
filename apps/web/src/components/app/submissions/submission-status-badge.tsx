import { Badge } from "@StryveForms/ui/components/badge";

/** "Completed" / "Partial" with a status dot, used in the table and the detail modal. */
export default function SubmissionStatusBadge({ status }: { status: string }) {
	const completed = status === "completed";
	return (
		<Badge variant={completed ? "success" : "info"}>
			<span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
			{completed ? "Completed" : "Partial"}
		</Badge>
	);
}
