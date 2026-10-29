import { Switch } from "@StryveForms/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { formatTrpcError } from "@/lib/format-trpc-error";
import { useTRPC } from "@/utils/trpc";

import McpInstructions from "./mcp-instructions";
import { SettingsRow } from "./settings-row";

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
		<div className="space-y-8 pb-20">
			<div>
				<SettingsRow
					description="Let AI agents connect to this instance over the Model Context Protocol."
					label="Enable MCP server"
				>
					<Switch
						aria-label="Enable MCP server"
						checked={settings.data.mcpEnabled}
						onCheckedChange={(mcpEnabled) => update.mutate({ mcpEnabled })}
					/>
				</SettingsRow>
				<SettingsRow
					description="Let members create their own API tokens for agents."
					label="Allow personal API tokens"
				>
					<Switch
						aria-label="Allow personal API tokens"
						checked={settings.data.allowApiTokens}
						onCheckedChange={(allowApiTokens) =>
							update.mutate({ allowApiTokens })
						}
					/>
				</SettingsRow>
				<SettingsRow
					description="Let connected agents create and edit forms, not just read them."
					label="Allow write tools"
				>
					<Switch
						aria-label="Allow write tools"
						checked={settings.data.allowWriteTools}
						onCheckedChange={(allowWriteTools) =>
							update.mutate({ allowWriteTools })
						}
					/>
				</SettingsRow>
			</div>

			{settings.data.mcpEnabled && publicInfo.data ? (
				<McpInstructions serverUrl={publicInfo.data.serverUrl} />
			) : (
				<p className="rounded-xl border border-dashed py-8 text-center text-muted-foreground text-sm">
					Turn on "Enable MCP server" above to see connection instructions.
				</p>
			)}
		</div>
	);
}
