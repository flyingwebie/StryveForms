import { Button } from "@StryveForms/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { MonitorSmartphoneIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import InstanceLogo from "@/components/app/instance-logo";
import { authClient } from "@/lib/auth-client";

const SCOPE_LABELS: Record<string, string> = {
	offline_access: "stay connected without signing in again",
	"mcp:read": "view your workspaces, forms and submissions",
	"mcp:write": "create, edit and publish forms on your behalf",
};

const searchSchema = z.object({ user_code: z.string() });

export const Route = createFileRoute("/device_/approve")({
	component: RouteComponent,
	ssr: false,
	validateSearch: searchSchema,
	beforeLoad: async ({ search }) => {
		const session = await authClient.getSession();
		if (!session.data) {
			throw redirect({
				search: {
					redirect: `/device?user_code=${encodeURIComponent(search.user_code)}`,
				},
				to: "/login",
			});
		}
	},
});

function RouteComponent() {
	const { user_code: userCode } = Route.useSearch();
	const [result, setResult] = useState<"approved" | "denied" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const request = useQuery({
		queryFn: async () => {
			const { data } = await authClient.device({
				query: { user_code: userCode },
			});
			return data;
		},
		queryKey: ["device-request", userCode],
	});

	async function respond(action: "approve" | "deny") {
		setPending(true);
		setError(null);
		const { error: respondError } =
			action === "approve"
				? await authClient.device.approve({ userCode })
				: await authClient.device.deny({ userCode });
		setPending(false);
		if (respondError) {
			setError(
				respondError.error_description ?? "Something went wrong. Try again."
			);
			return;
		}
		setResult(action === "approve" ? "approved" : "denied");
	}

	const scopes = (request.data?.scope ?? "")
		.split(" ")
		.filter((s) => SCOPE_LABELS[s])
		.map((s) => SCOPE_LABELS[s]);

	if (result) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
				<Card className="w-full max-w-sm rounded-xl text-center">
					<CardHeader>
						<CardTitle>
							{result === "approved" ? "Device connected" : "Request denied"}
						</CardTitle>
						<CardDescription>
							{result === "approved"
								? "You can go back to your terminal or device now."
								: "The device was not given access."}
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
			<Card className="w-full max-w-sm rounded-xl">
				<CardHeader className="items-center text-center">
					<InstanceLogo showName={false} />
					<div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
						<MonitorSmartphoneIcon className="size-6" />
					</div>
					<CardTitle className="text-xl">
						Connect {request.data?.client_id ?? "this device"}?
					</CardTitle>
					<CardDescription>
						Only approve this if you just started this sign-in yourself. Code:{" "}
						<span className="font-mono">{userCode}</span>
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2">
					{scopes.length > 0 ? (
						scopes.map((label) => (
							<div
								className="rounded-lg border border-border p-3 text-sm"
								key={label}
							>
								It will be able to {label}.
							</div>
						))
					) : (
						<p className="text-muted-foreground text-sm">
							It will sign in as you.
						</p>
					)}
					{error ? <p className="text-destructive text-sm">{error}</p> : null}
				</CardContent>
				<CardFooter className="flex gap-2">
					<Button
						className="flex-1"
						disabled={pending}
						onClick={() => respond("deny")}
						variant="outline"
					>
						Deny
					</Button>
					<Button
						className="flex-1"
						disabled={pending}
						onClick={() => respond("approve")}
					>
						Approve
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
