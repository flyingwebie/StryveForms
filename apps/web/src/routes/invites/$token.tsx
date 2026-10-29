import { Button } from "@StryveForms/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

import AuthShell from "@/components/app/auth/auth-shell";
import Loader from "@/components/loader";
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

function RouteComponent() {
	const { token } = Route.useParams();
	const navigate = useNavigate();
	const trpc = useTRPC();

	const accept = useMutation(
		trpc.workspace.acceptInvite.mutationOptions({
			onSuccess: () => {
				toast.success("You've joined the workspace");
				navigate({ to: "/dashboard" });
			},
			onError: (error) => toast.error(error.message),
		})
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: run once per token, not on every mutate identity change
	useEffect(() => {
		accept.mutate({ token });
	}, [token]);

	return (
		<AuthShell showHero={false}>
			{accept.isError ? (
				<div className="max-w-sm space-y-4 text-center">
					<p className="text-destructive text-sm">{accept.error.message}</p>
					<Button onClick={() => navigate({ to: "/dashboard" })}>
						Go to dashboard
					</Button>
				</div>
			) : (
				<div className="space-y-4 text-center">
					<Loader />
					<p className="text-muted-foreground text-sm">Joining workspace…</p>
				</div>
			)}
		</AuthShell>
	);
}
