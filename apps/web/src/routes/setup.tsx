import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import AuthShell from "@/components/app/auth/auth-shell";
import SetupStepper from "@/components/app/setup/setup-stepper";
import SetupStepAccess from "@/components/app/setup/step-access";
import SetupStepAccount from "@/components/app/setup/step-account";
import SetupStepBranding from "@/components/app/setup/step-branding";
import SetupStepChoose from "@/components/app/setup/step-choose";
import SetupStepDone from "@/components/app/setup/step-done";
import SetupStepRestore from "@/components/app/setup/step-restore";
import { authClient } from "@/lib/auth-client";

type Step = "choose" | "restore" | 1 | 2 | 3 | 4;

const STEP_COPY: Partial<Record<Step, { description: string; title: string }>> =
	{
		1: {
			description: "This account manages your StryveForms instance.",
			title: "Create the admin account",
		},
		2: {
			description: "This is how StryveForms will look to your team.",
			title: "Brand your instance",
		},
		3: {
			description: "You can change this later in Admin settings.",
			title: "Control who can join",
		},
		restore: {
			description:
				"Upload the .stryve-backup file exported from your previous instance.",
			title: "Restore from a backup",
		},
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

	const numericStep = typeof step === "number" ? step : null;
	const copy = STEP_COPY[step];

	return (
		<AuthShell showHero={false} size="xl">
			<div className="flex w-full flex-col items-center gap-8">
				{numericStep ? <SetupStepper current={numericStep} /> : null}

				{step === "choose" ? (
					<div className="w-full max-w-2xl space-y-8 text-center">
						<div className="space-y-2">
							<h1 className="font-display text-4xl">
								Let's set up StryveForms
							</h1>
							<p className="text-muted-foreground">
								Choose how you'd like to get started with your new instance.
							</p>
						</div>
						<SetupStepChoose
							onRestore={() => setStep("restore")}
							onStartFresh={() => setStep(1)}
						/>
					</div>
				) : null}

				{step === "restore" ? (
					<Card className="w-full max-w-md">
						<CardHeader>
							<CardTitle>{copy?.title}</CardTitle>
							<CardDescription>{copy?.description}</CardDescription>
						</CardHeader>
						<CardContent>
							<SetupStepRestore onBack={() => setStep("choose")} />
						</CardContent>
					</Card>
				) : null}

				{step === 1 ? (
					<Card className="w-full max-w-md">
						<CardHeader>
							<CardTitle>{copy?.title}</CardTitle>
							<CardDescription>{copy?.description}</CardDescription>
						</CardHeader>
						<CardContent>
							<SetupStepAccount
								onBack={() => setStep("choose")}
								onDone={() => setStep(2)}
							/>
						</CardContent>
					</Card>
				) : null}

				{step === 2 ? (
					<Card className="w-full">
						<CardHeader>
							<CardTitle>{copy?.title}</CardTitle>
							<CardDescription>{copy?.description}</CardDescription>
						</CardHeader>
						<CardContent>
							<SetupStepBranding
								onBack={() => setStep(1)}
								onDone={() => setStep(3)}
							/>
						</CardContent>
					</Card>
				) : null}

				{step === 3 ? (
					<Card className="w-full max-w-md">
						<CardHeader>
							<CardTitle>{copy?.title}</CardTitle>
							<CardDescription>{copy?.description}</CardDescription>
						</CardHeader>
						<CardContent>
							<SetupStepAccess
								onBack={() => setStep(2)}
								onDone={() => setStep(4)}
							/>
						</CardContent>
					</Card>
				) : null}

				{step === 4 ? <SetupStepDone /> : null}
			</div>
		</AuthShell>
	);
}
