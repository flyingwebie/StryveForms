---
name: stryveforms-notifications
description: Create, edit, preview, delete, and test-send a StryveForms form's email notifications (including a confirmation email back to the respondent) via the CLI or MCP, and inspect what's already set up. Use when asked to set up, change, remove, preview, or test an email notification.
---

# StryveForms email notifications

Prerequisite: see [stryveforms-setup](../stryveforms-setup/SKILL.md) and [stryveforms-forms](../stryveforms-forms/SKILL.md) for auth and finding a `formId`.

An email notification is a special integration (`integrationId: "email"`) with its own tab in the form editor and its own dedicated tools here — distinct from the generic integrations covered in [stryveforms-integrations](../stryveforms-integrations/SKILL.md) (Slack, webhooks, etc.).

## How it's modeled

- **Recipients** (`data.send_to`) — one or more addresses, which can include `@`-mentions of form field answers (e.g. notify whoever typed their own email into the form). A mention is an opaque placeholder: `<span mention="true" mention-field-id="FIELD_ID" mention-field-name="FIELD_NAME">FIELD_NAME</span>` — call `get_form` first to find the field's id, then copy this through exactly (never reword or strip the attributes).
- **Sender** (`data.senderId`, `data.sender_name`, `data.reply_to`) — resolved from the workspace's configured senders (`list_senders`/`senders list`, managed in Settings → Email sending), or overridden per-notification. A free-text `sender_name`/`reply_to` wins over whatever `senderId` resolves to.
- **Subject & body** (`data.subject`, `data.email_content`) — `email_content` is rich-text HTML; it supports the same `@`-mention placeholders as `send_to`.
- **Submission data** (`data.include_submission_data`, `data.include_hidden_fields_submission_data`) and an edit-submission link (`data.link_edit_submission`, only if the form allows editable submissions).
- **PDF attachment** (`data.attach_pdf_template_id`) — optionally attaches a PDF generated from a PDF template.
- **Condition** (`logic`) — an optional "only send if…" rule, same shape as other integrations.

A respondent confirmation email is just a notification whose `send_to` targets the respondent's own email field via that mention placeholder, instead of (or in addition to) a fixed address.

## Reading what's set up

```bash
stryveforms notifications list --form <formId> --json
```

(MCP: `list_email_notifications({ formId })`.) Unlike `list_integrations`, this returns the **full** configuration — recipients, subject, body, sender, attachment, condition — since that's the point of these dedicated tools.

## Creating one

```bash
cat > notification.json <<'EOF'
{
  "data": {
    "send_to": "<span mention=\"true\" mention-field-id=\"email1\" mention-field-name=\"Email\">Email</span>",
    "subject": "Thanks for your submission!",
    "email_content": "<p>We received your response and will be in touch.</p>"
  }
}
EOF
stryveforms notifications create --form <formId> --file notification.json --json
```

(MCP: `create_email_notification({ formId, data: {...} })`.) Defaults to `status: "active"` — pass `--status inactive` to create one disabled. **Preview before creating** (see below) so the user can see what it'll actually look like.

## Editing or removing one

```bash
echo '{"data": {"subject": "New subject"}}' > patch.json
stryveforms notifications update <id> --form <formId> --file patch.json --json
stryveforms notifications delete <id> --form <formId> --json
```

(MCP: `update_email_notification({ formId, id, data: {...} })`, `delete_email_notification({ formId, id })`.) **`update` merges** a given `data` into what's already saved — send only the keys you're changing. Deleting can't be undone — confirm with the user first.

## Previewing and testing

```bash
echo '{"send_to": "owner@example.com", "subject": "Hello"}' > data.json
stryveforms notifications preview --form <formId> --file data.json --json
stryveforms notifications test --form <formId> --file data.json --json
```

(MCP: `preview_email_notification({ formId, data: {...} })`, `send_test_email_notification({ formId, data: {...}, to? })`.) `preview`/`test`'s `--file` (and the MCP `data` argument) is the **plain data object** — no `{ "data": ... }` wrapper, unlike `create`/`update`. `preview` renders the real template against the form's latest submission (or sample data if it has none) and returns the subject, resolved from/reply-to, recipients, a plain-text excerpt, and the full HTML — no email is sent. `test` sends a real email, defaulting to the signed-in user's own address (pass `--to`/`to` to send elsewhere) — confirm with the user before calling it, since it delivers a real message. Both work on an unsaved draft or an existing notification's data.

## Senders

```bash
stryveforms senders list --workspace <id> --json
```

(MCP: `list_senders({ workspaceId })`.) Lists the workspace's configured "From" identities (`id`, `name`, `address`, `replyTo`) — pick an `id` for `data.senderId`.

## Permissions

Every create/update/delete/test call requires the calling user's role to have the "Manage integrations & notifications" capability in that workspace (`manage_integrations`) — the same permission the Notifications tab's UI enforces. Listing and previewing only need view access.
