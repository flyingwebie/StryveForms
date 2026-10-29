import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/utils/trpc";

import { type ImportSourceId, SOURCES, SourceLogo } from "./source-picker";

const STATUS_VARIANT: Record<
	string,
	"success" | "info" | "neutral" | "danger"
> = {
	cancelled: "neutral",
	completed: "success",
	failed: "danger",
	pending: "neutral",
	running: "info",
};

const STATUS_LABEL: Record<string, string> = {
	cancelled: "Cancelled",
	completed: "Completed",
	failed: "Failed",
	pending: "Pending",
	running: "Running",
};

interface JobProgress {
	forms?: { done: number; total: number };
	submissions?: { done: number; total: number };
}

export default function RecentImportJobs({
	onResume,
}: {
	onResume: (jobId: string) => void;
}) {
	const trpc = useTRPC();
	const jobs = useQuery(trpc.importer.jobs.queryOptions());

	if (!jobs.data || jobs.data.length === 0) {
		return null;
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-base">Recent imports</h3>
			</div>
			<div className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
				{jobs.data.map((job) => {
					const progress = (job.progress ?? {}) as unknown as JobProgress;
					const { forms = { done: 0, total: 0 }, submissions } = progress;
					const sourceName =
						SOURCES.find((s) => s.id === job.source)?.name ?? job.source;
					const meta = [
						`${forms.total || forms.done} ${forms.total === 1 ? "form" : "forms"}`,
						submissions
							? `${submissions.done.toLocaleString()} submissions`
							: null,
						`Imported ${new Date(job.createdAt).toLocaleDateString(undefined, {
							day: "numeric",
							month: "short",
						})}`,
					]
						.filter(Boolean)
						.join(" · ");

					return (
						<div
							className="flex items-center justify-between gap-4 px-4 py-3"
							key={job.id}
						>
							<SourceLogo
								className="size-9 text-sm"
								source={job.source as ImportSourceId}
							/>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-sm">
									{sourceName}
									{job.sourceUrl ? ` – ${job.sourceUrl}` : ""}
								</p>
								<p className="mt-0.5 truncate text-muted-foreground text-xs">
									{meta}
								</p>
							</div>
							<Badge variant={STATUS_VARIANT[job.status] ?? "neutral"}>
								<span
									aria-hidden="true"
									className="size-1.5 rounded-full bg-current"
								/>
								{STATUS_LABEL[job.status] ?? job.status}
							</Badge>
							<Button
								onClick={() => onResume(job.id)}
								size="sm"
								variant="ghost"
							>
								View
							</Button>
						</div>
					);
				})}
			</div>
		</div>
	);
}
