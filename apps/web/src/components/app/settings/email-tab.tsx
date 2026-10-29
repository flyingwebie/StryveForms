import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemTitle,
} from "@StryveForms/ui/components/item";
import { Label } from "@StryveForms/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Switch } from "@StryveForms/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { formatTrpcError } from "@/lib/format-trpc-error";
import type { WorkspaceSummary } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

import SenderDialog, { type SenderFormValue } from "./sender-dialog";

type SmtpEncryption = "none" | "ssl" | "starttls";

interface SmtpSettings {
	encryption?: SmtpEncryption;
	hasPassword?: boolean;
	host: string;
	port: number;
	senderAddress?: string;
	username: string;
}

const DEFAULT_SMTP: SmtpSettings = {
	encryption: "starttls",
	host: "",
	port: 587,
	senderAddress: "",
	username: "",
};

/** Standard port suggested for each encryption mode, used to auto-fill Port on change. */
const STANDARD_PORTS: Record<SmtpEncryption, number> = {
	none: 25,
	ssl: 465,
	starttls: 587,
};

const ENCRYPTION_OPTIONS: {
	description: string;
	label: string;
	value: SmtpEncryption;
}[] = [
	{
		description: "Unencrypted. Only use this for a trusted local mail server.",
		label: "None",
		value: "none",
	},
	{
		description: "Encrypts the connection from the start — usually port 465.",
		label: "SSL/TLS",
		value: "ssl",
	},
	{
		description:
			"Starts as plain text, then upgrades to an encrypted connection — usually port 587.",
		label: "STARTTLS",
		value: "starttls",
	},
];

