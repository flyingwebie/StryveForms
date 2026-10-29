import { createFileRoute, redirect } from "@tanstack/react-router";

import AuthCard from "@/components/app/auth/auth-card";
import AuthShell from "@/components/app/auth/auth-shell";
import { authClient } from "@/lib/auth-client";
import { useInstance } from "@/lib/instance";

export const Route = createFileRoute("/")({
	ssr: false,
	component: HomeComponent,
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (session.data) {
			throw redirect({ to: "/dashboard" });
		}
	},
});

function HomeComponent() {
	const instance = useInstance();

	return (
		<AuthShell>
			<AuthCard
				defaultTab="sign-in"
				registrationOpen={instance?.registrationOpen ?? true}
			/>
		</AuthShell>
	);
}
