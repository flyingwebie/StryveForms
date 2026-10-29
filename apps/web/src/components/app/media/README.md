# ImagePicker

Shared picker for every "pick an image" spot in the app (focused-page images, classic layout
header/background images, logos…). Owner: engineer T. Backend: `trpc.media.*`
(`packages/api/src/routers/media.ts`).

## Usage

```tsx
import ImagePicker from "@/components/app/media/image-picker";

<ImagePicker
  workspaceId={workspace.id}
  value={field.image ? { url: field.image.url, alt: field.image.alt, credit: field.image.credit } : null}
  onChange={(picked) => patchImage(picked)}
/>
```

## Props

```ts
interface ImagePickerProps {
  /** Workspace the Upload/Library tabs scope to (asset upload + previous-uploads query). */
  workspaceId: string;
  /** The currently chosen image, or null. Drives the thumbnail + Replace/Remove row. */
  value: PickedImage | null;
  /** Called with the new image, or `null` after Remove. */
  onChange: (value: PickedImage | null) => void;
  /** File input `accept`. Defaults to `"image/*"`. */
  accept?: string;
  /** Optional width/height hint forwarded to the Upload/Library thumbnail grid (purely visual; no crop is performed). */
  aspect?: number;
  /** Replaces the default "Choose image" / thumbnail trigger button with your own element. */
  trigger?: React.ReactElement;
}
```

## `PickedImage` shape

```ts
interface PickedImage {
  url: string;
  alt?: string;
  /** Present only for a photo picked from Unsplash. */
  credit?: {
    name: string;   // photographer's name
    url: string;    // photographer's Unsplash profile, with UTM params already appended
    source: "unsplash";
  };
}
```

This mirrors `BlockImage` in `packages/forms/src/types.ts` (`BlockImage.credit`), which has the
same shape — `onChange`'s value can be spread straight into `field.image` / a page's image /
`brand.backgroundImage` etc. `BlockImage.credit` is optional and `undefined` for an uploaded or
library-picked image (no attribution owed).

**Attribution rule (Unsplash API guideline):** wherever a `credit` is stored, render it near the
image as:

```html
Photo by <a href={credit.url}>{credit.name}</a> on <a href="https://unsplash.com/?utm_source=stryveforms&utm_medium=referral">Unsplash</a>
```

`credit.url` already has `?utm_source=stryveforms&utm_medium=referral` appended by the picker —
don't re-append it. S and U: when you render a page/background/header image that carries a
`credit`, show this line (small, muted text is fine) under or over the image. If you only ever
show the image without any surrounding chrome (e.g. a raw `<img>` tile), at minimum keep the
`credit` data flowing through your save/patch so it isn't silently dropped — a later UI pass can
always add the visible line.

## What each tab does

- **Upload** — drag/drop or file picker, `POST /api/assets` (existing `uploadAsset` helper),
  progress state, no attribution.
- **Library** — the workspace's own previously uploaded images (`storedFile.kind = "asset"`),
  newest first, as a thumbnail grid. Backed by `trpc.media.library.list({ workspaceId })`.
