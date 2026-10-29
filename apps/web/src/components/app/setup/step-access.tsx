import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { Textarea } from "@StryveForms/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

const DOMAIN_SPLIT = /[\n,]/;

/** Step 3: who can sign up. */
export default function SetupStepAccess({
	onBack,
	onDone,
}: {
	onBack: () => void;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [registrationMode, setRegistrationMode] = useState<"open" | "closed">(
		"open"
	);
	const [domains, setDomains] = useState("");
	const [supportEmail, setSupportEmail] = useState("");

	const update = useMutation(
		trpc.instance.update.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.instance.public.queryKey(),
				});
				onDone();
			},
		})
	);

	return (
		<div className="space-y-6">
			<fieldset className="space-y-2">
				<Label>Who can create an account?</Label>
				<div className="space-y-2">
					<label className="flex items-start gap-2 rounded-xl border border-border p-3 text-sm">
						<input
							checked={registrationMode === "open"}
							className="mt-0.5"
							name="registration-mode"
							onChange={() => setRegistrationMode("open")}
							type="radio"
						/>
						<span>
							<span className="block font-medium">Open</span>
							<span className="block text-muted-foreground">
								Anyone can sign up (optionally restricted to email domains
								below).
							</span>
						</span>
					</label>
					<label className="flex items-start gap-2 rounded-xl border border-border p-3 text-sm">
						<input
							checked={registrationMode === "closed"}
							className="mt-0.5"
							name="registration-mode"
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
				<Label htmlFor="setup-domains">Allowed email domains (optional)</Label>
				<Textarea
					id="setup-domains"
					onChange={(event) => setDomains(event.target.value)}
					placeholder="acme.com, acme.io"
					value={domains}
				/>
				<p className="text-muted-foreground text-xs">
					Comma or newline separated. Leave empty to allow any domain.
				</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor="setup-support-email">Support email (optional)</Label>
				<Input
					id="setup-support-email"
					onChange={(event) => setSupportEmail(event.target.value)}
					type="email"
					value={supportEmail}
				/>
			</div>

			<div className="flex justify-between">
				<Button onClick={onBack} type="button" variant="outline">
					Back
				</Button>
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
					type="button"
				>
					{update.isPending ? "Saving…" : "Continue"}
				</Button>
			</div>
		</div>
	);
}
