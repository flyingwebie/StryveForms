import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@StryveForms/ui/components/dialog";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@StryveForms/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangleIcon,
	CheckIcon,
	CopyIcon,
	KeyIcon,
	PlusIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import McpInstructions from "@/components/app/admin/mcp-instructions";
import { CodeBlock } from "@/components/app/code-block";
import ConfirmDialog from "@/components/app/confirm-dialog";
import { SettingsSection } from "@/components/app/settings-shell";
import { formatTrpcError } from "@/lib/format-trpc-error";
import { useTRPC } from "@/utils/trpc";

const EXPIRY_OPTIONS = [
	{ label: "Never", value: "never" },
	{ label: "30 days", value: "30" },
	{ label: "90 days", value: "90" },
	{ label: "1 year", value: "365" },
] as const;

function relativeDate(value: string | Date | null) {
	if (!value) {
		return "Never";
	}
	return new Date(value).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

/** Create-token dialog: name, read/write scope, optional expiry. Shows the plaintext token exactly once on success. */
function CreateTokenDialog({
	onCreated,
}: {
	onCreated: (token: string) => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [scope, setScope] = useState<"read" | "write">("read");
	const [expiry, setExpiry] = useState("never");

	const create = useMutation(
		trpc.instance.agent.tokens.create.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async (result) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.instance.agent.tokens.list.queryKey(),
				});
				setOpen(false);
				setName("");
				setScope("read");
				setExpiry("never");
				onCreated(result.token);
			},
		})
	);

	return (
		<Dialog
			onOpenChange={(next) => {
				setOpen(next);
				if (next) {
					setName("");
					setScope("read");
					setExpiry("never");
				}
			}}
			open={open}
		>
			<DialogTrigger
				render={
					<Button size="sm">
						<PlusIcon /> Create token
					</Button>
				}
			/>
			<DialogContent className="rounded-xl">
				<DialogHeader>
					<DialogTitle>Create a personal API token</DialogTitle>
					<DialogDescription>
						Generates an API token scoped to you. It's shown once — copy it
						before closing this dialog.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="token-name">Name</Label>
						<Input
							id="token-name"
							onChange={(event) => setName(event.target.value)}
							placeholder="e.g. My laptop CLI"
							value={name}
						/>
					</div>
					<div className="space-y-2">
						<Label>Access</Label>
						<Select
							items={[
								{ label: "Read only", value: "read" },
								{ label: "Read & write", value: "write" },
							]}
							onValueChange={(value) =>
								value && setScope(value as "read" | "write")
							}
							value={scope}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="read">Read only</SelectItem>
								<SelectItem value="write">Read &amp; write</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-muted-foreground text-xs">
							Read & write lets this token create, edit and publish forms.
							Choose Read only unless the thing using this token needs to make
							changes.
						</p>
					</div>
					<div className="space-y-2">
						<Label>Expiry</Label>
						<Select
							items={EXPIRY_OPTIONS}
							onValueChange={(value) => value && setExpiry(value)}
							value={expiry}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{EXPIRY_OPTIONS.map((o) => (
									<SelectItem key={o.value} value={o.value}>
										{o.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
				<DialogFooter>
					<Button
						disabled={!name.trim() || create.isPending}
						onClick={() =>
							create.mutate({
								expiresInDays: expiry === "never" ? null : Number(expiry),
								name: name.trim(),
								scope,
							})
						}
					>
						{create.isPending ? "Creating…" : "Create token"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** "Token created" dialog: the plaintext token is shown exactly once. */
function TokenCreatedDialog({
	onOpenChange,
	token,
}: {
	onOpenChange: (open: boolean) => void;
	token: string | null;
}) {
	const [copied, setCopied] = useState(false);

	async function copy() {
		if (!token) {
			return;
		}
		await navigator.clipboard.writeText(token);
		setCopied(true);
		toast.success("Token copied");
	}

	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open) {
					setCopied(false);
				}
				onOpenChange(open);
			}}
			open={token !== null}
		>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-success-soft text-success">
						<KeyIcon className="size-5" />
					</div>
					<DialogTitle>Token created</DialogTitle>
					<DialogDescription>
						Copy it now and store it somewhere safe, like a password manager.
					</DialogDescription>
				</DialogHeader>
				{token ? (
					<div className="space-y-3">
						<span className="sr-only">Your new API token:</span>
						<code className="block select-all break-all rounded-lg border border-border bg-subtle px-3.5 py-3 font-mono text-[13px] leading-relaxed">
							{token}
						</code>
						<p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-warning text-xs">
							<AlertTriangleIcon className="mt-px size-3.5 shrink-0" />
							This is the only time the token is shown. If you lose it, revoke
							it and create a new one.
						</p>
					</div>
				) : null}
				<DialogFooter>
					<Button
						onClick={copy}
						type="button"
						variant={copied ? "outline" : "default"}
					>
						{copied ? <CheckIcon /> : <CopyIcon />}
						{copied ? "Copied" : "Copy token"}
					</Button>
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant={copied ? "default" : "outline"}
					>
						Done
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** The settings page's "API tokens / Developers" section: personal tokens, CLI instructions, and MCP connect instructions (when enabled). */
export default function DeveloperSettingsTab() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const tokens = useQuery(trpc.instance.agent.tokens.list.queryOptions());
	const publicInfo = useQuery(trpc.instance.agent.publicInfo.queryOptions());
	const [newToken, setNewToken] = useState<string | null>(null);
	const [revokeId, setRevokeId] = useState<string | null>(null);

	const revoke = useMutation(
		trpc.instance.agent.tokens.revoke.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.instance.agent.tokens.list.queryKey(),
				});
				setRevokeId(null);
				toast.success("Token revoked");
			},
		})
	);

	return (
		<div className="space-y-10">
			<SettingsSection
				title={
					<span className="flex items-center justify-between gap-3">
						API tokens
						{publicInfo.data?.allowApiTokens ? (
							<CreateTokenDialog onCreated={setNewToken} />
						) : null}
					</span>
				}
			>
				<div className="py-4">
					{publicInfo.data && !publicInfo.data.allowApiTokens ? (
						<p className="rounded-lg border border-border border-dashed p-4 text-muted-foreground text-sm">
							Personal API tokens are turned off for this instance by an
							administrator.
						</p>
					) : null}

					{tokens.data && tokens.data.length > 0 ? (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Access</TableHead>
									<TableHead>Created</TableHead>
									<TableHead>Last used</TableHead>
									<TableHead>Expires</TableHead>
									<TableHead className="w-16" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{tokens.data.map((t) => (
									<TableRow key={t.id}>
										<TableCell className="flex items-center gap-2 font-medium">
											<KeyIcon className="size-4 text-muted-foreground" />
											{t.name}
										</TableCell>
										<TableCell>
											<Badge variant={t.scope === "write" ? "soft" : "neutral"}>
												{t.scope === "write" ? "Read & write" : "Read only"}
											</Badge>
										</TableCell>
										<TableCell className="text-muted-foreground">
											{relativeDate(t.createdAt)}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{t.lastUsedAt ? relativeDate(t.lastUsedAt) : "Never"}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{relativeDate(t.expiresAt)}
										</TableCell>
										<TableCell className="text-right">
											<Button
												className="text-destructive hover:bg-destructive/10 hover:text-destructive"
												onClick={() => setRevokeId(t.id)}
												size="sm"
												variant="ghost"
											>
												Revoke
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					) : (
						<p className="text-muted-foreground text-sm">
							No personal API tokens yet.
						</p>
					)}
				</div>
			</SettingsSection>

			<SettingsSection
				description="Manage forms and submissions from your terminal."
				title="StryveForms CLI"
			>
				<div className="space-y-4 py-4">
					<div className="space-y-1.5">
						<p className="font-medium text-[13px]">Run it</p>
						<CodeBlock
							code="bunx stryveforms --help"
							filename="terminal"
							language="bash"
						/>
					</div>
					<div className="space-y-1.5">
						<p className="font-medium text-[13px]">Sign in</p>
						<CodeBlock
							code={`stryveforms login --token ${newToken ?? "sfpat_…"}`}
							filename="terminal"
							language="bash"
						/>
					</div>
					<div className="space-y-1.5">
						<p className="font-medium text-[13px]">List your forms</p>
						<CodeBlock
							code="stryveforms forms list --workspace <id>"
							filename="terminal"
							language="bash"
						/>
					</div>
					<p className="text-muted-foreground text-sm">
						<code className="rounded bg-muted px-1 py-0.5 text-xs">login</code>{" "}
						opens a browser to approve the CLI, or pass{" "}
						<code className="rounded bg-muted px-1 py-0.5 text-xs">
							--token
						</code>{" "}
						with a personal API token above. Every command supports{" "}
						<code className="rounded bg-muted px-1 py-0.5 text-xs">--json</code>{" "}
						for scripting and{" "}
						<code className="rounded bg-muted px-1 py-0.5 text-xs">--help</code>
						.
					</p>
				</div>
			</SettingsSection>

			{publicInfo.data?.mcpEnabled ? (
				<McpInstructions
					serverUrl={publicInfo.data.serverUrl}
					token={newToken ?? undefined}
				/>
			) : null}

			<TokenCreatedDialog
				onOpenChange={(open) => !open && setNewToken(null)}
				token={newToken}
			/>

			<ConfirmDialog
				description="This token will stop working immediately. Anything using it (the CLI, a script) will need a new one."
				loading={revoke.isPending}
				onConfirm={() => revokeId && revoke.mutate({ id: revokeId })}
				onOpenChange={(open) => !open && setRevokeId(null)}
				open={revokeId !== null}
				title="Revoke this token?"
			/>
		</div>
	);
}
