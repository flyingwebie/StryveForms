<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/stryveforms-logo-dark.svg">
    <img src="apps/web/public/brand/stryveforms-logo.svg" alt="StryveForms" height="48">
  </picture>
</p>

<p align="center">
  <strong>The self-hosted, white-label form builder.</strong><br>
  Build forms, share or embed them, and collect answers — no submission limits, no paywalls, your infrastructure.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-6d28d9"></a>
  <a href="apps/fumadocs/content/docs/self-hosting.mdx"><img alt="Self-hostable" src="https://img.shields.io/badge/self--hostable-docker%20compose-8B5CF6"></a>
  <a href="apps/fumadocs/content/docs/index.mdx"><img alt="Docs" src="https://img.shields.io/badge/docs-fumadocs-4338CA"></a>
  <a href="#tech-stack"><img alt="Stack: Bun, TypeScript, Postgres" src="https://img.shields.io/badge/stack-bun%20%C2%B7%20typescript%20%C2%B7%20postgres-27272a"></a>
  <a href="CONTRIBUTING.md"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-18181b"></a>
</p>

<p align="center">
  <a href="apps/fumadocs/content/docs/index.mdx">Docs</a> ·
  <a href="apps/fumadocs/content/docs/self-hosting.mdx">Self-host</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="https://github.com/flyingwebie/stryveforms/discussions">Discussions</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/hero-dark.png">
    <img src=".github/assets/hero-light.png" alt="StryveForms form editor" width="100%">
  </picture>
</p>

## Why StryveForms

