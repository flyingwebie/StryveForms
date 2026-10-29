import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import FieldSummaryCard from "@/components/app/submissions/field-summary-card";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/dashboard/forms/$formId/summary")({
	component: RouteComponent,
});

const SKELETON_IDS = ["sm-1", "sm-2", "sm-3", "sm-4"];

function RouteComponent() {
	const { formId } = Route.useParams();
	const trpc = useTRPC();
	const summary = useQuery(trpc.stats.summary.queryOptions({ formId }));

	// biome-ignore lint/suspicious/noUnnecessaryConditions: isPending is a runtime query-status flag
	if (summary.isPending) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{SKELETON_IDS.map((id) => (
					<Skeleton className="h-48 w-full" key={id} />
				))}
			</div>
		);
	}

	const fields = summary.data?.fields ?? [];

	if (fields.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				No fields to summarize yet.
			</p>
		);
	}

	return (
		<div className="space-y-3">
			{summary.data?.isLimited ? (
				<p className="text-muted-foreground text-xs">
					Summary is based on the most recent {summary.data.totalSubmissions}{" "}
					submissions.
				</p>
			) : null}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{fields.map((field) => (
					<FieldSummaryCard key={field.id} summary={field} />
				))}
			</div>
		</div>
	);
}
