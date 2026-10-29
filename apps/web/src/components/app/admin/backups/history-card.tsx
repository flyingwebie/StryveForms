import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyTitle,
} from "@StryveForms/ui/components/empty";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@StryveForms/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArchiveIcon,
	DownloadIcon,
	HistoryIcon,
	RefreshCwIcon,
} from "lucide-react";
import { toast } from "sonner";

import { apiBase } from "@/lib/api-url";
import { formatTrpcError } from "@/lib/format-trpc-error";
import { type RouterOutputs, useTRPC } from "@/utils/trpc";

type Job = RouterOutputs["backupAdmin"]["jobs"][number];

const POLL_MS = 3000;

const STATUS_VARIANT: Record<
	string,
	React.ComponentProps<typeof Badge>["variant"]
> = {
	cancelled: "neutral",
	completed: "success",
	failed: "danger",
	pending: "neutral",
	running: "info",
};

function daysUntil(date: string | null): string | null {
	if (!date) {
		return null;
	}
	const MS_PER_DAY = 86_400_000;
	const days = Math.ceil((new Date(date).getTime() - Date.now()) / MS_PER_DAY);
	if (days <= 0) {
		return "today";
	}
	return `in ${days} day${days === 1 ? "" : "s"}`;
}

function formatSize(bytes: number | null): string {
	if (!bytes) {
		return "—";
	}
	const mb = bytes / (1024 * 1024);
	return mb >= 1 ? `${mb.toFixed(0)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function JobRow({
	job,
	onRetry,
	retryDisabled,
}: {
	job: Job;
	onRetry: () => void;
	retryDisabled: boolean;
}) {
	const expiry = daysUntil(
		typeof job.expiresAt === "string" ? job.expiresAt : null
	);
	const failed = job.status === "failed";
	return (
		<TableRow className="h-13">
			<TableCell>
				<span className="font-medium">
					{job.startedAt ? new Date(job.startedAt).toLocaleString() : "—"}
				</span>
				{expiry ? (
					<span className="block text-subtle-foreground text-xs">
						Deleted {expiry}
					</span>
				) : null}
			</TableCell>
			<TableCell className="text-right font-mono text-muted-foreground text-xs">
				{formatSize(job.sizeBytes)}
			</TableCell>
			<TableCell className="text-muted-foreground text-xs capitalize">
				{job.kind === "instance_restore" ? "Restore" : "Backup"} · {job.trigger}
			</TableCell>
			<TableCell>
				<Badge variant={STATUS_VARIANT[job.status] ?? "neutral"}>
					{job.status}
				</Badge>
				{job.error ? (
					<span className="block max-w-56 truncate text-destructive text-xs">
						{job.error}
					</span>
				) : null}
			</TableCell>
			<TableCell className="text-right">
				{job.fileKey ? (
					<Button
						aria-label="Download backup"
						render={
							<a href={`${apiBase()}/api/backups/jobs/${job.id}/download`} />
						}
						size="icon-sm"
						variant="ghost"
					>
						<DownloadIcon />
					</Button>
				) : null}
				{failed ? (
					<Button
						aria-label="Retry backup"
						disabled={retryDisabled}
						onClick={onRetry}
						size="icon-sm"
						variant="ghost"
					>
						<RefreshCwIcon />
					</Button>
				) : null}
			</TableCell>
		</TableRow>
	);
}

/** Manual "Backup now" plus the history of every instance backup/restore job, with download links and expiry. */
export default function HistoryCard() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const destinations = useQuery(
		trpc.backupAdmin.destinations.list.queryOptions()
	);
	const schedule = useQuery(trpc.backupAdmin.schedule.get.queryOptions());

	const jobs = useQuery({
		...trpc.backupAdmin.jobs.queryOptions({}),
		refetchInterval: (query) => {
			const { data } = query.state;
			const anyRunning = Array.isArray(data)
				? data.some(
						(job) => job.status === "running" || job.status === "pending"
					)
				: false;
			return anyRunning ? POLL_MS : false;
		},
	});

	const destinationId =
		schedule.data?.schedule.destinationId ?? destinations.data?.[0]?.id ?? null;

	const backupNow = useMutation(
		trpc.backupAdmin.backupNow.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				toast.success("Backup started");
				await queryClient.invalidateQueries({
					queryKey: trpc.backupAdmin.jobs.queryKey(),
				});
			},
		})
	);

	return (
		<section className="space-y-4">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="font-semibold text-base">Backup history</h3>
					<p className="text-[13px] text-subtle-foreground">
						Manual and scheduled backups.
					</p>
				</div>
				<Button
					disabled={!destinationId || backupNow.isPending}
					onClick={() => destinationId && backupNow.mutate({ destinationId })}
					type="button"
				>
					<ArchiveIcon />
					{backupNow.isPending ? "Starting…" : "Backup now"}
				</Button>
			</div>

			{jobs.data && jobs.data.length === 0 ? (
				<Empty className="rounded-xl border border-dashed bg-subtle/50">
					<HistoryIcon className="size-8 text-subtle-foreground" />
					<EmptyTitle>No backups yet</EmptyTitle>
					<EmptyDescription>
						Run one above, or turn on a schedule.
					</EmptyDescription>
				</Empty>
			) : null}

			{jobs.data && jobs.data.length > 0 ? (
				<div className="overflow-hidden rounded-xl border border-border">
					<Table>
						<TableHeader>
							<TableRow className="bg-subtle hover:bg-subtle">
								<TableHead className="text-subtle-foreground text-xs uppercase tracking-wide">
									Date
								</TableHead>
								<TableHead className="text-right text-subtle-foreground text-xs uppercase tracking-wide">
									Size
								</TableHead>
								<TableHead className="text-subtle-foreground text-xs uppercase tracking-wide">
									Destination
								</TableHead>
								<TableHead className="text-subtle-foreground text-xs uppercase tracking-wide">
									Status
								</TableHead>
								<TableHead className="w-10" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{jobs.data.map((job) => (
								<JobRow
									job={job}
									key={job.id}
									onRetry={() =>
										destinationId && backupNow.mutate({ destinationId })
									}
									retryDisabled={!destinationId || backupNow.isPending}
								/>
							))}
						</TableBody>
					</Table>
				</div>
			) : null}
		</section>
	);
}