Typeform-grade form building shouldn't require a monthly bill per seat, or trust in someone else's
server for every answer you collect. StryveForms is a complete, TypeScript rebuild of
[OpnForm](https://github.com/OpnForm/OpnForm) — same data model, so your existing forms migrate
over — built to be **self-hosted and white-labeled from the first screen**: your name, your logo,
your colours, running on infrastructure you control.

- **No limits, ever.** Unlimited forms, fields and submissions — it's your database.
- **White-label by default.** An instance looks like *your* product, not "StryveForms with a logo
  pasted on" — see [Brand & white-label](apps/fumadocs/content/docs/brand.mdx).
- **AGPL-3.0, forever.** No "enterprise" fork holding features back behind a paywall.
- **Built for AI agents too**, not just people — an MCP server and CLI ship in the box.

## Features

### Visual editor

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/feature-editor-dark.png">
  <img src=".github/assets/feature-editor-light.png" alt="Drag-and-drop form editor" width="100%">
</picture>

Drag fields onto a live canvas from a palette of 25+ question types (text, email, phone, rich text,
dates, dropdowns, choices, ratings, matrices, file uploads, signatures, barcode/QR scanning, and
layout blocks), resize them to sit side by side (full, ¾, ⅔, ½, ⅓, ¼), and reorder with your mouse.
Conditional logic, formulas (38 functions) and `@`-mention answers live in the same panel. Undo/redo
and keyboard shortcuts included.

### Classic or Focused

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/feature-public-forms-dark.png">
  <img src=".github/assets/feature-public-forms-light.png" alt="Classic and Focused public form presentations" width="100%">
</picture>

Every form can present as **Classic** (every question laid out on the page, like a document) or
**Focused** (one question at a time, Typeform-style, with a full-bleed cover image). Either way:
five themes, your own colours and fonts, dark mode, right-to-left layouts and custom CSS. Password
protection, closing dates, submission limits, captcha (hCaptcha, reCAPTCHA, Turnstile), and editable
or partial submissions are all built in.

### Submissions & analytics

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/feature-submissions-dark.png">
  <img src=".github/assets/feature-submissions-light.png" alt="Submissions table and analytics" width="100%">
</picture>

Search, filter and export every submission to CSV. Built-in analytics track views, completion rate,
average time and a per-question breakdown — no extra tool to wire up.

### Email notifications with live preview

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/feature-notifications-dark.png">
  <img src=".github/assets/feature-notifications-light.png" alt="Email notification editor with live preview" width="100%">
</picture>

Design the notification email with a rich-text editor (TipTap), insert any field as an `@`-mention,
and watch the live preview re-render as you type — including a respondent confirmation email. Send
a real test to yourself before it goes near anyone else. Runs on React Email + your own SMTP.

### Integrations & PDF templates

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/feature-integrations-dark.png">
  <img src=".github/assets/feature-integrations-light.png" alt="Integrations list and PDF template editor" width="100%">
</picture>

Slack, Discord, Telegram, signed webhooks, n8n, Zapier, Make, Pabbly Connect and Activepieces — plus
a visual PDF template editor: upload your own PDF or start from scratch, place answer/text/image/
signature zones, and generate a filled PDF for every submission.

### Built for AI agents

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/feature-ai-agents-dark.png">
  <img src=".github/assets/feature-ai-agents-light.png" alt="In-app AI assistant and CLI for AI agents" width="100%">
</picture>

The in-app assistant (bring your own OpenAI, Anthropic, Gemini, OpenRouter or Ollama key) builds and
edits forms from a plain description, or answers questions about a form's responses. The same
actions are exposed over an [MCP server](apps/fumadocs/content/docs/mcp-server.mdx) — so Claude
Code, Cursor, VS Code/Copilot, Codex or Windsurf can list, create, edit and publish forms, scoped to
real workspace permissions — and a scriptable [`stryveforms` CLI](apps/fumadocs/content/docs/cli.mdx)
for humans and CI. [Agent skills](apps/fumadocs/content/docs/agent-skills.mdx) add task-specific
instructions on top:

```bash
npx skills add flyingwebie/stryveforms
```

### …and more

Coloured folders and bulk actions, custom templates, a share dialog (QR code, pre-fill links, social
sharing, embed widget), workspaces with admin/editor/read-only members, and an import tool that
brings forms, submissions, files and integrations over from OpnForm or JotForm with a full review
before anything is copied.

## Self-host in minutes

StryveForms is three pieces: a **web** app (TanStack Start, public, port `3002`), a **server** API
(Hono + tRPC, private, port `3000`) and **PostgreSQL**. The web app proxies `/api` and `/trpc` to the
server, so only `web` needs a public domain.

**Docker Compose** (the fastest path on your own VPS):

```bash
git clone https://github.com/flyingwebie/stryveforms.git
cd stryveforms
docker compose up -d --build
```

See the [self-hosting guide](apps/fumadocs/content/docs/self-hosting.mdx) for every setting (S3
storage, SMTP, captcha, reverse proxies).

**One-click-ish platforms** — guides for each, including environment variables and volumes:

| Platform | Guide |
| --- | --- |
| Coolify (Docker Compose) | [Coolify — Docker Compose](apps/fumadocs/content/docs/deployment/coolify-docker-compose.mdx) |
| Coolify (Railpack) | [Coolify — Railpack](apps/fumadocs/content/docs/deployment/coolify-railpack.mdx) |
| Railway | [Railway](apps/fumadocs/content/docs/deployment/railway.mdx) |
| Dokploy, CapRover, Render, Fly.io, plain VPS | [Other platforms](apps/fumadocs/content/docs/deployment/other-platforms.mdx) |

Start with the [Deployment overview](apps/fumadocs/content/docs/deployment/overview.mdx) for the
architecture and the full environment-variable reference shared by every platform guide.

The first visit runs **onboarding**: create the administrator account, set your branding (name,
logo, colour), and choose whether people can sign up. Without `SMTP_HOST`, emails are printed to the
API server's log instead of sent.

## Migrate from OpnForm or JotForm

Open **Settings → Import** and pick a source:

- **OpnForm** — create an access token (Settings → Access Tokens) with `forms-read`,
  `workspaces-read`, `workspace-users-read` and `manage-integrations`, then paste it (Cloud or your
  own self-hosted address). See [Migrating from OpnForm](apps/fumadocs/content/docs/migrating-from-opnform.mdx).
- **JotForm** (US, EU, HIPAA, Enterprise) — create an API key (Settings → API, Read access) and
  paste it; the region is detected automatically. See [Migrating from JotForm](apps/fumadocs/content/docs/migrating-from-jotform.mdx).

Either way, **Review import** shows exactly what will be created or updated — fields, submissions,
files, integrations — before anything starts, and it's safe to re-run without creating duplicates.

## Tech stack

| Part | Technology |
| --- | --- |
| Web app (`apps/web`) | React 19, TanStack Start/Router/Query, Tailwind v4, shadcn/ui (Base UI), TipTap |
| API (`apps/server`) | Bun, Hono, tRPC, Better Auth |
| Database (`packages/db`) | PostgreSQL, Drizzle ORM |
| Shared form logic (`packages/forms`) | Field catalogue, conditional logic, validation, mentions, formulas |
| Emails (`packages/emails`) | React Email + Nodemailer |
| Importers (`packages/opnform-import`, `packages/jotform-import`) | OpnForm and JotForm API clients and data mapping |
| API layer (`packages/api`) | tRPC routers, submission pipeline, integrations, storage (disk or S3) |
| Docs (`apps/fumadocs`) | Fumadocs |

## Local development

Requirements: [Bun](https://bun.sh) 1.3+ and Docker (for a local PostgreSQL only).

```bash
git clone https://github.com/flyingwebie/stryveforms.git
cd stryveforms
bun install                                   # also generates typed env files via Varlock
cp apps/server/.env.example apps/server/.env  # edit BETTER_AUTH_SECRET at least
cp apps/web/.env.example apps/web/.env
bun run db:start                              # PostgreSQL in Docker
bun run db:push                               # create tables from the current schema
bun run dev                                   # http://localhost:3002 (API behind it on :3000)
```

| Command | What it does |
| --- | --- |
| `bun run dev` | Run web + server together |
| `bun run build` | Build all apps |
| `bun run check` | Lint + type-check the whole workspace |
| `bunx ultracite check` / `fix` | Lint and format ([Ultracite](https://ultracite.dev), zero-config Biome) |
| `bun test` (inside a package) | Unit tests — `packages/forms`, `packages/opnform-import`, `packages/jotform-import` |
| `bun run db:studio` | Drizzle Studio, a GUI for the local database |
| `bun run docker:up` | Build and start the full Docker Compose stack |

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full repo map, coding standards and PR checklist.

## Roadmap

Nothing here is promised on a date — just where the project is headed:

- Workspace backup & export (in design)
- A localized UI (translations aren't wired up yet — see [CONTRIBUTING.md](CONTRIBUTING.md))
- More importers (Google Forms, Typeform) and more integration destinations
- A published `stryveforms` CLI package and prebuilt binaries

## Contributing

StryveForms is open source and welcomes contributions — code, docs, translations, bug reports. See
[CONTRIBUTING.md](CONTRIBUTING.md) for getting set up, coding standards, and where help is wanted,
and please read our [Code of Conduct](CODE_OF_CONDUCT.md). Found a security issue? See
[SECURITY.md](SECURITY.md) rather than filing a public issue.

## License

StryveForms is licensed under the [GNU AGPL v3](LICENSE) (see [NOTICE](NOTICE)). It is a TypeScript
rebuild of [OpnForm](https://github.com/OpnForm/OpnForm) and keeps OpnForm's data model, so existing
OpnForm forms, submissions, files and integrations migrate over with the built-in import tool.
