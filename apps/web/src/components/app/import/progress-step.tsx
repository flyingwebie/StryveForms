import { Button } from "@StryveForms/ui/components/button";
import { Progress } from "@StryveForms/ui/components/progress";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	CheckIcon,
	FileTextIcon,
	InboxIcon,
	TimerIcon,
	XCircleIcon,
	XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { useWorkspaces } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

const RUNNING_STATUSES = new Set(["pending", "running"]);
const LOG_COLORS: Record<"info" | "warn" | "error", string> = {
	error: "text-destructive",
	info: "text-muted-foreground",
	warn: "text-warning",
};

export interface ImportTarget {
	label: string;
	workspaceId: string | null;
}

interface JobProgress {
	currentForm?: string;
	files?: { done: number; total: number };
	forms?: { done: number; total: number };
	integrations?: { done: number };
	submissions?: { done: number; total: number };
}

function percent(done: number, total: number) {
	return total > 0 ? Math.round((done / total) * 100) : 0;
}

function formatElapsed(ms: number) {
	const totalSeconds = Math.round(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function ImportedTargets({ targets }: { targets: ImportTarget[] }) {
	const navigate = useNavigate();
	const { setWorkspaceId } = useWorkspaces();

	return (
		<div className="flex flex-wrap items-center justify-center gap-2">
			{targets.map((target) => (
				<Button
					key={target.label}
					onClick={() => {
						if (target.workspaceId) {
							setWorkspaceId(target.workspaceId);
						}
						navigate({ to: "/dashboard" });
					}}
					size="sm"
					variant="outline"
				>
					{target.label}
				</Button>
			))}
		</div>
	);
}

function DoneStat({
	icon,
	label,
	value,
}: {
	icon: ReactNode;
	label: string;
	value: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center gap-1 rounded-2xl border bg-card px-8 py-5 text-center">
			<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
				{icon}
				{label}
			</div>
			<div className="font-semibold text-2xl tabular-nums">{value}</div>
		</div>
	);
}

interface JobDto {
	error: string | null;
	finishedAt: string | null;
	log: { at: string; level: "info" | "warn" | "error"; message: string }[];
	progress: unknown;
	startedAt: string | null;
	status: string;
}

function CompletedPanel({
	job,
	onStartAnother,
	sourceName,
	targets,
}: {
	job: JobDto;
	onStartAnother: () => void;
	sourceName?: string;
	targets?: ImportTarget[];
}) {
	const progress = (job.progress ?? {}) as JobProgress;
	const forms = progress.forms ?? { done: 0, total: 0 };
	const submissions = progress.submissions ?? { done: 0, total: 0 };
	const files = progress.files ?? { done: 0, total: 0 };
	const elapsed =
		job.startedAt && job.finishedAt
			? formatElapsed(
					new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()
				)
			: "—";

	return (
		<div className="flex flex-col items-center gap-6 py-6 text-center">
			<span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
				<CheckIcon className="size-6" />
			</span>
			<div className="space-y-2">
				<h2 className="font-display text-4xl">Import complete.</h2>
				<p className="text-muted-foreground text-sm">
					{plural(forms.total, "form")}, {submissions.total.toLocaleString()}{" "}
					submissions and {files.total.toLocaleString()} files were imported
					{sourceName ? ` from ${sourceName}` : ""}.
				</p>
			</div>
			<div className="flex flex-wrap items-center justify-center gap-3">
				<DoneStat
					icon={<FileTextIcon className="size-3.5" />}
					label="Forms"
					value={forms.total}
				/>
				<DoneStat
					icon={<InboxIcon className="size-3.5" />}
					label="Submissions"
					value={submissions.total.toLocaleString()}
				/>
				<DoneStat
					icon={<TimerIcon className="size-3.5" />}
					label="Time taken"
					value={elapsed}
				/>
			</div>
			{targets && targets.length > 0 ? (
				<ImportedTargets targets={targets} />
			) : null}
			<div className="flex items-center gap-3">
				<Button onClick={onStartAnother} variant="outline">
					Start another import
				</Button>
				<Button render={<Link to="/dashboard" />}>Go to forms</Button>
			</div>
		</div>
	);
}

function RunningPanel({
	cancelPending,
	job,
	onCancel,
	onStartAnother,
	sourceName,
}: {
	cancelPending: boolean;
	job: JobDto;
	onCancel: () => void;
	onStartAnother: () => void;
	sourceName?: string;
}) {
	const isRunning = RUNNING_STATUSES.has(job.status);
	const progress = (job.progress ?? {}) as JobProgress;
	const forms = progress.forms ?? { done: 0, total: 0 };
	const submissions = progress.submissions ?? { done: 0, total: 0 };
	const files = progress.files ?? { done: 0, total: 0 };

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-lg">
					{isRunning
						? `Importing${sourceName ? ` from ${sourceName}` : ""}…`
						: "Import stopped"}
				</h2>
				<p className="text-muted-foreground text-sm">
					{isRunning
						? "This usually takes a few minutes. You can safely close this tab — we'll email you when it's done."
						: (job.error ?? "This import didn't finish.")}
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-3">
				<ProgressRow done={forms.done} label="Forms" total={forms.total} />
				<ProgressRow
					done={submissions.done}
					label="Submissions"
					total={submissions.total}
				/>
				<ProgressRow done={files.done} label="Files" total={files.total} />
			</div>

			<div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs">
				{job.log.map((entry) => (
					<div
						className={LOG_COLORS[entry.level]}
						key={`${entry.at}-${entry.message}`}
					>
						[{new Date(entry.at).toLocaleTimeString()}] {entry.message}
					</div>
				))}
				{progress.currentForm ? (
					<div className="text-foreground">
						Importing "{progress.currentForm}"…
					</div>
				) : null}
			</div>

			{isRunning ? null : (
				<div className="flex items-center gap-2 text-destructive text-sm">
					<XCircleIcon className="size-4" />
					{job.status === "cancelled" ? "Import cancelled" : "Import failed"}
				</div>
			)}

			<div className="flex justify-end">
				{isRunning ? (
					<Button disabled={cancelPending} onClick={onCancel} variant="outline">
						<XIcon />
						Cancel import
					</Button>
				) : (
					<Button onClick={onStartAnother} variant="outline">
						Start another import
					</Button>
				)}
			</div>
		</div>
	);
}

export default function ProgressStep({
	jobId,
	onStartAnother,
	sourceName,
	targets,
}: {
	jobId: string;
	onStartAnother: () => void;
	sourceName?: string;
	targets?: ImportTarget[];
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const jobQuery = useQuery({
		...trpc.importer.job.queryOptions({ jobId }),
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			return status && RUNNING_STATUSES.has(status) ? 2000 : false;
		},
	});

	const cancel = useMutation(
		trpc.importer.cancel.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.importer.job.queryKey({ jobId }),
				});
				toast.success("Import cancelled");
			},
		})
	);

	const job = jobQuery.data;
	if (!job) {
		return <p className="text-muted-foreground text-sm">Loading import…</p>;
	}

	if (job.status === "completed") {
		return (
			<CompletedPanel
				job={job}
				onStartAnother={onStartAnother}
				sourceName={sourceName}
				targets={targets}
			/>
		);
	}

	return (
		<RunningPanel
			cancelPending={cancel.isPending}
			job={job}
			onCancel={() => cancel.mutate({ jobId })}
			onStartAnother={onStartAnother}
			sourceName={sourceName}
		/>
	);
}

function ProgressRow({
	done,
	label,
	total,
}: {
	done: number;
	label: string;
	total: number;
}) {
	return (
		<div className="space-y-1.5">
			<div className="flex justify-between text-sm">
				<span className="font-medium">{label}</span>
				<span className="text-muted-foreground tabular-nums">
					{done} / {total}
				</span>
			</div>
			<Progress value={percent(done, total)} />
		</div>
	);
}

function plural(count: number, word: string): string {
	return `${count.toLocaleString()} ${word}${count === 1 ? "" : "s"}`;
}
