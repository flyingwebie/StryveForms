import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import AuthShell from "@/components/app/auth/auth-shell";
import SetupStepAccess from "@/components/app/setup/step-access";
import SetupStepAccount from "@/components/app/setup/step-account";
import SetupStepBranding from "@/components/app/setup/step-branding";
import SetupStepChoose from "@/components/app/setup/step-choose";
import SetupStepDone from "@/components/app/setup/step-done";
import SetupStepRestore from "@/components/app/setup/step-restore";
import { authClient } from "@/lib/auth-client";

type Step = "choose" | "restore" | 1 | 2 | 3 | 4;

const STEP_TITLES: Record<Step, string> = {
	choose: "Welcome to StryveForms",
	restore: "Restore from a backup",
	1: "Create your admin account",
	2: "Brand your installation",
	3: "Choose who can sign up",
	4: "All done",
};

export const Route = createFileRoute("/setup")({
	ssr: false,
	component: RouteComponent,
	beforeLoad: async ({ context }) => {
		const instance = await context.queryClient.ensureQueryData(
			context.trpc.instance.public.queryOptions()
		);
		if (instance.setupRequired) {
			return { startStep: "choose" as Step };
		}
		const session = await authClient.getSession();
		const isAdmin = Boolean(
			(session.data?.user as { isAdmin?: boolean } | undefined)?.isAdmin
		);
		if (!(session.data && isAdmin) || instance.setupCompleted) {
			throw redirect({ to: session.data ? "/dashboard" : "/" });
		}
		return { startStep: 2 as Step };
	},
});

function RouteComponent() {
	const { startStep } = Route.useRouteContext();
	const [step, setStep] = useState<Step>(startStep);

	const showProgress = typeof step === "number";

	return (
		<AuthShell showHero={false}>
			<Card className="w-full max-w-lg">
				<CardHeader>
					{showProgress ? (
						<p className="text-muted-foreground text-xs">Step {step} of 4</p>
					) : null}
					<CardTitle>{STEP_TITLES[step]}</CardTitle>
				</CardHeader>
				<CardContent>
					{step === "choose" ? (
						<SetupStepChoose
							onRestore={() => setStep("restore")}
							onStartFresh={() => setStep(1)}
						/>
					) : null}
					{step === "restore" ? (
						<SetupStepRestore onBack={() => setStep("choose")} />
					) : null}
					{step === 1 ? <SetupStepAccount onDone={() => setStep(2)} /> : null}
					{step === 2 ? (
						<SetupStepBranding
							onBack={() => setStep(1)}
							onDone={() => setStep(3)}
						/>
					) : null}
					{step === 3 ? (
						<SetupStepAccess
							onBack={() => setStep(2)}
							onDone={() => setStep(4)}
						/>
					) : null}
					{step === 4 ? <SetupStepDone /> : null}
				</CardContent>
			</Card>
		</AuthShell>
	);
}
