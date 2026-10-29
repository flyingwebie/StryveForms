import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { Textarea } from "@StryveForms/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { formatTrpcError } from "@/lib/format-trpc-error";
import { useTRPC } from "@/utils/trpc";

const DOMAIN_SPLIT = /[\n,]/;

export default function AdminAccessTab() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const settings = useQuery(trpc.instance.get.queryOptions());

	const [registrationMode, setRegistrationMode] = useState<"open" | "closed">(
		"open"
	);
	const [domains, setDomains] = useState("");
	const [supportEmail, setSupportEmail] = useState("");

	useEffect(() => {
		if (!settings.data) {
			return;
		}
		setRegistrationMode(settings.data.registrationMode);
		setDomains(settings.data.allowedEmailDomains.join("\n"));
		setSupportEmail(settings.data.supportEmail ?? "");
	}, [settings.data]);

	const update = useMutation(
		trpc.instance.update.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.instance.public.queryKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.instance.get.queryKey(),
					}),
				]);
				toast.success("Access settings updated");
			},
		})
	);

	return (
		<div className="max-w-lg space-y-6">
			<fieldset className="space-y-2">
				<Label>Who can create an account?</Label>
				<div className="space-y-2">
					<label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
						<input
							checked={registrationMode === "open"}
							className="mt-0.5"
							name="admin-registration-mode"
							onChange={() => setRegistrationMode("open")}
							type="radio"
						/>
						<span>
							<span className="block font-medium">Open</span>
							<span className="block text-muted-foreground">
								Anyone can sign up (optionally restricted to the domains below).
							</span>
						</span>
					</label>
					<label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
						<input
							checked={registrationMode === "closed"}
							className="mt-0.5"
							name="admin-registration-mode"
							onChange={() => setRegistrationMode("closed")}
							type="radio"
						/>
						<span>
							<span className="block font-medium">Invite-only</span>
							<span className="block text-muted-foreground">
								Only people with a pending workspace invite can sign up.
							</span>
						</span>
					</label>
				</div>
			</fieldset>

			<div className="space-y-2">
				<Label htmlFor="admin-domains">Allowed email domains</Label>
				<Textarea
					id="admin-domains"
					onChange={(event) => setDomains(event.target.value)}
					placeholder="acme.com, acme.io"
					value={domains}
				/>
				<p className="text-muted-foreground text-xs">
					Comma or newline separated. Leave empty to allow any domain.
				</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor="admin-support-email">Support email</Label>
				<Input
					id="admin-support-email"
					onChange={(event) => setSupportEmail(event.target.value)}
					type="email"
					value={supportEmail}
				/>
			</div>

			<Button
				disabled={update.isPending}
				onClick={() =>
					update.mutate({
						allowedEmailDomains: domains
							.split(DOMAIN_SPLIT)
							.map((d) => d.trim().toLowerCase())
							.filter(Boolean),
						registrationMode,
						supportEmail: supportEmail.trim() || "",
					})
				}
			>
				{update.isPending ? "Saving…" : "Save access settings"}
			</Button>
		</div>
	);
}