export default function EmailSettingsTab({
	workspace,
}: {
	workspace: WorkspaceSummary;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const detail = useQuery(
		trpc.workspace.get.queryOptions({ id: workspace.id })
	);
	const [senders, setSenders] = useState<SenderFormValue[]>([]);
	const [defaultSenderId, setDefaultSenderId] = useState<string | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingSender, setEditingSender] = useState<SenderFormValue | null>(
		null
	);
	const [smtpEnabled, setSmtpEnabled] = useState(false);
	const [smtp, setSmtp] = useState<SmtpSettings>(DEFAULT_SMTP);
	const [smtpPassword, setSmtpPassword] = useState("");

	useEffect(() => {
		const settings = detail.data?.settings as
			| {
					defaultSenderId?: string | null;
					senders?: SenderFormValue[];
					smtp?: SmtpSettings | null;
			  }
			| undefined;
		setSenders(settings?.senders ?? []);
		setDefaultSenderId(settings?.defaultSenderId ?? null);
		setSmtpEnabled(Boolean(settings?.smtp));
		setSmtp(
			settings?.smtp ? { ...DEFAULT_SMTP, ...settings.smtp } : DEFAULT_SMTP
		);
		setSmtpPassword("");
	}, [detail.data]);

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: trpc.workspace.get.queryKey() });

	const update = useMutation(
		trpc.workspace.update.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
		})
	);

	const isAdmin = workspace.role === "admin";

	function saveSenders(
		nextSenders: SenderFormValue[],
		nextDefaultSenderId: string | null
	) {
		update.mutate(
			{
				id: workspace.id,
				settings: {
					defaultSenderId: nextDefaultSenderId,
					senders: nextSenders,
				},
			},
			{
				onSuccess: async () => {
					await invalidate();
					toast.success("Senders saved");
				},
			}
		);
	}

	function handleSaveSender(value: SenderFormValue) {
		const exists = senders.some((s) => s.id === value.id);
		const next = exists
			? senders.map((s) => (s.id === value.id ? value : s))
			: [...senders, value];
		const nextDefaultId = defaultSenderId ?? next[0]?.id ?? null;
		setSenders(next);
		setDefaultSenderId(nextDefaultId);
		setDialogOpen(false);
		saveSenders(next, nextDefaultId);
	}

	function handleRemoveSender(id: string) {
		const next = senders.filter((s) => s.id !== id);
		const nextDefaultId =
			defaultSenderId === id ? (next[0]?.id ?? null) : defaultSenderId;
		setSenders(next);
		setDefaultSenderId(nextDefaultId);
		saveSenders(next, nextDefaultId);
	}

	function handleSetDefault(id: string) {
		setDefaultSenderId(id);
		saveSenders(senders, id);
	}

	const saveSmtp = () =>
		update.mutate(
			{
				id: workspace.id,
				settings: {
					smtp: smtpEnabled
						? {
								encryption: smtp.encryption ?? "starttls",
								host: smtp.host,
								port: smtp.port,
								senderAddress: smtp.senderAddress,
								username: smtp.username,
								...(smtpPassword ? { password: smtpPassword } : {}),
							}
						: null,
				},
			},
			{
				onSuccess: async () => {
					await invalidate();
					toast.success("SMTP settings saved");
				},
			}
		);

	function handleEncryptionChange(encryption: SmtpEncryption) {
		// Auto-suggest the matching port, but only when the port still matches
		// a standard one — a custom port the admin already typed is left alone.
		const standardPorts = Object.values(STANDARD_PORTS);
		const nextPort = standardPorts.includes(smtp.port)
			? STANDARD_PORTS[encryption]
			: smtp.port;
		setSmtp({ ...smtp, encryption, port: nextPort });
	}

	return (
		<div className="max-w-lg space-y-8">
			<div className="space-y-4">
				<h3 className="font-medium text-sm">Senders</h3>
				<p className="text-muted-foreground text-sm">
					The email addresses notifications can be sent from. Pick one as the
					default — forms can still choose a different sender for their own
					notifications. Every sender has a reply-to address, which defaults to
					the sender's own address but can be changed.
				</p>

				{senders.length > 0 ? (
					<ItemGroup>
						{senders.map((sender) => (
							<Item className="rounded-lg" key={sender.id} variant="outline">
								<ItemContent>
									<ItemTitle>
										{sender.name}
										{sender.id === defaultSenderId ? (
											<Badge className="ml-1" variant="secondary">
												Default
											</Badge>
										) : null}
									</ItemTitle>
									<ItemDescription>
										{sender.address} &middot; replies to{" "}
										{sender.replyTo || sender.address}
									</ItemDescription>
								</ItemContent>
								{isAdmin ? (
									<ItemActions className="gap-1">
										{sender.id === defaultSenderId ? null : (
											<Button
												onClick={() => handleSetDefault(sender.id)}
												size="sm"
												variant="ghost"
											>
												Make default
											</Button>
										)}
										<Button
											onClick={() => {
												setEditingSender(sender);
												setDialogOpen(true);
											}}
											size="sm"
											variant="ghost"
										>
											Edit
										</Button>
										<Button
											onClick={() => handleRemoveSender(sender.id)}
											size="sm"
											variant="ghost"
										>
											Remove
										</Button>
									</ItemActions>
								) : null}
							</Item>
						))}
					</ItemGroup>
				) : (
					<p className="rounded-xl border border-dashed p-4 text-center text-muted-foreground text-sm">
						No senders yet — notifications use the shared instance address.
					</p>
				)}

				{isAdmin ? (
					<Button
						onClick={() => {
							setEditingSender(null);
							setDialogOpen(true);
						}}
						variant="outline"
					>
						Add sender
					</Button>
				) : null}

				<p className="text-muted-foreground text-xs">
					Heads up: the "From" address only works if your SMTP server (below)
					allows sending mail as that address — otherwise most mail providers
					will reject or quietly rewrite it.
				</p>
			</div>

			<div className="space-y-4 border-t pt-6">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="font-medium text-sm">Custom SMTP</h3>
						<p className="text-muted-foreground text-sm">
							Send notifications through your own mail server instead of the
							shared one.
						</p>
					</div>
					<Switch
						checked={smtpEnabled}
						disabled={!isAdmin}
						onCheckedChange={setSmtpEnabled}
					/>
				</div>

				{smtpEnabled ? (
					<div className="space-y-4">
						<div className="grid grid-cols-3 gap-2">
							<div className="col-span-2 space-y-2">
								<Label htmlFor="smtp-host">Host</Label>
								<Input
									disabled={!isAdmin}
									id="smtp-host"
									onChange={(event) =>
										setSmtp({ ...smtp, host: event.target.value })
									}
									placeholder="smtp.yourhost.com"
									value={smtp.host}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="smtp-port">Port</Label>
								<Input
									disabled={!isAdmin}
									id="smtp-port"
									onChange={(event) =>
										setSmtp({ ...smtp, port: Number(event.target.value) })
									}
									type="number"
									value={smtp.port}
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="smtp-username">Username</Label>
							<Input
								disabled={!isAdmin}
								id="smtp-username"
								onChange={(event) =>
									setSmtp({ ...smtp, username: event.target.value })
								}
								value={smtp.username}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="smtp-password">
								Password
								{smtp.hasPassword ? " (leave blank to keep current)" : ""}
							</Label>
							<Input
								disabled={!isAdmin}
								id="smtp-password"
								onChange={(event) => setSmtpPassword(event.target.value)}
								placeholder={smtp.hasPassword ? "••••••••" : ""}
								type="password"
								value={smtpPassword}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="smtp-sender">Sender address</Label>
							<Input
								disabled={!isAdmin}
								id="smtp-sender"
								onChange={(event) =>
									setSmtp({ ...smtp, senderAddress: event.target.value })
								}
								placeholder="notifications@yourcompany.com"
								type="email"
								value={smtp.senderAddress}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="smtp-encryption">Encryption</Label>
							<Select
								disabled={!isAdmin}
								items={ENCRYPTION_OPTIONS.map((option) => ({
									label: option.label,
									value: option.value,
								}))}
								onValueChange={(value) =>
									value && handleEncryptionChange(value as SmtpEncryption)
								}
								value={smtp.encryption ?? "starttls"}
							>
								<SelectTrigger className="w-full" id="smtp-encryption">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{ENCRYPTION_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="text-muted-foreground text-xs">
								{
									ENCRYPTION_OPTIONS.find((o) => o.value === smtp.encryption)
										?.description
								}
							</p>
						</div>
					</div>
				) : null}

				<Button disabled={!isAdmin || update.isPending} onClick={saveSmtp}>
					{update.isPending ? "Saving…" : "Save SMTP settings"}
				</Button>
			</div>

			<SenderDialog
				onOpenChange={setDialogOpen}
				onSave={handleSaveSender}
				open={dialogOpen}
				sender={editingSender}
			/>
		</div>
	);
}
