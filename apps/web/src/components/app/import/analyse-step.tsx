import type { ImportPreview } from "@StryveForms/api/services/import/preview";
import { Button } from "@StryveForms/ui/components/button";
import { Progress } from "@StryveForms/ui/components/progress";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2Icon, XCircleIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { useTRPC } from "@/utils/trpc";

const POLL_MS = 1000;
const LOG_COLORS: Record<"info" | "warn" | "error", string> = {
	error: "text-destructive",
	info: "text-muted-foreground",
	warn: "text-warning",
};

/** Shows live progress while the server analyses the selected forms. */
export default function AnalyseStep({
	onBack,
	onDone,
	sourceName,
	taskId,
}: {
	onBack: () => void;
	onDone: (preview: ImportPreview) => void;
	sourceName: string;
	taskId: string;
}) {
	const trpc = useTRPC();
	const logRef = useRef<HTMLDivElement>(null);
	const status = useQuery({
		...trpc.importer.previewStatus.queryOptions({ taskId }),
		refetchInterval: (query) =>
			query.state.data?.status === "running" ? POLL_MS : false,
		retry: false,
	});
	const cancel = useMutation(trpc.importer.cancelPreview.mutationOptions());

	const task = status.data;
	const result = task?.status === "done" ? task.result : null;
	const logLength = task?.log.length ?? 0;

	useEffect(() => {
		if (result) {
			onDone(result);
		}
	}, [result, onDone]);

	useEffect(() => {
		if (logLength > 0 && logRef.current) {
			logRef.current.scrollTop = logRef.current.scrollHeight;
		}
	}, [logLength]);

	const failed = status.isError || task?.status === "failed";
	const errorMessage = status.error?.message ?? task?.error;
	const done = task?.done ?? 0;
	const total = task?.total ?? 0;
	const percent = total > 0 ? Math.round((done / total) * 100) : 0;

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-lg">
					{failed ? "Analysis failed" : `Analysing your ${sourceName} forms…`}
				</h2>
				<p className="text-muted-foreground text-sm">
					{failed
						? (errorMessage ?? "Something went wrong. Try again.")
						: "We're reading each form's fields, files and notifications so you can review the import before anything is copied. Large accounts can take a few minutes."}
				</p>
			</div>

			<div className="space-y-1.5">
				<div className="flex justify-between text-sm">
					<span className="flex items-center gap-2 font-medium">
						{failed ? (
							<XCircleIcon className="size-4 text-destructive" />
						) : (
							<Loader2Icon className="size-4 animate-spin" />
						)}
						Forms analysed
					</span>
					<span className="text-muted-foreground tabular-nums">
						{done} / {total}
					</span>
				</div>
				<Progress value={percent} />
			</div>

			<div
				aria-live="polite"
				className="max-h-56 min-h-24 space-y-1 overflow-y-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs"
				ref={logRef}
			>
				{task?.log.length ? (
					task.log.map((entry, index) => (
						<div
							className={LOG_COLORS[entry.level]}
							// biome-ignore lint/suspicious/noArrayIndexKey: log lines are append-only and can repeat
							key={`${index}-${entry.at}`}
						>
							[{new Date(entry.at).toLocaleTimeString()}] {entry.message}
						</div>
					))
				) : (
					<div className="text-muted-foreground">Starting…</div>
				)}
			</div>

			<div className="flex justify-end">
				{failed ? (
					<Button onClick={onBack} variant="outline">
						Back
					</Button>
				) : (
					<Button
						disabled={cancel.isPending}
						onClick={() => {
							cancel.mutate({ taskId });
							onBack();
						}}
						variant="outline"
					>
						<XIcon />
						Cancel
					</Button>
				)}
			</div>
		</div>
	);
}
