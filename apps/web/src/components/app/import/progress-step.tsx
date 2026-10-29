import { Button } from "@StryveForms/ui/components/button";
import { Progress } from "@StryveForms/ui/components/progress";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { useWorkspaces } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

const RUNNING_STATUSES = new Set(["pending", "running"]);
const LOG_COLORS: Record<"info" | "warn" | "error", string> = {
	error: "text-destructive",
	info: "text-muted-foreground",
	warn: "text-amber-600",
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

function ImportedTargets({ targets }: { targets: ImportTarget[] }) {
	const navigate = useNavigate();
	const { setWorkspaceId } = useWorkspaces();

	return (
		<div className="space-y-2">
			<p className="font-medium text-sm">Imported into</p>
			<div className="flex flex-wrap gap-2">
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
		</div>
	);
}

export default function ProgressStep({
	jobId,
	onStartAnother,
	targets,
}: {
	jobId: string;
	onStartAnother: () => void;
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

	const isRunning = RUNNING_STATUSES.has(job.status);
	const progress = (job.progress ?? {}) as JobProgress;
	const forms = progress.forms ?? { done: 0, total: 0 };
	const submissions = progress.submissions ?? { done: 0, total: 0 };
	const files = progress.files ?? { done: 0, total: 0 };
	const integrationsDone = progress.integrations?.done ?? 0;

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
				<h2 className="font-medium text-lg capitalize">{job.status}</h2>
			</div>

			{progress.currentForm ? (
				<p className="text-muted-foreground text-sm">
					Importing "{progress.currentForm}"…
				</p>
			) : null}

			<div className="space-y-4">
				<ProgressRow done={forms.done} label="Forms" total={forms.total} />
				<ProgressRow
					done={submissions.done}
					label="Submissions"
					total={submissions.total}
				/>
				<ProgressRow done={files.done} label="Files" total={files.total} />
				<p className="text-muted-foreground text-sm">
					Integrations imported: {integrationsDone}
				</p>
			</div>

			{job.error ? (
				<p className="text-destructive text-sm">{job.error}</p>
			) : null}

			<div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs">
				{job.log.map((entry) => (
					<div
						className={LOG_COLORS[entry.level]}
						key={`${entry.at}-${entry.message}`}
					>
						[{new Date(entry.at).toLocaleTimeString()}] {entry.message}
					</div>
				))}
			</div>

			{!isRunning &&
			job.status === "completed" &&
			targets &&
			targets.length > 0 ? (
				<ImportedTargets targets={targets} />
			) : null}

			<div className="flex justify-between">
				{isRunning ? (
					<Button
						disabled={cancel.isPending}
						onClick={() => cancel.mutate({ jobId })}
						variant="outline"
					>
						Cancel import
					</Button>
				) : (
					<Button onClick={onStartAnother} variant="outline">
						Start another import
					</Button>
				)}
				<Button render={<Link to="/dashboard" />}>Go to forms</Button>
			</div>
		</div>
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
		<div className="space-y-1">
			<div className="flex justify-between text-sm">
				<span>{label}</span>
				<span className="text-muted-foreground">
					{done}/{total}
				</span>
			</div>
			<Progress value={percent(done, total)} />
		</div>
	);
}
