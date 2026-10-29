import { Button } from "@StryveForms/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRightIcon, CheckIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import AuthShell from "@/components/app/auth/auth-shell";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/invites/$token")({
	ssr: false,
	component: RouteComponent,
	beforeLoad: async ({ location }) => {
		const session = await authClient.getSession();
		if (!session.data) {
			throw redirect({ to: "/login", search: { redirect: location.href } });
		}
	},
});

function WorkspaceCard({
	memberCount,
	name,
}: {
	memberCount: number | undefined;
	name: string;
}) {
	return (
		<div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3 text-left">
			<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 font-semibold text-primary-foreground">
				{name.slice(0, 1).toUpperCase()}
			</span>
			<span className="min-w-0">
				<span className="block truncate font-semibold text-sm">{name}</span>
				<span className="block text-muted-foreground text-xs">
					{memberCount === undefined
						? "Form building workspace"
						: `${memberCount} member${memberCount === 1 ? "" : "s"} · Form building workspace`}
				</span>
			</span>
		</div>
	);
}

function JoiningState({ workspaceName }: { workspaceName: string }) {
	return (
		<div className="space-y-5 text-center">
			<span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
				<RefreshCwIcon className="size-6 animate-spin" />
			</span>
			<h1 className="font-semibold text-xl tracking-tight">
				Joining {workspaceName}…
			</h1>
			<WorkspaceCard memberCount={undefined} name={workspaceName} />
			<div className="h-1 overflow-hidden rounded-full bg-muted">
				<div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
			</div>
		</div>
	);
}

function JoinedState({
	memberCount,
	role,
	workspaceName,
}: {
	memberCount: number | undefined;
	role: string;
	workspaceName: string;
}) {
	return (
		<div className="space-y-5 text-center">
			<span className="inline-flex size-12 items-center justify-center rounded-xl bg-success-soft text-success">
				<CheckIcon className="size-6" />
			</span>
			<div className="space-y-1">
				<h1 className="font-semibold text-xl tracking-tight">You're in!</h1>
				<p className="text-muted-foreground text-sm">
					You've joined {workspaceName} as a {role}.
				</p>
			</div>
			<WorkspaceCard memberCount={memberCount} name={workspaceName} />
			<Button className="w-full" render={<Link to="/dashboard" />}>
				<ArrowRightIcon /> Go to dashboard
			</Button>
		</div>
	);
}

function RouteComponent() {
	const { token } = Route.useParams();
	const trpc = useTRPC();
	const [workspaceId, setWorkspaceId] = useState<string | null>(null);

	const accept = useMutation(
		trpc.workspace.acceptInvite.mutationOptions({
			onSuccess: (data) => {
				setWorkspaceId(data.workspaceId);
				toast.success("You've joined the workspace");
			},
			onError: (error) => toast.error(error.message),
		})
	);

	const workspace = useQuery({
		...trpc.workspace.get.queryOptions({ id: workspaceId ?? "" }),
		enabled: Boolean(workspaceId),
	});

	const members = useQuery({
		...trpc.workspace.members.queryOptions({ workspaceId: workspaceId ?? "" }),
		enabled: Boolean(workspaceId),
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: run once per token, not on every mutate identity change
	useEffect(() => {
		accept.mutate({ token });
	}, [token]);

	return (
		<AuthShell showHero={false}>
			<div className="w-full rounded-2xl border bg-card p-6 text-card-foreground shadow-black/5 shadow-xl sm:p-8 dark:shadow-black/40">
				{accept.isError ? (
					<div className="max-w-sm space-y-4 text-center">
						<p className="text-destructive text-sm">{accept.error.message}</p>
						<Button render={<Link to="/dashboard" />}>Go to dashboard</Button>
					</div>
				) : null}
				{!accept.isError && workspaceId ? (
					<JoinedState
						memberCount={members.data?.members.length}
						role={workspace.data?.role ?? "member"}
						workspaceName={workspace.data?.name ?? "the workspace"}
					/>
				) : null}
				{accept.isError || workspaceId ? null : (
					<JoiningState workspaceName="your workspace" />
				)}
			</div>
		</AuthShell>
	);
}
