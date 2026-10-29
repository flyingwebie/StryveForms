# Marketing assets

Composition source for the images in [`.github/assets/`](../../.github/assets) used by the root
`README.md` (hero banner, feature images, GitHub social preview card).

Everything is plain HTML/CSS, rendered with [playwright-core](https://www.npmjs.com/package/playwright-core)
against the system-installed Google Chrome — no headless browser download, no build step.

## Layout

```
scripts/marketing/
  fonts/              Geist Sans (OFL) woff2 files, used for all text
  lib/
    components.ts     Reusable HTML building blocks (browser frame, phone frame,
                       terminal window, badge, grid+glow background, logo lockup…)
    build-pages.ts     Assembles each image's full HTML and writes it to pages/*.html,
                       plus pages/manifest.json (output pixel size per page)
  pages/               Generated HTML (one file per image) — inspect these directly
                       in a browser to tweak layout before re-rendering
  render.ts            Loads every pages/*.html with Chrome and screenshots it to
                       .github/assets/<name>.png
```

Screenshots used inside the pages are the real app screenshots already captured for the docs site
(`apps/fumadocs/public/screenshots/**`, light + dark), referenced by relative path — nothing here
touches the dev database or captures new screenshots.

## Regenerating

```bash
cd scripts/marketing
bun install          # fetches playwright-core locally (not part of the root workspace)
bun run lib/build-pages.ts
bun run render.ts
```

Output lands in `.github/assets/*.png`. The GitHub social preview card
(`.github/assets/social-preview.png`) is rendered at 2x then downsized to the exact 1280×640
GitHub expects:

```bash
sips -z 640 1280 .github/assets/social-preview.png --out .github/assets/social-preview.png
```

## Changing a design

Edit the relevant page function in `lib/build-pages.ts` (or a shared component in
`lib/components.ts`), then re-run both scripts above. Everything renders at `deviceScaleFactor: 2`
for crisp text on retina screens; `browserFrame()` takes an optional `zoom` to crop out dead space
(e.g. an empty inspector panel) instead of showing it shrunk down.
