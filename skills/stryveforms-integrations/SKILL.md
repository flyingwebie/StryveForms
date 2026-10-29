---
name: stryveforms-integrations
description: Create, edit, delete, and test-send a StryveForms form's integrations (webhooks, Slack, Discord, Telegram, n8n, Zapier, Make, Pabbly, Activepieces, Albato) via the CLI or MCP, and inspect what's already connected. Use when asked to set up, change, remove, or test an integration/automation, or to see what a form has.
---

# StryveForms integrations

Prerequisite: see [stryveforms-setup](../stryveforms-setup/SKILL.md) and [stryveforms-forms](../stryveforms-forms/SKILL.md) for auth and finding a `formId`. For the `email` integration type specifically, use [stryveforms-notifications](../stryveforms-notifications/SKILL.md) instead — it has dedicated, typed tools with preview and test-to-self.

## Integration catalog

| `integrationId` | Name | Section |
| --- | --- | --- |
| `email` | Email notification | Notifications — see [stryveforms-notifications](../stryveforms-notifications/SKILL.md) |
| `slack` | Slack | Notifications |
| `discord` | Discord | Notifications |
| `telegram` | Telegram | Notifications |
| `webhook` | Webhook | Automation |
| `n8n` | n8n | Automation |
| `zapier` | Zapier | Automation |
| `make` | Make | Automation |
| `pabbly` | Pabbly Connect | Automation |
| `activepieces` | Activepieces | Automation |
| `albato` | Albato | Automation |

Each has a `status` (`active`/`inactive`), `data` (type-specific config, e.g. a webhook URL), an optional `logic` condition tree ("only send if…"), and `settings` (security/payload/advanced options).

**Always call `list_integration_types`/`integrations types` first** — it returns every type's `data` and `settings` field names, their value shapes, and plain-language descriptions, so you're never guessing a field name. The common fields:

- **Webhook-like** (`webhook`, `n8n`, `zapier`, `make`, `pabbly`, `activepieces`, `albato`): `data.webhook_url` (required), `data.webhook_secret` (optional HMAC signing secret), `data.webhook_headers` (optional, `"Name: value"` lines). `settings`: `auth_type` (`none`/`bearer`/`basic`/`api_key` + matching credential fields), `payload_style` (`classic`/`nested`/`flat`), `include_metadata`, `timeout_seconds`, `retry_on_failure`.
- **Slack**: `data.slack_webhook_url` (must start with `https://hooks.slack.com/`), `data.message`, the usual `include_submission_data`/`link_open_form`/`link_edit_form`/`link_edit_submission` toggles. `settings.format`: `blocks` or `simple`.
- **Discord**: `data.discord_webhook_url` (must start with `https://discord.com/api/webhooks`), same message/link toggles as Slack. `settings`: `format`, `username`, `avatar_url`, `thread_id`.
- **Telegram**: `data.chat_id`, `data.message`. `settings`: `parse_mode` (`MarkdownV2`/`HTML`/`None`), `silent`. Needs the server's `TELEGRAM_BOT_TOKEN` configured by an admin — not something you can set.

Every webhook-shaped URL is checked against an SSRF guard (rejects private-network/localhost targets) before it's saved or tested.

## Reading what's connected

```bash
stryveforms integrations list --form <formId> --json
```

(MCP: `list_integrations({ formId })`.) Returns each integration's id, catalog type, and whether it's active — **never** secrets, webhook URLs, or payload contents:

```json
[{ "id": "…", "integrationId": "slack", "name": "Slack", "status": "active", "createdAt": "…" }]
```

## Creating one

```bash
stryveforms integrations types --json   # see the data/settings fields first
echo '{"data": {"webhook_url": "https://example.com/hook"}}' > spec.json
stryveforms integrations create --form <formId> --type webhook --file spec.json --json
```

(MCP: `create_integration({ formId, integrationId: "webhook", data: { webhook_url: "…" } })`.) `spec.json`/the MCP call's body can also carry `settings` and `logic`. New integrations default to `status: "active"` — pass `--status inactive` (CLI) or `status: "inactive"` (MCP) to create one disabled.

## Editing or removing one

```bash
echo '{"data": {"webhook_secret": "new-secret"}}' > patch.json
stryveforms integrations update <id> --form <formId> --file patch.json --json
stryveforms integrations delete <id> --form <formId> --json
```

(MCP: `update_integration({ formId, id, data: {...} })`, `delete_integration({ formId, id })`.) **`update` merges** a given `data`/`settings` into what's already saved — you only need to send the keys you're changing, unlike the web UI's dialog (which always resends the whole object). Deleting can't be undone — confirm with the user first.

## Testing one

```bash
stryveforms integrations test --form <formId> --id <id> --json
# or, without saving first:
stryveforms integrations test --form <formId> --type webhook --file spec.json --json
```

(MCP: `test_integration({ formId, id })` or `test_integration({ formId, integrationId: "webhook", data: {...} })`.) Sends a realistic sample payload (built from the form's fields) through the integration's real handler, including the SSRF guard, without needing an actual submission on file. Returns `{ ok, status?, response?, error? }`.

## Permissions

Every create/update/delete/test call requires the calling user's role to have the "Manage integrations & notifications" capability in that workspace (`manage_integrations`) — the same permission the Integrations tab's UI enforces. A read-only API token, or an instance with "Allow write tools" turned off, gets a clear error instead of a partial change.