- **Unsplash** — search field (debounced) and an orientation filter, free library only (see
  "Unsplash research" below for why there's no premium option). Backed by `trpc.media.unsplash.search` / `trpc.media.unsplash.trackDownload`
  / `trpc.media.unsplash.status`. If `status.enabled` is false, the tab shows plain-language setup
  instructions instead of a search box (see below).

## Unsplash research (done before building, as the brief required)

Sources are official Unsplash pages, fetched directly; where a figure isn't officially published
that's said explicitly rather than guessed.

1. **A key is required for everything, and "free without a key" is not possible.**
   Every `api.unsplash.com` call needs `Authorization: Client-ID <access key>`
   ([unsplash.com/documentation](https://unsplash.com/documentation)). The old no-key shortcut,
   `source.unsplash.com`, was deprecated in 2021 and fully shut down in 2024 — it now returns
   HTTP 503, not an image. So there is no supported, legal way to show live Unsplash search
   results without an admin-provided Access Key. **The UI says this plainly** (see "No key yet"
   below) instead of pretending a keyless mode exists.

2. **Rate limits.** New ("Demo") apps get **50 requests/hour**
   ([help.unsplash.com/.../when-should-i-apply-for-a-higher-rate-limit](https://help.unsplash.com/en/articles/3887917-when-should-i-apply-for-a-higher-rate-limit)).
   "Production" status raises that limit once Unsplash approves an application (showing
   screenshots of attribution + real usage, submitted to partnerships@unsplash.com) — **Unsplash
   doesn't publish a fixed production number**; a `1000` example appears in one documentation
   sample response and `5000` is a commonly cited unofficial figure elsewhere, but neither is an
   official guarantee. The admin tab's how-to says this honestly rather than quoting an unverified
   number as fact. Only JSON calls to `api.unsplash.com` count against the limit —
   `images.unsplash.com` file requests don't.

3. **Attribution (required).** Credit the photographer and Unsplash, linking both back with
   `?utm_source=<app>&utm_medium=referral`
   ([help.unsplash.com/.../guideline-attribution](https://help.unsplash.com/en/articles/2511315-guideline-attribution)):
   `Photo by <a href="https://unsplash.com/@user?utm_source=stryveforms&utm_medium=referral">Name</a> on <a href="https://unsplash.com/?utm_source=stryveforms&utm_medium=referral">Unsplash</a>`.
   The picker builds this `credit` object for every photo it returns; see "`PickedImage` shape"
   above for where it ends up.

4. **Download tracking (required).** `photo.links.download_location` must be GETed, with the
   Access Key, the moment a photo is actually used (not merely previewed) —
   ([help.unsplash.com/.../guideline-triggering-a-download](https://help.unsplash.com/en/articles/2511258-guideline-triggering-a-download)).
   The picker calls `trpc.media.unsplash.trackDownload` right when the user clicks a result to
   pick it, server-side, before closing the dialog. It's a tracking ping only — never the image
   source.

5. **Hotlinking (required).** Returned `images.unsplash.com` URLs must be used directly, not
   re-hosted/re-uploaded ([unsplash.com/documentation](https://unsplash.com/documentation)). The
   picker stores the Unsplash CDN URL as-is; it never re-uploads the photo through `/api/assets`.

6. **Unsplash+ ("Premium") photos are not reachable through this API, at all — this is the key
   finding for the "Free vs Premium" ask.**
   - The documented Photo object (`unsplash.com/documentation`) has no `premium`/`plus` field.
   - The documented `/search/photos` parameters (`query`, `page`, `per_page`, `order_by`,
     `collections`, `content_filter`, `color`, `orientation`) have **no license/plus/premium
     filter** of any kind.
   - Unsplash's own API Terms license *every* image the API returns under the single, free
     "Unsplash License"; Unsplash+ is sold under a **separate** "Unsplash+ License"/"Unsplash+
     Terms", directly on unsplash.com — not through `api.unsplash.com` for third-party apps
     ([unsplash.com/api-terms](https://unsplash.com/api-terms), §8 "Images").
   - Third-party tools that claim to "filter out Unsplash+ photos" (a couple of Apify scrapers
     turned up while researching this) scrape Unsplash's own **website** search/browse pages —
     not the registered Developer API this app uses. That's a different, unsupported surface; we
     don't do that here.
   - **Conclusion: `searchUnsplashPhotos` (packages/api/src/services/media/unsplash.ts) can only
     ever return free, standard-licensed photos.** There is no API-supported way to fetch, show,
     or filter *in* real Unsplash+ results.

   **So the picker's Unsplash tab only searches the free library.** There's no Premium/PRO
   control: nothing premium can be fetched through the public API, so the picker doesn't offer
   it. Without a saved Access Key the tab shows the "Unsplash isn't turned on yet" state and
   points to Admin → Images & Unsplash.
   - A defensive, **unofficial** heuristic (`UnsplashPhoto.likelyPremium`, keyed off an
     undocumented `premium_photo-` id prefix some community scrapers mention) exists in
     `unsplash.ts` purely as a belt-and-suspenders filter in case Unsplash ever does mix such
     a result into `api.unsplash.com` search output — it is **not** a documented or guaranteed
     signal, and in testing (no live key available, see below) it never fires, since the API
     only returns the free library in the first place.

   If the user specifically wants Unsplash+ licensing, the honest next step is buying/using it
   directly on unsplash.com — this in-app picker can't broker that license.

### "No key yet" state

Until an admin saves a key in **Admin → Images & Unsplash** and turns it on, the Unsplash tab
shows, in plain words: *"Ask an administrator to add a free Unsplash Access Key in Admin → Images
& Unsplash to turn this on."* with a link to <https://unsplash.com/developers> and the admin tab's
own how-to (create an app at unsplash.com/oauth/applications → copy its Access Key → paste it in
Admin → Images & Unsplash → turn the toggle on).

### Testing note

No real Unsplash Access Key exists in this environment. The Unsplash client
(`packages/api/src/services/media/unsplash.ts`) is unit-tested with `fetch` mocked
(`unsplash.test.ts`) — there is no live/real-key check to run, and none was attempted.

## Backend pieces (for S/U, or anyone wiring this up further)

- `packages/api/src/routers/media.ts` — `media.library.list`, `media.unsplash.{search,status,trackDownload}`,
  `media.admin.{get,save,remove,test}` (admin-only).
- `packages/api/src/services/media/settings.ts` — instance-wide Unsplash enable flag + encrypted
  key, nested as `media` inside `instance_settings.agent_settings` (see the file's header comment
  for exactly why that column, and the one-line `.passthrough()` edit in
  `services/agent/settings.ts` that makes it safe to nest there).
- `packages/api/src/services/media/unsplash.ts` — the API client (search, download-tracking ping,
  key test).
- `packages/api/src/services/media/library.ts` — the workspace's previous uploads query.
- `apps/web/src/components/app/admin/media-tab.tsx` — the admin UI (masked key, Test key, enable
  toggle, how-to). Wired into `apps/web/src/routes/_auth/dashboard.admin.tsx` as the "media" tab.
