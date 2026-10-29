import { Badge } from "@StryveForms/ui/components/badge";
import { Input } from "@StryveForms/ui/components/input";
import { cn } from "@StryveForms/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { formatTrpcError } from "@/lib/format-trpc-error";
import { useTRPC } from "@/utils/trpc";

import { SettingsFooter, SettingsRow } from "./settings-row";

const DOMAIN_SPLIT = /[\n,\s]/;

const MODES = [
	{
		description:
			"Anyone with an account on this instance can sign up and create a workspace.",
		title: "Open",
		value: "open" as const,
	},
	{
		description:
			"Only admins can invite new members. Sign-up is disabled for everyone else.",
		title: "Invite-only",
		value: "closed" as const,
	},
];

export default function AdminAccessTab() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const settings = useQuery(trpc.instance.get.queryOptions());

	const [registrationMode, setRegistrationMode] = useState<"open" | "closed">(
		"open"
	);
	const [domains, setDomains] = useState<string[]>([]);
	const [domainDraft, setDomainDraft] = useState("");
	const [supportEmail, setSupportEmail] = useState("");

	useEffect(() => {
		if (!settings.data) {
			return;
		}
		setRegistrationMode(settings.data.registrationMode);
		setDomains(settings.data.allowedEmailDomains);
		setSupportEmail(settings.data.supportEmail ?? "");
	}, [settings.data]);

	const isDirty =
		settings.data !== undefined &&
		(registrationMode !== settings.data.registrationMode ||
			domains.join() !== settings.data.allowedEmailDomains.join() ||
			supportEmail !== (settings.data.supportEmail ?? ""));

	const discard = () => {
		if (!settings.data) {
			return;
		}
		setRegistrationMode(settings.data.registrationMode);
		setDomains(settings.data.allowedEmailDomains);
		setSupportEmail(settings.data.supportEmail ?? "");
	};

	const addDomains = (raw: string) => {
		const next = raw
			.split(DOMAIN_SPLIT)
			.map((d) => d.trim().toLowerCase())
			.filter(Boolean);
		if (next.length > 0) {
			setDomains((current) => [...new Set([...current, ...next])]);
		}
		setDomainDraft("");
	};

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
		<div className="space-y-6 pb-20">
			<div>
				<SettingsRow
					description="Control who can join this instance."
					label="Workspace access"
				>
					<fieldset className="grid gap-3 sm:grid-cols-2">
						<legend className="sr-only">Who can create an account?</legend>
						{MODES.map((mode) => (
							<label
								className={cn(
									"flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5 text-sm transition-colors",
									registrationMode === mode.value
										? "border-primary bg-primary-soft/40 ring-1 ring-primary"
										: "border-border hover:bg-muted/40"
								)}
								key={mode.value}
							>
								<input
									checked={registrationMode === mode.value}
									className="mt-0.5 accent-primary"
									name="admin-registration-mode"
									onChange={() => setRegistrationMode(mode.value)}
									type="radio"
								/>
								<span>
									<span className="block font-medium">{mode.title}</span>
									<span className="block text-subtle-foreground text-xs">
										{mode.description}
									</span>
								</span>
							</label>
						))}
					</fieldset>
				</SettingsRow>

				<SettingsRow
					description="Restrict sign-ups to these domains. Leave empty to allow any domain."
					htmlFor="admin-domain-input"
					label="Allowed email domains"
				>
					<div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input px-2 py-1.5 shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
						{domains.map((domain) => (
							<Badge key={domain} variant="neutral">
								{domain}
								<button
									aria-label={`Remove ${domain}`}
									onClick={() =>
										setDomains((current) => current.filter((d) => d !== domain))
									}
									type="button"
								>
									<XIcon className="size-3" />
								</button>
							</Badge>
						))}
						<Input
							className="h-6 min-w-28 flex-1 border-none bg-transparent px-1 shadow-none focus-visible:ring-0"
							id="admin-domain-input"
							onBlur={() => addDomains(domainDraft)}
							onChange={(event) => setDomainDraft(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === ",") {
									event.preventDefault();
									addDomains(domainDraft);
								}
							}}
							placeholder="Add a domain…"
							value={domainDraft}
						/>
					</div>
				</SettingsRow>

				<SettingsRow
					description="Shown to people who can't sign in."
					htmlFor="admin-support-email"
					label="Support email"
				>
					<Input
						id="admin-support-email"
						onChange={(event) => setSupportEmail(event.target.value)}
						type="email"
						value={supportEmail}
					/>
				</SettingsRow>
			</div>

			<SettingsFooter
				dirty={isDirty}
				onDiscard={discard}
				onSave={() =>
					update.mutate({
						allowedEmailDomains: domains,
						registrationMode,
						supportEmail: supportEmail.trim() || "",
					})
				}
				saving={update.isPending}
			/>
		</div>
	);
}
