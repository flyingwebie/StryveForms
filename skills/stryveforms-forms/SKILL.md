---
name: stryveforms-forms
description: Create and edit StryveForms forms — fields, widths, pages, logic, and publishing — via the CLI or MCP. Use when asked to build a form, add/change/remove form fields or questions, publish or unpublish a form, or get a form's share/embed link.
---

# StryveForms forms

Prerequisite: you're signed in and have a `workspaceId` — see [stryveforms-setup](../stryveforms-setup/SKILL.md).

## Discover before you change anything

```bash
stryveforms forms list --workspace <workspaceId> --json
stryveforms forms get <formId> --json
```

(MCP: `list_forms`, `get_form`.) `get_form` returns the current fields, settings and share URL — read it before editing so you don't clobber fields you're not meant to touch.

## Creating a form

Write a spec file, then create:

```json title="spec.json"
{
  "title": "Event registration",
  "fields": [
    { "blockId": "text", "name": "Full name", "required": true },
    { "blockId": "email", "name": "Email", "required": true },
    { "blockId": "select", "name": "Ticket type", "options": ["General", "VIP"] }
  ]
}
```

```bash
stryveforms forms create --workspace <workspaceId> --title "Event registration" --file spec.json --json
```

(MCP: `create_form` with the same shape.) The full field-type reference — every `blockId`, what it's for, and which options it supports — is in [references/field-types.md](references/field-types.md). Common ones: `text`, `rich_text`, `email`, `phone_number`, `url`, `number`, `date`, `select`, `radio`, `multi_select`, `checkbox`, `toggle_switch`, `rating`, `scale`, `slider`, `matrix`, `files`, `signature`, plus layout blocks `nf-page-break` (classic-layout pages), `nf-divider`, `nf-text`.

**A field's `id` is generated automatically** (not from its label) — don't invent one. When you later edit fields, read the existing `id`s back from `get_form` first so you can keep, reorder, or drop specific fields precisely.

**New forms always start as drafts.** Never publish without being asked to.

## Editing fields

Editing a form's fields means giving the **entire new field list** (not a single-field patch):

```bash
stryveforms forms get <formId> --json   # see current fields, keep their ids/order in mind
# edit fields.json based on what you want the new field list to be
stryveforms forms update <formId> --fields-file fields.json --json
```

(MCP: `get_form` then `update_form_fields`.) This replaces the whole field list — include every field you want to keep, not just the ones changing. A version snapshot is kept automatically, so edits can be undone from the editor's history.

## Editing settings

A small, safe subset — not the full editor schema:

```json title="settings.json"
{ "submitButtonText": "Register", "maxSubmissionsCount": 200 }
```

```bash
stryveforms forms update <formId> --settings-file settings.json --json
```

(MCP: `update_form_settings`.) Supported keys: `title`, `submitButtonText`, `closesAt` (ISO datetime or `null`), `maxSubmissionsCount`, `redirectUrl`, `useCaptcha`. For anything else (branding, theme, presentation style, custom CSS…), tell the user to use the form editor's UI — it's not exposed here.

## Publishing

```bash
stryveforms forms publish <formId>     # visibility: public
stryveforms forms unpublish <formId>   # visibility: draft
stryveforms forms close <formId>       # visibility: closed — stops new responses
```

(MCP: `set_form_visibility` with `"public"` / `"draft"` / `"closed"`.)

**Only publish, unpublish, or close a form when the user explicitly asks.** Draft first; a human decides when it goes live.

## Share / embed link

`forms get` and `forms create` both return a `shareUrl`. That's the link to give respondents. Embedding on a website is a copy-paste snippet from the form's **Share** tab in the web UI — not something this CLI/MCP surface generates.

## Logic, presentation style, brand

Conditional logic (show/hide/require fields based on other answers), the classic-vs-focused presentation style, and brand/theme settings aren't editable through the CLI or MCP today. Point the user at the form editor for those, or ask whether they want this skill extended.
