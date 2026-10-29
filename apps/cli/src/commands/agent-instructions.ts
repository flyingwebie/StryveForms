import { parseArgs } from "node:util";

import { printJson, printLine } from "../output";

const SNIPPET = `## Using the StryveForms CLI

This project uses StryveForms. Agents should use the \`stryveforms\` CLI
(or the equivalent MCP tools, if connected over MCP) instead of guessing
at API shapes.

- Auth: \`stryveforms whoami --json\` to check you're signed in. If not,
  ask the human to run \`stryveforms login\`, or use a personal API token
  via \`STRYVEFORMS_TOKEN\`.
- Discover: \`stryveforms workspaces list --json\`, then
  \`stryveforms forms list --workspace <id> --json\`.
- Read a form: \`stryveforms forms get <formId> --json\`.
- Create a form: write a spec JSON \`{ "title": "...", "fields": [{ "blockId": "text", "name": "..." }] }\`
  then \`stryveforms forms create --workspace <id> --title "..." --file spec.json --json\`.
  New forms are always drafts.
- Edit fields: \`stryveforms forms update <formId> --fields-file fields.json --json\`.
- Publish only when asked: \`stryveforms forms publish <formId> --json\`.
  Don't publish, close, or delete anything without being asked to.
- Submissions: \`stryveforms submissions list --form <formId> --json\`,
  \`stryveforms submissions export --form <formId> --json\` for a CSV link.
- Stats: \`stryveforms stats <formId> --json\`.
- Integrations: \`stryveforms integrations types --json\` to see each type's
  data/settings fields, then \`stryveforms integrations create --form <id>
  --type <type> --file spec.json --json\`. Also: \`update\`, \`delete\`, and
  \`test\` (sends a sample payload through the real handler).
- Email notifications (including a confirmation email back to the
  respondent): \`stryveforms notifications create --form <id> --file
  notification.json --json\`, plus \`list\`, \`update\`, \`delete\`,
  \`preview\` (renders it without sending), and \`test\` (sends a real test
  email). To address the respondent's own email field, set
  \`data.send_to\` to that field's mention placeholder — see the
  stryveforms-notifications skill for the exact format.
- \`stryveforms senders list --workspace <id> --json\` lists the
  workspace's "From" identities for \`data.senderId\`.
- These all change something real — don't create, edit, delete, or
  test-send an integration or notification unless asked to.

Always pass \`--json\` — every command prints one JSON document to stdout
and uses a non-zero exit code on failure. Run \`stryveforms <command> --help\`
if unsure of a command's flags.

## Full skills

For detailed, task-specific instructions (form field types, integrations,
email notifications, submissions), install the StryveForms agent skills:

    npx skills add flyingwebie/stryveforms`;

export function agentInstructionsCommand(argv: string[]): void {
	const { values } = parseArgs({
		args: argv,
		options: { json: { type: "boolean" } },
	});
	if (values.json) {
		printJson({ snippet: SNIPPET });
		return;
	}
	printLine(SNIPPET);
}
