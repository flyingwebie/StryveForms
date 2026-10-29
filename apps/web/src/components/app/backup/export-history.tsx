import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import { DownloadIcon } from "lucide-react";

import { apiBase } from "@/lib/api-url";

import { formatBytes, plural } from "../import/format";
import { useBackupJobs } from "./backup-rpc";

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

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Deleted in 6 days" / "Deleted today" / "Deleted" once it's past expiry. */
function expiryLabel(expiresAt: string | null | undefined): string | null {
	if (!expiresAt) {
		return null;
	}
	const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS);
	if (days <= 0) {
		return "Deleted";
	}
	if (days === 1) {
		return "Deleted tomorrow";
	}
	return `Deleted in ${days} days`;
}

/**
 * Past exports of this workspace: status, size, and a download link while
 * the file still exists (finished exports are deleted automatically after 7
 * days).
 */
export default function ExportHistory({
	workspaceId,
}: {
	workspaceId: string;
}) {
	const jobs = useBackupJobs(workspaceId);
	const exportJobs = (jobs.data ?? []).filter(
		(job) => job.kind === "workspace_export"
	);

	if (exportJobs.length === 0) {
		return null;
	}

	return (
		<div className="space-y-2">
			<h3 className="font-medium text-sm">Export history</h3>
			<div className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
				{exportJobs.map((job) => {
					const expiry = expiryLabel(job.expiresAt);
					return (
						<div
							className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
							key={job.id}
						>
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<Badge
										className="capitalize"
										variant={STATUS_VARIANT[job.status] ?? "outline"}
									>
										{job.status}
									</Badge>
									{job.sizeBytes ? (
										<span className="text-muted-foreground text-xs">
											{formatBytes(job.sizeBytes)}
										</span>
									) : null}
								</div>
								<p className="mt-0.5 text-muted-foreground text-xs">
									{new Date(job.createdAt).toLocaleString()}
									{expiry ? ` · ${expiry}` : ""}
								</p>
							</div>
							{job.status === "completed" ? (
								<Button
									render={
										<a
											href={`${apiBase()}/api/backups/jobs/${job.id}/download`}
										/>
									}
									size="sm"
									variant="outline"
								>
									<DownloadIcon /> Download
								</Button>
							) : null}
						</div>
					);
				})}
			</div>
			<p className="text-muted-foreground text-xs">
				{plural(exportJobs.length, "export")} · finished files are deleted
				automatically after 7 days.
			</p>
		</div>
	);
}
