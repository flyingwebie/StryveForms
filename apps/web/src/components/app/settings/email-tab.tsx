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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Switch } from "@StryveForms/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
	SettingsFooter,
	SettingsRow,
	SettingsSection,
} from "@/components/app/settings-shell";
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
		<div className="space-y-10">
			<SettingsSection
				description="The email addresses notifications can be sent from. Pick one as the default — forms can still choose a different sender for their own notifications."
				title="Senders"
			>
				<div className="space-y-3 border-t-0 py-0">
					{senders.length > 0 ? (
						<ItemGroup className="gap-2">
							{senders.map((sender) => (
								<Item className="rounded-lg" key={sender.id} variant="outline">
									<MailIcon className="size-4 shrink-0 text-muted-foreground" />
									<ItemContent>
										<ItemTitle className="flex items-center gap-2">
											{sender.name} &lt;{sender.address}&gt;
											{sender.id === defaultSenderId ? (
												<Badge variant="soft">Default</Badge>
											) : null}
										</ItemTitle>
										<ItemDescription>
											Replies go to {sender.replyTo || sender.address}
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
												className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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
							<PlusIcon /> Add sender
						</Button>
					) : null}

					<p className="text-muted-foreground text-xs">
						Heads up: the "From" address only works if your SMTP server (below)
						allows sending mail as that address — otherwise most mail providers
						will reject or quietly rewrite it.
					</p>
				</div>
			</SettingsSection>

			<SettingsSection
				description="Used for outgoing mail when no managed sender is configured."
				title={
					<span className="flex items-center justify-between gap-3">
						Custom SMTP
						<Switch
							checked={smtpEnabled}
							disabled={!isAdmin}
							onCheckedChange={setSmtpEnabled}
						/>
					</span>
				}
			>
				{smtpEnabled ? (
					<>
						<SettingsRow description="SMTP server hostname." label="Host">
							<Input
								disabled={!isAdmin}
								id="smtp-host"
								onChange={(event) =>
									setSmtp({ ...smtp, host: event.target.value })
								}
								placeholder="smtp.yourhost.com"
								value={smtp.host}
							/>
						</SettingsRow>
						<SettingsRow
							description="Usually 587 (STARTTLS) or 465 (SSL)."
							label="Port"
						>
							<Input
								disabled={!isAdmin}
								id="smtp-port"
								onChange={(event) =>
									setSmtp({ ...smtp, port: Number(event.target.value) })
								}
								type="number"
								value={smtp.port}
							/>
						</SettingsRow>
						<SettingsRow
							description="Usually the full email address."
							label="Username"
						>
							<Input
								disabled={!isAdmin}
								id="smtp-username"
								onChange={(event) =>
									setSmtp({ ...smtp, username: event.target.value })
								}
								value={smtp.username}
							/>
						</SettingsRow>
						<SettingsRow
							description="Stored encrypted, never shown again."
							label="Password"
						>
							<Input
								disabled={!isAdmin}
								id="smtp-password"
								onChange={(event) => setSmtpPassword(event.target.value)}
								placeholder={
									smtp.hasPassword ? "Leave blank to keep current" : ""
								}
								type="password"
								value={smtpPassword}
							/>
						</SettingsRow>
						<SettingsRow
							description={'The "from" address used for outgoing mail.'}
							label="Sender address"
						>
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
						</SettingsRow>
						<SettingsRow
							description="How the connection to the server is secured."
							label="Encryption"
						>
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
						</SettingsRow>
					</>
				) : null}
			</SettingsSection>

			{isAdmin ? (
				<SettingsFooter>
					<Button disabled={update.isPending} onClick={saveSmtp}>
						{update.isPending ? "Saving…" : "Save"}
					</Button>
				</SettingsFooter>
			) : null}

			<SenderDialog
				onOpenChange={setDialogOpen}
				onSave={handleSaveSender}
				open={dialogOpen}
				sender={editingSender}
			/>
		</div>
	);
}
