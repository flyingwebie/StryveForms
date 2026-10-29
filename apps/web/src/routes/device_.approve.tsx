import { Button } from "@StryveForms/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CheckIcon, MonitorIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import AuthShell from "@/components/app/auth/auth-shell";
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

function ResultCard({ approved }: { approved: boolean }) {
	return (
		<div className="space-y-4 text-center">
			<span
				className={
					approved
						? "inline-flex size-12 items-center justify-center rounded-xl bg-success-soft text-success"
						: "inline-flex size-12 items-center justify-center rounded-xl bg-destructive-soft text-destructive"
				}
			>
				{approved ? (
					<CheckIcon className="size-6" />
				) : (
					<XIcon className="size-6" />
				)}
			</span>
			<div className="space-y-1">
				<h1 className="font-semibold text-xl tracking-tight">
					{approved ? "Device connected" : "Request denied"}
				</h1>
				<p className="text-muted-foreground text-sm">
					{approved
						? "You can now close this window and return to your device."
						: "This device was not approved. You can close this window."}
				</p>
			</div>
		</div>
	);
}

function RouteComponent() {
	const { user_code: userCode } = Route.useSearch();
	const { data: session } = authClient.useSession();
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

	return (
		<AuthShell showHero={false}>
			<div className="w-full rounded-2xl border bg-card p-6 text-card-foreground shadow-black/5 shadow-xl sm:p-8 dark:shadow-black/40">
				{result ? (
					<ResultCard approved={result === "approved"} />
				) : (
					<div className="space-y-5">
						<div className="space-y-4 text-center">
							<span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
								<ShieldCheckIcon className="size-6" />
							</span>
							<div className="space-y-1">
								<h1 className="font-semibold text-xl tracking-tight">
									Approve this device?
								</h1>
								<p className="text-muted-foreground text-sm">
									It will sign in as you — {session?.user.email ?? "you"}.
								</p>
							</div>
						</div>

						<div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3 text-left">
							<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
								<MonitorIcon className="size-4" />
							</span>
							<div className="min-w-0">
								<p className="truncate font-semibold text-sm">
									{request.data?.client_id ?? "This device"}
								</p>
								<p className="truncate text-muted-foreground text-xs">
									Code <span className="font-mono">{userCode}</span>
								</p>
							</div>
						</div>

						{scopes.length > 0 ? (
							<ul className="space-y-1.5 text-muted-foreground text-sm">
								{scopes.map((label) => (
									<li key={label}>It will be able to {label}.</li>
								))}
							</ul>
						) : null}

						{error ? <p className="text-destructive text-sm">{error}</p> : null}

						<div className="flex gap-2">
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
						</div>
					</div>
				)}
			</div>
		</AuthShell>
	);
}
