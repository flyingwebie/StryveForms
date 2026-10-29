---
name: stryveforms-submissions
description: List, filter, inspect, summarize and export StryveForms submissions via the CLI or MCP. Use when asked to look at form responses, answer questions about submitted data, get stats/summaries, or export to CSV.
---

# StryveForms submissions

Prerequisite: see [stryveforms-setup](../stryveforms-setup/SKILL.md) and [stryveforms-forms](../stryveforms-forms/SKILL.md) for a `formId`.

## List & filter

```bash
stryveforms submissions list --form <formId> --json
stryveforms submissions list --form <formId> --status completed --search "Ada" --json
stryveforms submissions list --form <formId> --from 2026-01-01T00:00:00Z --to 2026-02-01T00:00:00Z --json
```

(MCP: `list_submissions`.) Paginated (`--page`, default page size 20, max 100), with:

- `status`: `all` (default) / `completed` / `partial`
- `search`: free-text across every answer
- `from` / `to`: ISO datetime range

Each item includes `id`, `status`, `createdAt`, `completionTime`, and `data` (answers keyed by field id — cross-reference against `stryveforms forms get <formId>` to map ids to question names). File-answer values are signed download links.

## Get one submission

```bash
stryveforms submissions get --form <formId> <submissionId> --json
```

(MCP: `get_submission`.) Full answers for a single submission, same shape as a list item.

## Stats / summary

```bash
stryveforms stats <formId> --json
stryveforms stats <formId> --days 30 --json
```

(MCP: `get_submission_stats`.) Returns views, completion rate, average completion time, total/partial submission counts, and a per-question breakdown (choice distributions, numeric averages, a sample of recent text answers). This is the same data the Summary page shows — use it instead of manually aggregating `list_submissions` pages when asked for an overview.

## Export to CSV

```bash
stryveforms submissions export --form <formId> --json
stryveforms submissions export --form <formId> --status completed --json
```

(MCP: `export_submissions_csv_link`.) Returns a **short-lived (10 minute) signed URL** to a CSV — no auth needed to fetch that URL itself. Give the link to whoever/whatever needs the file; don't try to fetch and re-upload it yourself unless asked to. If more than 10 minutes pass, request a fresh link rather than retrying the stale one.

## Good practice

- Don't paginate through thousands of submissions to answer something `get_submission_stats` already computes — use stats first.
- Submission data can contain personal information; don't paste raw answers into a public or shared context beyond what's actually been asked for.
- Exporting doesn't require any special permission beyond read access to the form — but still only do it when asked, not speculatively.
