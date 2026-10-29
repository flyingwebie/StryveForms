import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/utils/trpc";

import { type ImportSourceId, SOURCES, SourceLogo } from "./source-picker";

const STATUS_VARIANT: Record<
	string,
	"default" | "secondary" | "outline" | "destructive"
> = {
	cancelled: "outline",
	completed: "secondary",
	failed: "destructive",
	pending: "outline",
	running: "default",
};

interface JobProgress {
	forms?: { done: number; total: number };
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
		<div className="space-y-2">
			<h3 className="font-medium text-sm">Recent imports</h3>
			<div className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
				{jobs.data.map((job) => {
					const progress = (job.progress ?? {}) as unknown as JobProgress;
					const forms = progress.forms ?? { done: 0, total: 0 };
					return (
						<div
							className="flex items-center justify-between gap-3 p-3 text-sm"
							key={job.id}
						>
							<SourceLogo
								className="size-8 text-xs"
								source={job.source as ImportSourceId}
							/>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="font-medium">
										{SOURCES.find((s) => s.id === job.source)?.name ??
											job.source}
									</span>
									<Badge
										className="capitalize"
										variant={STATUS_VARIANT[job.status] ?? "outline"}
									>
										{job.status}
									</Badge>
									<span className="truncate text-muted-foreground text-xs">
										{job.sourceUrl}
									</span>
								</div>
								<p className="mt-0.5 text-muted-foreground text-xs">
									{forms.done}/{forms.total} forms &middot;{" "}
									{new Date(job.createdAt).toLocaleString()}
								</p>
							</div>
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
