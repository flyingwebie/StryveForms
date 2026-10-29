import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { cn } from "@StryveForms/ui/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, XIcon } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

const ACCESS_OPTIONS = [
	{
		description:
			"Anyone with an account on this instance can create or join a workspace.",
		label: "Open",
		value: "open" as const,
	},
	{
		description: "New members must be invited by a workspace admin.",
		label: "Invite-only",
		value: "closed" as const,
	},
];

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
	const [domains, setDomains] = useState<string[]>([]);
	const [domainDraft, setDomainDraft] = useState("");
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

	function addDomain() {
		const domain = domainDraft.trim().toLowerCase();
		if (domain && !domains.includes(domain)) {
			setDomains((prev) => [...prev, domain]);
		}
		setDomainDraft("");
	}

	function handleDomainKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Enter" || event.key === ",") {
			event.preventDefault();
			addDomain();
		}
	}

	return (
		<div className="space-y-6">
			<fieldset className="space-y-2">
				<Label>Who can create an account?</Label>
				<div className="grid gap-2 sm:grid-cols-2">
					{ACCESS_OPTIONS.map((option) => {
						const selected = registrationMode === option.value;
						return (
							<label
								className={cn(
									"flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm transition-colors",
									selected
										? "border-primary bg-primary-soft/40"
										: "border-border hover:bg-muted/50"
								)}
								key={option.value}
							>
								<input
									checked={selected}
									className="mt-0.5 accent-primary"
									name="registration-mode"
									onChange={() => setRegistrationMode(option.value)}
									type="radio"
								/>
								<span>
									<span className="block font-medium">{option.label}</span>
									<span className="block text-muted-foreground">
										{option.description}
									</span>
								</span>
							</label>
						);
					})}
				</div>
			</fieldset>

			<div className="space-y-2">
				<Label htmlFor="setup-domain-input">
					Allowed email domains (optional)
				</Label>
				<div className="flex flex-wrap items-center gap-2 rounded-lg border border-input p-2">
					{domains.map((domain) => (
						<span
							className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground text-xs"
							key={domain}
						>
							{domain}
							<button
								aria-label={`Remove ${domain}`}
								onClick={() =>
									setDomains((prev) => prev.filter((d) => d !== domain))
								}
								type="button"
							>
								<XIcon className="size-3" />
							</button>
						</span>
					))}
					<input
						className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
						id="setup-domain-input"
						onBlur={addDomain}
						onChange={(event) => setDomainDraft(event.target.value)}
						onKeyDown={handleDomainKeyDown}
						placeholder={domains.length === 0 ? "acme.com" : ""}
						value={domainDraft}
					/>
					<Button onClick={addDomain} size="xs" type="button" variant="ghost">
						<PlusIcon /> Add domain
					</Button>
				</div>
				<p className="text-muted-foreground text-xs">
					Press enter after each domain. Leave empty to allow any domain.
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
							allowedEmailDomains: domains,
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
