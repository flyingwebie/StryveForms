/**
 * Copy-paste config snippets for connecting an MCP client to this instance's
 * `/api/mcp` endpoint. Shared by the admin "AI agents & MCP" tab and the
 * user-facing Settings → Developers tab — same snippets, the admin tab just
 * also shows the on/off switches.
 *
 * Every client here supports the standard OAuth 2.1 discovery flow (no token
 * needed in the config — the client opens a browser to sign in and consent),
 * so that's the default. A personal API token is the fallback for clients
 * that don't speak OAuth yet, or for quick scripting.
 */
export interface McpConnectSnippet {
	code: string;
	id: string;
	label: string;
	language: string;
}

/** `https://forms.example.com/api/mcp` → `stryveforms` is a friendly, stable server name every snippet reuses. */
const SERVER_NAME = "stryveforms";
const TRAILING_SLASH = /\/$/;

export function buildMcpConnectSnippets(input: {
	serverUrl: string;
	/** When given, every snippet uses a Bearer token instead of OAuth. */
	token?: string;
}): McpConnectSnippet[] {
	const mcpUrl = `${input.serverUrl.replace(TRAILING_SLASH, "")}/api/mcp`;
	const bearer = input.token;

	if (bearer) {
		return [
			{
				code: `claude mcp add --transport http ${SERVER_NAME} ${mcpUrl} --header "Authorization: Bearer ${bearer}"`,
				id: "claude-code",
				label: "Claude Code",
				language: "bash",
			},
			{
				code: JSON.stringify(
					{
						mcpServers: {
							[SERVER_NAME]: {
								type: "http",
								url: mcpUrl,
								headers: { Authorization: `Bearer ${bearer}` },
							},
						},
					},
					null,
					2
				),
				id: "claude-desktop",
				label: "Claude Desktop",
				language: "json",
			},
			{
				code: JSON.stringify(
					{
						mcpServers: {
							[SERVER_NAME]: {
								url: mcpUrl,
								headers: { Authorization: `Bearer ${bearer}` },
							},
						},
					},
					null,
					2
				),
				id: "cursor",
				label: "Cursor",
				language: "json",
			},
			{
				code: JSON.stringify(
					{
						servers: {
							[SERVER_NAME]: {
								type: "http",
								url: mcpUrl,
								headers: { Authorization: `Bearer ${bearer}` },
							},
						},
					},
					null,
					2
				),
				id: "vscode",
				label: "VS Code / Copilot",
				language: "json",
			},
			{
				code: `[mcp_servers.${SERVER_NAME}]\nurl = "${mcpUrl}"\nheaders = { Authorization = "Bearer ${bearer}" }`,
				id: "codex",
				label: "Codex",
				language: "toml",
			},
			{
				code: JSON.stringify(
					{
						mcpServers: {
							[SERVER_NAME]: {
								serverUrl: mcpUrl,
								headers: { Authorization: `Bearer ${bearer}` },
							},
						},
					},
					null,
					2
				),
				id: "windsurf",
				label: "Windsurf",
				language: "json",
			},
			{
				code: JSON.stringify(
					{
						transport: "http",
						url: mcpUrl,
						headers: { Authorization: `Bearer ${bearer}` },
					},
					null,
					2
				),
				id: "generic",
				label: "Generic JSON",
				language: "json",
			},
		];
	}

	return [
		{
			code: `claude mcp add --transport http ${SERVER_NAME} ${mcpUrl}`,
			id: "claude-code",
			label: "Claude Code",
			language: "bash",
		},
		{
			code: JSON.stringify(
				{ mcpServers: { [SERVER_NAME]: { type: "http", url: mcpUrl } } },
				null,
				2
			),
			id: "claude-desktop",
			label: "Claude Desktop",
			language: "json",
		},
		{
			code: JSON.stringify(
				{ mcpServers: { [SERVER_NAME]: { url: mcpUrl } } },
				null,
				2
			),
			id: "cursor",
			label: "Cursor",
			language: "json",
		},
		{
			code: JSON.stringify(
				{ servers: { [SERVER_NAME]: { type: "http", url: mcpUrl } } },
				null,
				2
			),
			id: "vscode",
			label: "VS Code / Copilot",
			language: "json",
		},
		{
			code: `[mcp_servers.${SERVER_NAME}]\nurl = "${mcpUrl}"`,
			id: "codex",
			label: "Codex",
			language: "toml",
		},
		{
			code: JSON.stringify(
				{ mcpServers: { [SERVER_NAME]: { serverUrl: mcpUrl } } },
				null,
				2
			),
			id: "windsurf",
			label: "Windsurf",
			language: "json",
		},
		{
			code: JSON.stringify({ transport: "http", url: mcpUrl }, null, 2),
			id: "generic",
			label: "Generic JSON (OAuth)",
			language: "json",
		},
	];
}

/** What the connected tools can actually do — shown under the snippets. */
export const MCP_TOOL_SUMMARY: ReadonlyArray<{
	label: string;
	tools: string;
}> = [
	{ label: "Workspaces", tools: "list_workspaces" },
	{
		label: "Forms",
		tools:
			"list_forms, get_form, create_form, update_form_fields, update_form_settings, set_form_visibility",
	},
	{
		label: "Submissions",
		tools:
			"list_submissions, get_submission, get_submission_stats, export_submissions_csv_link",
	},
	{
		label: "Integrations",
		tools:
			"list_integrations, list_integration_types, create_integration, update_integration, delete_integration, test_integration",
	},
	{
		label: "Email notifications",
		tools:
			"list_email_notifications, create_email_notification, update_email_notification, delete_email_notification, preview_email_notification, send_test_email_notification",
	},
	{ label: "Senders", tools: "list_senders" },
];
