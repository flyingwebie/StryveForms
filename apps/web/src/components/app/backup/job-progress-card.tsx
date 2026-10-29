import { Button } from "@StryveForms/ui/components/button";
import { Progress } from "@StryveForms/ui/components/progress";
import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from "lucide-react";

import type { BackupJob } from "./contract";

const RUNNING_STATUSES = new Set(["pending", "running"]);
const LOG_COLORS: Record<"info" | "warn" | "error", string> = {
	error: "text-destructive",
	info: "text-muted-foreground",
	warn: "text-amber-600",
};

function percent(done: number, total: number) {
	return total > 0 ? Math.round((done / total) * 100) : 0;
}

const STATUS_TITLES: Record<string, string> = {
	cancelled: "Cancelled",
	completed: "Finished",
	failed: "Failed",
	pending: "Waiting to start",
	running: "Working on it",
};

function titleCase(key: string): string {
	return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Shared "a backup job is running" card: status, one progress bar per
 * counter the job reports (forms, submissions, files…), the live log, and a
 * cancel button while it's still going. Used for both exports and imports.
 */
export default function JobProgressCard({
	cancelling,
	job,
	onCancel,
}: {
	cancelling?: boolean;
	job: BackupJob;
	onCancel?: () => void;
}) {
	const isRunning = RUNNING_STATUSES.has(job.status);
	const counters = Object.entries(job.progress.entities ?? {});

	return (
		<div className="space-y-6 rounded-2xl border bg-card p-6">
			<div className="flex items-center gap-2">
				{isRunning ? (
					<Loader2Icon className="size-5 animate-spin text-primary" />
				) : null}
				{job.status === "completed" ? (
					<CheckCircle2Icon className="size-5 text-green-600" />
				) : null}
				{job.status === "failed" || job.status === "cancelled" ? (
					<XCircleIcon className="size-5 text-destructive" />
				) : null}
				<h2 className="font-medium text-lg">
					{STATUS_TITLES[job.status] ?? titleCase(job.status)}
				</h2>
			</div>

			{isRunning && (job.progress.phase || job.progress.currentEntity) ? (
				<p className="text-muted-foreground text-sm">
					{[job.progress.phase, job.progress.currentEntity]
						.filter(Boolean)
						.join(" — ")}
					…
				</p>
			) : null}

			<div className="space-y-4">
				{counters.map(([key, value]) => (
					<div className="space-y-1" key={key}>
						<div className="flex justify-between text-sm">
							<span>{titleCase(key)}</span>
							<span className="text-muted-foreground">
								{value.done}/{value.total}
							</span>
						</div>
						<Progress value={percent(value.done, value.total)} />
					</div>
				))}
			</div>

			{job.error ? (
				<p className="text-destructive text-sm">{job.error}</p>
			) : null}

			{job.log.length > 0 || isRunning ? (
				<div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs">
					{job.log.map((entry) => (
						<div
							className={
								LOG_COLORS[entry.level as "info" | "warn" | "error"] ??
								"text-muted-foreground"
							}
							key={`${entry.at}-${entry.message}`}
						>
							[{new Date(entry.at).toLocaleTimeString()}] {entry.message}
						</div>
					))}
					{job.log.length === 0 ? (
						<p className="text-muted-foreground">Starting…</p>
					) : null}
				</div>
			) : null}

			{isRunning && onCancel ? (
				<Button disabled={cancelling} onClick={onCancel} variant="outline">
					Cancel
				</Button>
			) : null}
		</div>
	);
}
