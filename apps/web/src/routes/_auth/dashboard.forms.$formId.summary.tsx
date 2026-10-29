import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { BarChart3Icon } from "lucide-react";

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
	const formQuery = useQuery(trpc.form.get.queryOptions({ id: formId }));

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
			<div className="flex flex-col items-center gap-3 rounded-xl border border-border py-16 text-center">
				<span className="flex size-12 items-center justify-center rounded-full bg-primary-soft">
					<BarChart3Icon className="size-5 text-primary-soft-foreground" />
				</span>
				<div className="space-y-1">
					<p className="font-medium text-sm">No fields to summarize yet</p>
					<p className="text-muted-foreground text-sm">
						Once your form collects answers, each question's summary shows up
						here.
					</p>
				</div>
			</div>
		);
	}

	const updatedAt = formQuery.data ? new Date(formQuery.data.updatedAt) : null;

	return (
		<div className="space-y-3">
			<p className="text-[13px] text-subtle-foreground">
				Based on the most recent{" "}
				{(summary.data?.totalSubmissions ?? 0).toLocaleString()} submissions.
				{updatedAt && !Number.isNaN(updatedAt.getTime()) ? (
					<> Updated {formatDistanceToNow(updatedAt, { addSuffix: true })}.</>
				) : null}
			</p>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{fields.map((field) => (
					<FieldSummaryCard key={field.id} summary={field} />
				))}
			</div>
		</div>
	);
}
