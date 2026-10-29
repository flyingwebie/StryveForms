import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import AuthCard from "@/components/app/auth/auth-card";
import AuthShell from "@/components/app/auth/auth-shell";
import { authClient } from "@/lib/auth-client";
import { useInstance } from "@/lib/instance";

const searchSchema = z.object({
	redirect: z.string().optional(),
});

export const Route = createFileRoute("/register")({
	ssr: false,
	component: RouteComponent,
	validateSearch: searchSchema,
	beforeLoad: async ({ context, search }) => {
		const session = await authClient.getSession();
		if (session.data) {
			throw redirect({ to: search.redirect ?? "/dashboard" });
		}
		const instance = await context.queryClient.ensureQueryData(
			context.trpc.instance.public.queryOptions()
		);
		if (!instance.registrationOpen) {
			throw redirect({ to: "/" });
		}
	},
});

function RouteComponent() {
	const { redirect: redirectTo } = Route.useSearch();
	const instance = useInstance();

	return (
		<AuthShell>
			<AuthCard
				defaultTab="sign-up"
				redirectTo={redirectTo}
				registrationOpen={instance?.registrationOpen ?? true}
			/>
		</AuthShell>
	);
}
