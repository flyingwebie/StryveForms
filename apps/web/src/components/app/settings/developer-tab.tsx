import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
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
import { KeyIcon, PlusIcon, TerminalIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import McpInstructions from "@/components/app/admin/mcp-instructions";
import { CodeBlock } from "@/components/app/code-block";
import ConfirmDialog from "@/components/app/confirm-dialog";
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
						<PlusIcon /> New token
					</Button>
				}
			/>
			<DialogContent className="rounded-xl">
				<DialogHeader>
					<DialogTitle>Create a personal API token</DialogTitle>
					<DialogDescription>
						Used to authenticate the CLI or any HTTP client that connects as
						you. It's shown once — copy it before closing this dialog.
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
						<Label>Expires</Label>
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
		<div className="max-w-3xl space-y-6">
			<Card className="rounded-xl">
				<CardHeader className="flex flex-row items-start justify-between gap-4">
					<div>
						<CardTitle className="flex items-center gap-2">
							<KeyIcon className="size-4" /> API tokens
						</CardTitle>
						<CardDescription>
							Personal tokens that act as you — for the CLI, scripts, or any
							HTTP client that doesn't use the OAuth sign-in flow.
						</CardDescription>
					</div>
					{publicInfo.data?.allowApiTokens ? (
						<CreateTokenDialog onCreated={setNewToken} />
					) : null}
				</CardHeader>
				<CardContent>
					{publicInfo.data && !publicInfo.data.allowApiTokens ? (
						<p className="rounded-lg border border-border border-dashed p-4 text-muted-foreground text-sm">
							Personal API tokens are turned off for this instance by an
							administrator.
						</p>
					) : null}

					{newToken ? (
						<div className="mb-4 space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
							<p className="font-medium text-sm">
								Your new token — copy it now, it won't be shown again:
							</p>
							<CodeBlock code={newToken} filename="token" language="text" />
							<Button
								onClick={() => setNewToken(null)}
								size="sm"
								variant="ghost"
							>
								Done, I've copied it
							</Button>
						</div>
					) : null}

					{tokens.data && tokens.data.length > 0 ? (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Access</TableHead>
									<TableHead>Last used</TableHead>
									<TableHead>Expires</TableHead>
									<TableHead className="w-10" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{tokens.data.map((t) => (
									<TableRow key={t.id}>
										<TableCell className="font-medium">{t.name}</TableCell>
										<TableCell>
											<Badge
												variant={t.scope === "write" ? "default" : "secondary"}
											>
												{t.scope === "write" ? "Read & write" : "Read only"}
											</Badge>
										</TableCell>
										<TableCell className="text-muted-foreground">
											{t.lastUsedAt ? relativeDate(t.lastUsedAt) : "Never"}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{relativeDate(t.expiresAt)}
										</TableCell>
										<TableCell>
											<Button
												onClick={() => setRevokeId(t.id)}
												size="icon-sm"
												variant="ghost"
											>
												<TrashIcon className="text-destructive" />
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
				</CardContent>
			</Card>

			<Card className="rounded-xl">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<TerminalIcon className="size-4" /> Command-line (CLI)
					</CardTitle>
					<CardDescription>
						Install the StryveForms CLI, sign in once, then script forms,
						submissions and exports from your terminal or CI.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<CodeBlock
						code={
							"bunx stryveforms login\nbunx stryveforms workspaces list\nbunx stryveforms forms list --json"
						}
						filename="terminal"
						language="bash"
					/>
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
				</CardContent>
			</Card>

			{publicInfo.data?.mcpEnabled ? (
				<McpInstructions
					serverUrl={publicInfo.data.serverUrl}
					token={newToken ?? undefined}
				/>
			) : null}

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
