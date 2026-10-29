---
name: stryveforms-setup
description: Connect an AI agent to a StryveForms instance — choose the CLI or MCP, sign in, pick a workspace, and verify the connection. Use when you're about to use StryveForms for the first time in a session, when `stryveforms` isn't installed/signed in yet, or when asked to "connect to StryveForms".
---

# StryveForms setup

StryveForms exposes the same capabilities two ways:

- **CLI** (`stryveforms`) — a terminal tool, good for scripts, CI, and any agent that can run shell commands.
- **MCP** — a Model Context Protocol server at `<instance url>/api/mcp`, good for agents that speak MCP directly (Claude Code, Claude Desktop, Cursor, VS Code / Copilot, Codex, Windsurf).

Both are backed by the same service layer and the same permissions. Prefer the one your host already supports; fall back to the other.

## Choosing a path

1. If an MCP connection to `stryveforms` is already configured for this session (check your available tools/servers), use its tools directly — skip to [stryveforms-forms](../stryveforms-forms/SKILL.md) etc.
2. Otherwise, check if the `stryveforms` CLI is available: `stryveforms --version`.
3. If neither is set up, ask the user which they'd prefer, or default to the CLI (it's usually faster to add to a shell session).

## CLI setup

```bash
# install (once published), or from the repo during development:
bunx stryveforms --help

# sign in — opens a browser for the device flow
stryveforms login

# or, if device login isn't enabled on this instance, paste a personal API token
# (the user creates one in Settings → Developers)
stryveforms login --token sfpat_…

# verify
stryveforms whoami --json
```

Non-interactively (CI, or when the human isn't present to approve a browser popup), skip `login` and set:

```bash
export STRYVEFORMS_URL=https://your-instance.example.com
export STRYVEFORMS_TOKEN=sfpat_…
```

Every `stryveforms` command also accepts `--url` and `--token` flags that override the env vars and the saved login.

## MCP setup

Ask the user to add the server in their client (exact steps vary by client — see **Admin → AI agents & MCP** or **Settings → Developers** in the StryveForms web app for copy-paste snippets per client). The short version for Claude Code:

```bash
claude mcp add --transport http stryveforms https://your-instance.example.com/api/mcp
```

This opens a browser once to sign in and approve access (OAuth). No token needed in the config for OAuth-capable clients.

## Always: pick a workspace

StryveForms is multi-workspace. Before doing anything else, list workspaces and get a `workspaceId` — almost every other operation needs one:

```bash
stryveforms workspaces list --json
```

(MCP: call the `list_workspaces` tool.)

## Verify before relying on it

```bash
stryveforms whoami --json
```

If this fails with an auth error, stop and tell the user rather than guessing — don't attempt `login` repeatedly or try to work around auth failures.

## `--json` everywhere

Every CLI command supports `--json`: pass it. It prints one JSON document to stdout and uses a non-zero exit code on failure — reliable to parse and to check. Without it, output is a human-friendly table meant for people, not agents.

## Next

- [stryveforms-forms](../stryveforms-forms/SKILL.md) — create and edit forms
- [stryveforms-integrations](../stryveforms-integrations/SKILL.md) — webhooks, Slack, Discord, etc.
- [stryveforms-notifications](../stryveforms-notifications/SKILL.md) — email notifications
- [stryveforms-submissions](../stryveforms-submissions/SKILL.md) — list, filter, export responses
