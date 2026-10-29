import { Button } from "@StryveForms/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	type FileTextIcon,
	ListChecksIcon,
	PlusSquareIcon,
	ShieldCheckIcon,
	UserIcon,
} from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import AuthShell from "@/components/app/auth/auth-shell";
import { authClient } from "@/lib/auth-client";

/** Plain-language names (and icons) for the OAuth scopes this instance issues. "openid"/"profile" are implementation details, not shown. */
const SCOPE_DETAILS: Record<
	string,
	{ icon: typeof FileTextIcon; label: string }
> = {
	offline_access: {
		icon: ShieldCheckIcon,
		label: "Stay connected without you signing in again",
	},
	"mcp:read": { icon: ListChecksIcon, label: "Read form submissions" },
	"mcp:write": {
		icon: PlusSquareIcon,
		label: "Create new forms on your behalf",
	},
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
	const { data: session } = authClient.useSession();
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
		.filter((s) => SCOPE_DETAILS[s])
		.map((s) => SCOPE_DETAILS[s]);

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
		<AuthShell showHero={false} size="md">
			<div className="w-full rounded-2xl border bg-card p-6 text-card-foreground shadow-black/5 shadow-xl sm:p-8 dark:shadow-black/40">
				<div className="space-y-5">
					<div className="flex items-start gap-3">
						<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
							<ShieldCheckIcon className="size-5" />
						</span>
						<div className="space-y-0.5">
							<h1 className="font-semibold text-base leading-snug">
								{client.isLoading
									? "Loading…"
									: `${clientName} wants to access your account`}
							</h1>
							{client.data?.client_id ? (
								<p className="text-muted-foreground text-xs">
									{client.data.client_id}
								</p>
							) : null}
						</div>
					</div>

					<div className="space-y-2 rounded-xl bg-muted/50 p-3">
						<p className="text-muted-foreground text-xs">
							This will allow {clientName} to:
						</p>
						{scopes.length > 0 ? (
							<ul className="space-y-2">
								{scopes.map(({ icon: Icon, label }) => (
									<li className="flex items-center gap-2 text-sm" key={label}>
										<Icon className="size-4 text-muted-foreground" />
										{label}
									</li>
								))}
							</ul>
						) : (
							<p className="text-sm">
								This app is requesting basic access to your account.
							</p>
						)}
					</div>

					{session?.user ? (
						<div className="flex items-center gap-2 border-t pt-4">
							<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft font-medium text-primary-soft-foreground text-xs">
								{session.user.name ? (
									session.user.name
										.split(" ")
										.map((part) => part.slice(0, 1))
										.join("")
										.slice(0, 2)
										.toUpperCase()
								) : (
									<UserIcon className="size-4" />
								)}
							</span>
							<p className="min-w-0 truncate text-sm">{session.user.email}</p>
						</div>
					) : null}

					{error ? <p className="text-destructive text-sm">{error}</p> : null}

					<div className="flex gap-2">
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
							{decision === "allow" ? "Approving…" : "Approve"}
						</Button>
					</div>
				</div>
			</div>
		</AuthShell>
	);
}
