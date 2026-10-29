#!/usr/bin/env bun
/**
 * `stryveforms` — the StryveForms CLI, built for both humans and AI agents
 * (every command supports `--json` for stable, scriptable output). Talks to
 * the same `instance.agent.*` tRPC procedures the MCP server's tools call
 * (packages/api/src/services/agent/tools.ts) — one service layer, two
 * front-ends.
 */
import { agentInstructionsCommand } from "./commands/agent-instructions";
import { backupCommand } from "./commands/backup";
import { exportCommand } from "./commands/export";
import { formsCommand } from "./commands/forms";
import { integrationsCommand } from "./commands/integrations";
import { loginCommand } from "./commands/login";
import { logoutCommand } from "./commands/logout";
import { notificationsCommand } from "./commands/notifications";
import { sendersCommand } from "./commands/senders";
import { statsCommand } from "./commands/stats";
import { submissionsCommand } from "./commands/submissions";
import { whoamiCommand } from "./commands/whoami";
import { workspacesCommand } from "./commands/workspaces";
import { configPath } from "./config";
import { printLine } from "./output";

const VERSION = "0.1.0";

const HELP = `stryveforms — command-line access to your StryveForms instance

Usage: stryveforms <command> [subcommand] [options]

Commands:
  login [--token <token>] [--url <url>]   Sign in (device flow, or paste a personal API token)
  logout                                   Forget the saved login
  whoami                                   Show who you're signed in as
  workspaces list                          List your workspaces
  forms list --workspace <id>              List forms in a workspace
  forms get <formId>                       Show one form's fields and settings
  forms create --workspace <id> --title <t> --file <spec.json>
                                            Create a draft form from a field spec
  forms update <formId> [--fields-file f.json] [--settings-file s.json]
                                            Update a form's fields and/or settings
  forms publish|unpublish|close <formId>   Change a form's visibility
  integrations types                       List integration types and their data/settings fields
  integrations list --form <formId>        List a form's integrations
  integrations create --form <id> --type <type> [--file spec.json]
                                            Create an integration (webhook, Slack, n8n, …)
  integrations update <id> --form <id> [--file patch.json]
                                            Patch an integration (merges into saved data/settings)
  integrations delete <id> --form <formId> Delete an integration
  integrations test --form <id> (--id <id> | --type <type>) [--file spec.json]
                                            Send a sample payload through an integration
  notifications list --form <formId>       List a form's email notifications
  notifications create --form <id> --file notification.json
                                            Create an email notification
  notifications update <id> --form <id> [--file notification.json]
                                            Patch an email notification
  notifications delete <id> --form <formId> Delete an email notification
  notifications preview --form <id> --file data.json [--dark]
                                            Render an email notification preview
  notifications test --form <id> --file data.json [--to email]
                                            Send a real test email
  senders list --workspace <id>            List the workspace's "From" sender identities
  submissions list --form <formId>         List a form's submissions
  submissions get --form <formId> <id>     Show one submission
  submissions export --form <formId>       Get a signed CSV download link
  stats <formId> [--days N]                Submission summary stats
  export --workspace <id> [--no-uploads] [--include-secrets] [--passphrase-env VAR] [--out file]
                                            Export a workspace to a .stryve.zip file
  backup [--destination <id>] [--out file] [--passphrase-env VAR]
                                            Take a full instance backup (instance admin)
  agent-instructions                       Print a snippet for AI agents using this CLI

Options:
  --json              Machine-readable output (every command supports this)
  --url <url>         Server URL (overrides STRYVEFORMS_URL and the saved config)
  --token <token>      Bearer token (overrides STRYVEFORMS_TOKEN and the saved config)
  -h, --help           Show help
  -v, --version        Show version

Config is saved at ${configPath()}. Env vars: STRYVEFORMS_URL, STRYVEFORMS_TOKEN.`;

async function main() {
	const [command, ...rest] = process.argv.slice(2);

	if (!command || command === "-h" || command === "--help") {
		printLine(HELP);
		return;
	}
	if (command === "-v" || command === "--version") {
		printLine(VERSION);
		return;
	}

	switch (command) {
		case "login":
			await loginCommand(rest);
			return;
		case "logout":
			logoutCommand(rest);
			return;
		case "whoami":
			await whoamiCommand(rest);
			return;
		case "workspaces":
			await workspacesCommand(rest);
			return;
		case "forms":
			await formsCommand(rest);
			return;
		case "integrations":
			await integrationsCommand(rest);
			return;
		case "notifications":
			await notificationsCommand(rest);
			return;
		case "senders":
			await sendersCommand(rest);
			return;
		case "submissions":
			await submissionsCommand(rest);
			return;
		case "stats":
			await statsCommand(rest);
			return;
		case "agent-instructions":
			agentInstructionsCommand(rest);
			return;
		case "export":
			await exportCommand(rest);
			return;
		case "backup":
			await backupCommand(rest);
			return;
		default:
			process.stderr.write(`Unknown command "${command}".\n\n${HELP}\n`);
			process.exit(1);
	}
}

main().catch((error: unknown) => {
	process.stderr.write(
		`Error: ${error instanceof Error ? error.message : String(error)}\n`
	);
	process.exit(1);
});
