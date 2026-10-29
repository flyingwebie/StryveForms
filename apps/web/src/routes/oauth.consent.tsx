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
import { ShieldCheckIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import InstanceLogo from "@/components/app/instance-logo";
import { authClient } from "@/lib/auth-client";

/** Plain-language names for the OAuth scopes this instance issues. "openid"/"profile" are implementation details, not shown. */
const SCOPE_LABELS: Record<string, string> = {
	offline_access:
		"Stay connected (refresh access without you signing in again)",
	"mcp:read": "View your workspaces, forms and submissions",
	"mcp:write": "Create, edit and publish forms on your behalf",
};

const searchSchema = z.object({
	claims: z.string().optional(),
	client_id: z.string().optional(),
	scope: z.string().optional(),
});

export const Route = createFileRoute("/oauth/consent")({
	component: RouteComponent,
	ssr: false,
	validateSearch: searchSchema,
	beforeLoad: async ({ search }) => {
		const session = await authClient.getSession();
		if (!session.data) {
			const here = `/oauth/consent?${new URLSearchParams(
				search as Record<string, string>
			).toString()}`;
			throw redirect({
				search: { redirect: here },
				to: "/login",
			});
		}
	},
});

function RouteComponent() {
	const { client_id: clientId, scope } = Route.useSearch();
	const [decision, setDecision] = useState<"allow" | "deny" | null>(null);
	const [error, setError] = useState<string | null>(null);

	const client = useQuery({
		enabled: Boolean(clientId),
		queryFn: async () => {
			if (!clientId) {
				return null;
			}
			const { data } = await authClient.oauth2.publicClient({
				query: { client_id: clientId },
			});
			return data;
		},
		queryKey: ["oauth-public-client", clientId],
	});

	const scopes = (scope ?? "")
		.split(" ")
		.filter((s) => SCOPE_LABELS[s])
		.map((s) => SCOPE_LABELS[s]);

	async function respond(accept: boolean) {
		setDecision(accept ? "allow" : "deny");
		setError(null);
		const { error: consentError } = await authClient.oauth2.consent({
			accept,
		});
		if (consentError) {
			setError(consentError.message ?? "Something went wrong. Try again.");
			setDecision(null);
		}
		// On success, better-auth's client plugin redirects the browser back
		// to the client's redirect_uri itself — nothing further to do here.
	}

	const clientName =
		client.data?.client_name || client.data?.client_id || "This app";

	return (
		<div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
			<Card className="w-full max-w-md rounded-xl">
				<CardHeader className="items-center text-center">
					<InstanceLogo showName={false} />
					<div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
						<ShieldCheckIcon className="size-6" />
					</div>
					<CardTitle className="text-xl">
						{client.isLoading
							? "Loading…"
							: `${clientName} wants to access your StryveForms account`}
					</CardTitle>
					<CardDescription>
						Review what this app can do before approving it.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2">
					{scopes.length > 0 ? (
						scopes.map((label) => (
							<div
								className="rounded-lg border border-border p-3 text-sm"
								key={label}
							>
								{label}
							</div>
						))
					) : (
						<p className="text-muted-foreground text-sm">
							This app is requesting basic access to your account.
						</p>
					)}
					{error ? <p className="text-destructive text-sm">{error}</p> : null}
				</CardContent>
				<CardFooter className="flex gap-2">
					<Button
						className="flex-1"
						disabled={decision !== null}
						onClick={() => respond(false)}
						variant="outline"
					>
						Deny
					</Button>
					<Button
						className="flex-1"
						disabled={decision !== null}
						onClick={() => respond(true)}
					>
						{decision === "allow" ? "Allowing…" : "Allow"}
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
