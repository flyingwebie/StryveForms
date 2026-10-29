# Contributing to StryveForms

Thanks for considering a contribution! StryveForms exists so that solid, polished form-building software doesn't have to live behind a paywall or someone else's server — it's a free, open-source, white-label alternative to OpnForm, Typeform and the like, built so anyone can self-host it and make it their own. Every contribution — code, docs, translations, bug reports — moves that forward.

This guide covers getting set up, how we work, and where to find something to work on. If anything here is wrong or missing, open a PR against this file — it's as valid a first contribution as any.

## Project vision

- **Open source, AGPL-licensed, forever.** No "enterprise" fork with the good features held back.
- **White-label by default.** An instance should feel like *your* product — your name, your logo, your colours — not "StryveForms with a logo pasted on".
- **Compatible with OpnForm's data model.** Forms, fields, logic and submissions use the same shape, so migrating an existing OpnForm instance in is a first-class feature, not an afterthought.
- **Self-hostable without a fight.** One Docker Compose file, or a few clicks on Coolify/Railway, should get a working instance.

## Getting set up

**Prerequisites:**

- [Bun](https://bun.sh) 1.3 or newer
- [Docker](https://docs.docker.com/get-docker/) (for a local PostgreSQL — you don't need Docker for anything else in development)

**Steps:**

```bash
git clone https://github.com/flyingwebie/stryveforms.git
cd stryveforms
bun install                                   # also generates typed env files via Varlock (postinstall)
cp apps/server/.env.example apps/server/.env  # edit BETTER_AUTH_SECRET at least — see below
cp apps/web/.env.example apps/web/.env
bun run db:start                              # PostgreSQL in Docker
bun run db:push                               # create tables from the current schema
bun run dev                                   # starts both apps
```

Generate `BETTER_AUTH_SECRET` with:

```bash
openssl rand -base64 48
```

Open **http://localhost:3002** (the web app) — the API runs behind it on port `3000` and you normally don't talk to it directly. The first visit runs onboarding: create an administrator account and you're in.


Useful commands while you work:

| Command | What it does |
| --- | --- |
| `bun run dev` | Run web + server together, with labeled logs |
| `bun run dev:web` / `dev:server` / `dev:tui` | Run just one app |
| `bun run check` | Lint + type-check the whole workspace |
| `bun run check-types` | Type-check only |
| `bunx ultracite check` / `bunx ultracite fix` | Lint/format (see Coding standards below) |
| `bun test` (inside a package) | Run that package's unit tests |
| `bun run db:studio` | Drizzle Studio, a GUI for the local database |
| `bun run db:generate` | Generate a new migration after a schema change |

## Repo map

```
apps/
  web/              TanStack Start + Router + Query, React 19, Tailwind v4, shadcn (Base UI) — the product itself
  server/           Hono + tRPC API, Better Auth — everything apps/web talks to
  tui/              Experimental terminal UI (OpenTUI + React) for local/ops tasks

packages/
  api/              tRPC routers, services, the submission pipeline, storage (disk/S3)
  auth/             Better Auth setup shared by server and web
  db/               Drizzle ORM schema, migrations, and the Postgres connection
  forms/            The shared form model: fields, blocks, conditional logic, formulas, mentions — used by both browser and server
  emails/           React Email templates + Nodemailer sending
  ui/               Shared shadcn/ui components (`@StryveForms/ui/components/<name>`)
  opnform-import/   OpnForm API client + import/mapping logic
  jotform-import/   JotForm API client + import/mapping logic
  config/           Shared TypeScript config (tsconfig base)
```

If you're not sure which package owns something, `grep` for the export you need — most packages are small and single-purpose.

## Coding standards

This project uses [Ultracite](https://ultracite.dev), a zero-config Biome preset — see [AGENTS.md](AGENTS.md) at the repo root for the full standards it enforces (type safety, React/JSX rules, accessibility, security, performance). The short version:

- Run `bunx ultracite fix` before committing — most issues are auto-fixed.
- Run `bunx ultracite check` to see what's left.
- A few repo-specific habits: consistent corner radius (`rounded-xl` for cards/panels, `rounded-lg` for list rows/chips, `rounded-full` for avatars, never `rounded-none`), theme colours via `primary`/semantic Tailwind tokens rather than hard-coded brand colours (an instance's brand colour overrides `--primary` at runtime), and dark mode that actually looks right — check both before opening a PR.
- Every new user-facing option or setting should have a one-line, plain-language description next to it in the UI. We're building for people who don't want to read documentation to use a checkbox.

## Tests

Unit tests live next to the logic they cover and run with `bun test` from inside the package:

```bash
cd packages/forms && bun test
cd packages/opnform-import && bun test
cd packages/jotform-import && bun test
```

Add tests for non-trivial logic (conditional logic, formulas, import mapping, anything with edge cases) — not for simple UI composition. There's no project-wide `bun test` runner yet; run it per package.

## Commits

We use **[Gitmoji](https://gitmoji.dev) + [Conventional Commits](https://www.conventionalcommits.org)**:

```
<emoji> <type>(<scope>): <subject>
```

| Emoji | Type | When |
| --- | --- | --- |
| ✨ | `feat` | New feature |
| 🐛 | `fix` | Bug fix |
| 📝 | `docs` | Documentation only |
| 💄 | `style` | UI/visual change |
| ♻️ | `refactor` | Restructuring with no behavior change |
| ⚡ | `perf` | Performance improvement |
| ✅ | `test` | Adding/updating tests |
| 🔧 | `chore` | Tooling, config, build |
| 🚀 | `ci` | CI/CD |
| ⬆️ | `deps` | Dependency upgrades |
| 🔒 | `security` | Security fix |
| 🗑️ | `remove` | Removing code/files |
| 🚨 | `breaking` | Breaking change — add a `BREAKING CHANGE:` footer |

Example: `✨ feat(editor): add matrix question type`. Keep the subject imperative and under ~72 characters; explain *why* in the body if it's not obvious from the diff. One logical change per commit.

A pre-commit hook (`.husky/pre-commit`) runs `ultracite fix` on staged files automatically — it doesn't check your commit message format yet, so this is a convention to follow by hand for now, not something that will block your commit.

## Branches & PRs

- Branch off `main`: `feat/matrix-question`, `fix/pdf-signature-crop`, `docs/deployment-railway` — whatever reads clearly.
- Keep PRs focused on one change. A big refactor plus a new feature in the same PR is hard to review — split it.
- **PR checklist:**
  - [ ] `bunx ultracite check` passes on the files you touched
  - [ ] `bun run check-types` passes
  - [ ] Relevant `bun test` suites pass, and you added tests for new non-trivial logic
  - [ ] **UI changes include screenshots, in both light and dark mode** — this is the fastest way for a reviewer to catch a dark-mode or corner-radius regression without pulling your branch
  - [ ] New or changed settings have a plain-language description in the UI
- Describe *why* the change is needed in the PR description, not just what changed — the diff already shows the what.

## Good first issues / where help is wanted

Great places to start if you're not sure where to dig in:

- **Integrations** — new destinations under `packages/api/src/services/integrations/` (another chat app, another automation platform).
- **Importers** — improving coverage in `packages/opnform-import` / `packages/jotform-import` for fields or settings that don't map cleanly yet.
- **Translations** — the UI isn't fully internationalized yet; help design and wire up the i18n approach, or add a locale once it exists.
- **Templates** — starter form templates for common use cases (contact forms, RSVPs, surveys, intake forms).

Check open issues labeled `good first issue` or `help wanted` on GitHub, or open a new issue to discuss an idea before investing a lot of time — especially for anything that touches the form data model or auth.

## License

StryveForms is licensed under the **GNU AGPL v3** (see [LICENSE](LICENSE) and [NOTICE](NOTICE)). By contributing, you agree that your contribution is licensed under the same terms — there's no separate CLA or copyright assignment to sign.

## Code of conduct

Participation in this project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). Be kind; assume good faith; disagree about code, not people.

## Reporting security issues

Please **don't** open a public issue for a security vulnerability — see [SECURITY.md](SECURITY.md) for how to report one privately.

## Questions?

Open a [GitHub Discussion](https://github.com/flyingwebie/stryveforms/discussions) or an issue — there's no separate chat server yet. If you're about to start something non-trivial, a quick issue describing your plan saves everyone time.
