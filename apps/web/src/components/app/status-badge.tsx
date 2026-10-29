import { Badge } from "@StryveForms/ui/components/badge";

const LABELS: Record<string, string> = {
	closed: "Closed",
	draft: "Draft",
	public: "Live",
};

const VARIANTS: Record<string, "success" | "neutral" | "warning"> = {
	closed: "warning",
	draft: "neutral",
	public: "success",
};

export default function StatusBadge({
	isClosed,
	visibility,
}: {
	isClosed?: boolean;
	visibility: string;
}) {
	const key = isClosed ? "closed" : visibility;
	return (
		<Badge variant={VARIANTS[key] ?? "neutral"}>
			<span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
			{LABELS[key] ?? visibility}
		</Badge>
	);
}
