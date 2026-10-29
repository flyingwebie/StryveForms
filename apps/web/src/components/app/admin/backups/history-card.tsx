import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import {
	Empty,
	EmptyDescription,
	EmptyTitle,
} from "@StryveForms/ui/components/empty";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, HistoryIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { apiBase } from "@/lib/api-url";
import { formatTrpcError } from "@/lib/format-trpc-error";
import { useTRPC } from "@/utils/trpc";

const POLL_MS = 3000;
const MS_PER_DAY = 86_400_000;
const STATUS_VARIANT: Record<string, "default" | "destructive" | "secondary"> =
	{
		cancelled: "secondary",
		completed: "default",
		failed: "destructive",
		pending: "secondary",
		running: "secondary",
	};

function daysUntil(date: string | null): string | null {
	if (!date) {
		return null;
	}
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
	return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

/** Manual "Backup now" plus the history of every instance backup/restore job, with download links and expiry. */
export default function HistoryCard() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const destinations = useQuery(
		trpc.backupAdmin.destinations.list.queryOptions()
	);
	const [destinationId, setDestinationId] = useState<string | null>(null);

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
		<Card className="rounded-xl">
			<CardHeader>
				<div>
					<CardTitle>Backup now</CardTitle>
					<CardDescription>
						Take a full-instance backup immediately, using the saved unattended
						passphrase.
					</CardDescription>
				</div>
			</CardHeader>
			<CardContent>
				<Select
					items={(destinations.data ?? []).map((d) => ({
						label: d.label,
						value: d.id,
					}))}
					onValueChange={setDestinationId}
					value={destinationId ?? undefined}
				>
					<SelectTrigger className="w-full sm:w-72">
						<SelectValue placeholder="Choose a destination" />
					</SelectTrigger>
					<SelectContent>
						{(destinations.data ?? []).map((d) => (
							<SelectItem key={d.id} value={d.id}>
								{d.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</CardContent>
			<CardFooter>
				<Button
					disabled={!destinationId || backupNow.isPending}
					onClick={() => destinationId && backupNow.mutate({ destinationId })}
					type="button"
				>
					{backupNow.isPending ? "Starting…" : "Backup now"}
				</Button>
			</CardFooter>

			<CardHeader className="border-t pt-6">
				<CardTitle>History</CardTitle>
				<CardDescription>
					Every scheduled, manual, safety and CLI backup and restore on this
					instance.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				{jobs.data && jobs.data.length === 0 ? (
					<Empty className="rounded-lg border border-dashed">
						<HistoryIcon className="size-8 text-muted-foreground" />
						<EmptyTitle>No backups yet</EmptyTitle>
						<EmptyDescription>
							Run one above, or turn on a schedule.
						</EmptyDescription>
					</Empty>
				) : null}
				{jobs.data?.map((job) => {
					const expiry = daysUntil(
						typeof job.expiresAt === "string" ? job.expiresAt : null
					);
					return (
						<div
							className="flex items-center justify-between gap-4 rounded-lg border border-border p-3 text-sm"
							key={job.id}
						>
							<div className="space-y-0.5">
								<div className="flex items-center gap-2 font-medium">
									{job.kind === "instance_restore" ? "Restore" : "Backup"}
									<Badge variant={STATUS_VARIANT[job.status] ?? "secondary"}>
										{job.status}
									</Badge>
									<span className="text-muted-foreground text-xs capitalize">
										{job.trigger}
									</span>
								</div>
								<p className="text-muted-foreground text-xs">
									{job.startedAt
										? new Date(job.startedAt).toLocaleString()
										: "—"}
									{job.sizeBytes ? ` · ${formatSize(job.sizeBytes)}` : ""}
									{expiry ? ` · Deleted ${expiry}` : ""}
								</p>
								{job.error ? (
									<p className="text-destructive text-xs">{job.error}</p>
								) : null}
							</div>
							{job.fileKey ? (
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
			</CardContent>
		</Card>
	);
}
