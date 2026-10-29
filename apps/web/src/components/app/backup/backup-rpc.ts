/**
 * Thin wrappers around `trpc.backup.*` (workspace export/import). Isolated
 * here so the step/flow components stay decoupled from the exact tRPC
 * call shape.
 */
import { useMutation, useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/utils/trpc";

import type { BackupJob } from "./contract";

const RUNNING = new Set(["pending", "running"]);

export function useBackupJob(jobId: string | null) {
	const trpc = useTRPC();
	const query = useQuery({
		...trpc.backup.job.queryOptions({ id: jobId as string }),
		enabled: Boolean(jobId),
		refetchInterval: (q: { state: { data?: BackupJob } }) => {
			const status = q.state.data?.status;
			return status && RUNNING.has(status) ? 1500 : false;
		},
	});
	return query as unknown as {
		data: BackupJob | undefined;
		isLoading: boolean;
	};
}

export function useBackupJobs(workspaceId: string | null) {
	const trpc = useTRPC();
	const query = useQuery({
		...trpc.backup.jobs.queryOptions({ workspaceId: workspaceId ?? undefined }),
		enabled: Boolean(workspaceId),
	});
	return query as unknown as {
		data: BackupJob[] | undefined;
		isLoading: boolean;
	};
}

export function useCancelBackupJob() {
	const trpc = useTRPC();
	return useMutation(trpc.backup.cancel.mutationOptions());
}

export function useExportWorkspace() {
	const trpc = useTRPC();
	return useMutation(trpc.backup.exportWorkspace.mutationOptions());
}

export function useInspectImport() {
	const trpc = useTRPC();
	return useMutation(trpc.backup.inspectImport.mutationOptions());
}

export function useStartImport() {
	const trpc = useTRPC();
	return useMutation(trpc.backup.startImport.mutationOptions());
}
