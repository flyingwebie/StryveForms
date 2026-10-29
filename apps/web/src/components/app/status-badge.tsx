import { Badge } from "@StryveForms/ui/components/badge";

const LABELS: Record<string, string> = {
	closed: "Closed",
	draft: "Draft",
	public: "Live",
};

const VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
	closed: "outline",
	draft: "secondary",
	public: "default",
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
		<Badge variant={VARIANTS[key] ?? "outline"}>
			{LABELS[key] ?? visibility}
		</Badge>
	);
}
