import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@StryveForms/ui/components/tabs";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from "lucide-react";
import { useState } from "react";

import { CodeBlock } from "@/components/app/code-block";

import {
	buildMcpConnectSnippets,
	MCP_TOOL_SUMMARY,
} from "./mcp-connect-snippets";
import { SettingsSection } from "./settings-row";

const TRAILING_SLASH = /\/$/;

/**
 * Connect instructions for the MCP server: per-client config snippets, a
 * "what these tools can do" summary, and a "Test connection" button. Shown
 * (without the admin on/off switches) in both the Admin "AI agents & MCP"
 * tab and the user-facing Settings → Developers tab.
 */
export default function McpInstructions({
	serverUrl,
	token,
}: {
	serverUrl: string;
	/** A personal API token to bake into the Bearer-auth snippets. Omit to show the OAuth (no token) snippets. */
	token?: string;
}) {
	const [tab, setTab] = useState("claude-code");
	const snippets = buildMcpConnectSnippets({ serverUrl, token });

	const testConnection = useMutation({
		mutationFn: async () => {
			const headers: Record<string, string> = {};
			if (token) {
				headers.Authorization = `Bearer ${token}`;
			}
			const res = await fetch(
				`${serverUrl.replace(TRAILING_SLASH, "")}/api/mcp`,
				{
					body: JSON.stringify({
						id: 1,
						jsonrpc: "2.0",
						method: "tools/list",
					}),
					headers: { "Content-Type": "application/json", ...headers },
					method: "POST",
				}
			);
			if (res.status === 404) {
				throw new Error("MCP is turned off for this instance.");
			}
			if (res.status === 401 && !token) {
				// Expected: without a token, the server correctly asks for OAuth.
				return { ok: true, message: "Server reachable (OAuth required)." };
			}
			if (!res.ok) {
				throw new Error(`Server responded with ${res.status}.`);
			}
			return { ok: true, message: "Connected — tools are reachable." };
		},
	});

	return (
		<div className="space-y-8">
			<SettingsSection
				description={
					<>
						Paste one of these into your AI coding tool. Each one points it at
						this server's MCP endpoint —{" "}
						<code className="rounded bg-muted px-1 py-0.5 text-xs">
							{serverUrl.replace(TRAILING_SLASH, "")}/api/mcp
						</code>
						.{" "}
						{token
							? "This snippet includes your personal API token — keep it private."
							: "The agent will open a browser to sign in and approve access the first time."}
					</>
				}
				title="Connect an agent"
			>
				<div className="space-y-3">
					<Tabs onValueChange={setTab} value={tab}>
						<TabsList className="flex-wrap" variant="line">
							{snippets.map((s) => (
								<TabsTrigger key={s.id} value={s.id}>
									{s.label}
								</TabsTrigger>
							))}
						</TabsList>
						{snippets.map((s) => (
							<TabsContent className="pt-3" key={s.id} value={s.id}>
								<CodeBlock
									code={s.code}
									filename={`${s.label.toLowerCase()}.${s.language === "bash" ? "sh" : s.language}`}
									language={s.language}
								/>
							</TabsContent>
						))}
					</Tabs>

					<div className="flex items-center gap-3">
						<Button
							disabled={testConnection.isPending}
							onClick={() => testConnection.mutate()}
							variant="outline"
						>
							{testConnection.isPending ? (
								<Loader2Icon className="animate-spin" />
							) : null}
							Test connection
						</Button>
						{testConnection.isSuccess ? (
							<span className="flex items-center gap-1.5 text-sm text-success">
								<CheckCircle2Icon className="size-4" />
								{testConnection.data.message}
							</span>
						) : null}
						{testConnection.isError ? (
							<span className="flex items-center gap-1.5 text-destructive text-sm">
								<XCircleIcon className="size-4" />
								{testConnection.error.message}
							</span>
						) : null}
					</div>
				</div>
			</SettingsSection>

			<SettingsSection
				description="An agent connected over MCP can call these tools, scoped to your own workspaces and permissions. Tools that change data respect your token's read/write scope."
				title="What these tools can do"
			>
				<div className="space-y-1.5">
					{MCP_TOOL_SUMMARY.map((row) => (
						<div
							className="flex flex-col gap-1 border-border border-b py-2 text-sm last:border-b-0 sm:flex-row sm:items-baseline sm:gap-3"
							key={row.label}
						>
							<span className="w-32 shrink-0 font-medium">{row.label}</span>
							<code className="text-subtle-foreground text-xs">
								{row.tools}
							</code>
						</div>
					))}
				</div>
			</SettingsSection>

			<SettingsSection
				description="Skills are short, task-focused instructions an AI coding agent reads before using StryveForms — how to create/edit forms, wire up integrations, set up email notifications, and work with submissions, using this same CLI and MCP connection."
				title={
					<span className="flex items-center gap-2">
						Agent skills
						<Badge variant="soft">New</Badge>
					</span>
				}
			>
				<div className="space-y-3">
					<CodeBlock
						code="npx skills add flyingwebie/stryveforms"
						filename="install all skills"
						language="bash"
					/>
					<div className="grid gap-3 sm:grid-cols-3">
						<CodeBlock
							code="npx skills add flyingwebie/stryveforms --skill stryveforms-forms"
							filename="install one skill"
							language="bash"
						/>
						<CodeBlock
							code="npx skills add flyingwebie/stryveforms -g"
							filename="install globally"
							language="bash"
						/>
						<CodeBlock
							code="npx skills add flyingwebie/stryveforms -a claude-code"
							filename="for a specific agent"
							language="bash"
						/>
					</div>
				</div>
			</SettingsSection>
		</div>
	);
}
