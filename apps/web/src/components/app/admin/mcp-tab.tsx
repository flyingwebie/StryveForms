import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import { Label } from "@StryveForms/ui/components/label";
import { Switch } from "@StryveForms/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { formatTrpcError } from "@/lib/format-trpc-error";
import { useTRPC } from "@/utils/trpc";

import McpInstructions from "./mcp-instructions";

/** One on/off row with a plain-language explanation — the pattern every admin toggle on this tab uses. */
function SettingRow({
	description,
	label,
	checked,
	onCheckedChange,
	disabled,
}: {
	checked: boolean;
	description: string;
	disabled?: boolean;
	label: string;
	onCheckedChange: (value: boolean) => void;
}) {
	return (
		<div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
			<span className="space-y-0.5">
				<Label className="text-sm">{label}</Label>
				<p className="text-muted-foreground text-xs">{description}</p>
			</span>
			<Switch
				aria-label={label}
				checked={checked}
				disabled={disabled}
				onCheckedChange={onCheckedChange}
			/>
		</div>
	);
}

/**
 * Admin → "AI agents & MCP": the instance-wide switches for the Model
 * Context Protocol server, plus the same connect instructions regular users
 * see (minus their own token — admins test with their own personal token,
 * created in Settings → Developers like anyone else).
 */
export default function AdminMcpTab() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const settings = useQuery(trpc.instance.agent.settings.get.queryOptions());
	const publicInfo = useQuery(trpc.instance.agent.publicInfo.queryOptions());

	const update = useMutation(
		trpc.instance.agent.settings.update.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.instance.agent.settings.get.queryKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.instance.agent.publicInfo.queryKey(),
					}),
				]);
			},
		})
	);

	if (!settings.data) {
		return null;
	}

	return (
		<div className="max-w-3xl space-y-6">
			<Card className="rounded-xl">
				<CardHeader>
					<CardTitle>Agent access</CardTitle>
					<CardDescription>
						Controls whether AI agents (via MCP) or scripts (via personal API
						tokens) can reach this instance at all, and whether they can only
						read data or also change it.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<SettingRow
						checked={settings.data.mcpEnabled}
						description="Turns the MCP server on or off for the whole instance. When off, /api/mcp returns 404 and the MCP instructions are hidden from users."
						label="Enable MCP server"
						onCheckedChange={(mcpEnabled) => update.mutate({ mcpEnabled })}
					/>
					<SettingRow
						checked={settings.data.allowApiTokens}
						description="Lets users create personal API tokens (Settings → Developers) to authenticate the CLI or other HTTP clients without OAuth."
						label="Allow personal API tokens"
						onCheckedChange={(allowApiTokens) =>
							update.mutate({ allowApiTokens })
						}
					/>
					<SettingRow
						checked={settings.data.allowWriteTools}
						description="When off, every agent connection is read-only instance-wide — write tools (create/update/publish) refuse to run, even for a token with write scope."
						label="Allow write tools"
						onCheckedChange={(allowWriteTools) =>
							update.mutate({ allowWriteTools })
						}
					/>
				</CardContent>
			</Card>

			{settings.data.mcpEnabled && publicInfo.data ? (
				<McpInstructions serverUrl={publicInfo.data.serverUrl} />
			) : (
				<Card className="rounded-xl border-dashed">
					<CardContent className="py-8 text-center text-muted-foreground text-sm">
						Turn on "Enable MCP server" above to see connection instructions.
					</CardContent>
				</Card>
			)}
		</div>
	);
}
