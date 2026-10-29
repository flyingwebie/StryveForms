# Demo data & docs screenshots

Two scripts build everything the fumadocs screenshots need: a realistic demo
workspace ("**Acme Studio**", owned by the `tester@example.com` account) and
a full set of light/dark screenshots of the app driven from that workspace.

Neither script touches your own workspace(s), forms, or AI provider key —
see "Why it's safe" below.

## 1. Seed the demo data

File: `apps/server/scripts/demo/seed-demo.ts` (lives under `apps/server`, not
here, so its `@StryveForms/db` / `@StryveForms/api/*` / `@StryveForms/forms/*`
imports resolve — those packages are only linked into `apps/server/node_modules`
and `apps/web/node_modules`, not the repo root).

```sh
cd apps/server
bun run scripts/demo/seed-demo.ts
```

Requires the dev API server's usual environment (reads `apps/server/.env` via
`varlock/auto-load`, the same way the real server does) and a `tester@example.com`
account that has already logged in once.

What it creates, all inside one new workspace called **Acme Studio**:

- A generated SVG logo (light + dark) and brand colour.
- 6 forms — Contact Us, Event Registration, Customer NPS Survey, Job
  Application, Booking Request, Product Feedback — covering classic and
  focused styles, pages, logic, a computed variable, hidden+prefilled
  fields, and option/question images.
- Folders (Support, Events, Hiring) with icons and colours.
- ~35–80 realistic submissions per form, spread over the last ~60 days, plus
  page-view rows so Analytics has something to chart.
- A webhook integration (pointed at `https://example.com/hook` — never
  triggered by the seed script itself) and several email notifications,
  including a respondent-confirmation email.
- A PDF template (on Job Application) with auto-generated zones.
- Two saved custom templates.
- Two extra demo members with obviously fake emails
  (`maya@acme.example`, `ravi@acme.example`), at different roles.
- A fake, **encrypted** AI credential (`sk-demo-not-a-real-key-…`) so the AI
  screens show the "connected" state — never your real key.
- Two AI chat transcripts, inserted directly (no real provider calls).

It's **idempotent**: re-running it deletes the previous "Acme Studio"
workspace (cascades to everything above) and rebuilds it from scratch. The
two demo users are matched by email and reused, not re-created.

It also writes `scripts/demo/manifest.json` (workspace id, form ids/slugs,
PDF template id) for the screenshot script to read — regenerated every run.

## 2. Capture screenshots

File: `scripts/demo/screenshots.ts` (here, with its own `package.json` — see
"Why a separate package.json" below).

```sh
cd scripts/demo
bun install        # first time only
bun screenshots.ts
```

Requires: the dev servers running (web on :3002, API on :3000), the demo
workspace already seeded (step 1), and a system Google Chrome at
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (same
convention the rest of this repo's Playwright scripts use).

It logs in as the tester, points the browser's active-workspace selection at
Acme Studio, then walks every screen — dashboard, form editor (classic +
focused), sharing, submissions, analytics, email notifications, integrations,
PDF templates, AI assistant, settings, admin, import, and a couple of public
form pages — capturing each one in **light and dark** (plus a couple of
390×844 mobile shots of public forms), to:

```
apps/fumadocs/public/screenshots/<section>/<name>-{light,dark}.png
```

It also strips the TanStack Router/Query devtools toggles before every
capture (they're dev-only floating buttons bottom-left/right) — done by
hiding any fixed-position, very-high-z-index element, not by a specific
class name, since those are regenerated per build.

Re-running it just overwrites the same files, so it's safe to re-run after
a UI change to refresh the screenshots.

## Why it's safe

- **Your own data is never touched.** The seed script only ever creates or
  deletes rows scoped to a workspace literally named "Acme Studio" — it
  never reads, modifies, or deletes "Test's workspace" or any other
  workspace.
- **No real AI calls.** The seeded AI credential is a fake string, encrypted
  the same way a real key would be, only so the UI renders its "configured"
  state. The two AI chat transcripts are inserted directly as rows, not
  produced by calling a model.
- **The webhook never fires on its own.** `https://example.com/hook` is only
  *configured*; nothing in either script sends it a request. The Integration
  page's own "Send test" button would, if you clicked it by hand — the
  scripts never do.
- **The active workspace shown in a browser is client-only.** It's a
  `localStorage` key (`stryveforms.currentWorkspaceId`, see
  `apps/web/src/lib/workspace.ts`), never written to the database — so
  there's nothing to "restore" server-side after switching into Acme Studio
  for screenshots. Your own browser's choice of workspace is a separate
  `localStorage` entry on your own machine and is never touched by these
  scripts (which drive a disposable, isolated Playwright browser profile).

## Why a separate `package.json`

`screenshots.ts` only needs `playwright-core`, which isn't a dependency of
any app in this monorepo yet. Rather than add it to the root `package.json`
(and touch the shared `bun.lock`, which every other engineer's scripts also
touch), this folder has its own tiny `package.json` + lockfile, installed
independently with `bun install` run from inside `scripts/demo/`. It is not
part of the root Bun workspace.

`seed-demo.ts` doesn't have this problem — it already needs `@StryveForms/db`
etc., so it lives inside `apps/server` where those are already linked.
