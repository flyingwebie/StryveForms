# Integration Delivery Research

Research notes on how each target integration receives data today, to inform "Send test" buttons and
per-integration security/payload settings in StryveForms. Sourced from official vendor documentation only.

## 1. Generic Webhook

No single "generic webhook" standard exists; the conventions below are drawn from Stripe, GitHub, and
Shopify as prior art for a webhook **sender** (what StryveForms itself should implement).

- **HMAC signing (Stripe pattern):** header `Stripe-Signature`, value `t=<unix_ts>,v1=<hex_hmac>,v0=<hex_hmac>`.
  Signature = `HMAC-SHA256(secret, "{timestamp}.{raw_json_body}")`, hex-encoded. Verify with constant-time
  comparison; reject if `|now - t|` exceeds a tolerance (library default 5 minutes) — this is the
  replay-protection mechanism. A fresh timestamp+signature pair is generated on every retry.
- **HMAC signing (GitHub pattern):** header `X-Hub-Signature-256` = `sha256=` + hex HMAC-SHA256 of the raw
  body using the configured secret. No timestamp/replay header; GitHub relies solely on HTTPS + secret
  rotation. Legacy `X-Hub-Signature` (SHA-1) is also sent for backward compatibility.
  Content type is selectable per-webhook: `application/json` (raw JSON body) or
  `application/x-www-form-urlencoded` (JSON wrapped in a form field named `payload`).
- **HMAC signing (Shopify pattern):** header `X-Shopify-Hmac-Sha256`, HMAC-SHA256 digest of the raw request
  body, base64-encoded (not hex, unlike Stripe/GitHub). Verified against the app's client secret.
- **Bearer token auth:** common custom convention — `Authorization: Bearer <token>` configured per endpoint;
  none of the three references above use this for inbound verification (they all prefer HMAC over bearer
  tokens for webhooks specifically), but it's a standard option to expose for *generic* receiver endpoints
  that don't support signature verification.
- **Basic auth / custom API-key header:** also common fallback options for receivers that can't do HMAC;
  not part of Stripe/GitHub/Shopify's own inbound model but worth exposing as sender-side auth choices
  since many third-party receivers (e.g., n8n, internal APIs) expect one of these.
- **Body format:** JSON is the default/primary format for all three; GitHub is the only one of the three
  offering a native form-encoded fallback (wrapped under a `payload` key).
- **Retry/timeout conventions:**
  - Stripe: exponential backoff for up to 3 days in live mode (3 attempts over a few hours in test/sandbox
    mode); expects the receiver to return a `2xx` quickly (defers heavy logic) or risk a timeout failure;
    manual resend available for 15–30 days after the event.
  - Shopify: retries failed deliveries (current docs: up to 8 times over a 4-hour window; an older doc page
    cited 19 attempts over 48 hours — treat 8/4h as the current figure and 19/48h as possibly stale);
    removes the subscription after repeated failure. A `2xx` response is the only success signal.
  - GitHub: not documented on the signature-verification page; general guidance is the same "respond fast,
    process async" pattern.
  - All three: treat redirects (3xx) as failures, require a reachable HTTPS endpoint, and recommend
    deduplicating by an event/delivery ID rather than relying on delivery order or timestamps.

**Relevant to "send test payload":** none of these vendors expose a literal "send test" UI concept in docs
(it's the receiver's job); Stripe's CLI (`stripe trigger <event>`) and "Resend" dashboard button are the
closest analogues — i.e. a test send should reuse the exact same signing/retry code path as a real delivery
so the two can't drift.

Sources:
- https://docs.stripe.com/webhooks
- https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
- https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks
- https://shopify.dev/docs/apps/build/webhooks

## 2. n8n — Webhook trigger node

- **Two URLs per node:** a **test URL** (active while "Listen for Test Event" is engaged, or while running
  the workflow manually/inactive — payloads show live in the editor) and a **production URL** (only live
  once the workflow is activated/published; runs show up under the Executions tab instead of the editor).
- **Auth options:** None, Basic Auth, Header Auth, JWT Auth. An **IP allowlist** option can further restrict
  which callers may reach the URL.
- **HTTP methods supported:** GET, POST, PUT, PATCH, DELETE, HEAD (selectable per node).
- **Response modes:** "Immediately" (generic ack + "workflow started" message), "When Last Node Finishes"
  (returns the last node's output; with Response Data = All Entries / First Entry JSON / First Entry Binary
  / No Response Body), "Using 'Respond to Webhook' Node" (full control via a dedicated node), and a
  streaming response mode for AI-agent-style nodes.
- **Payload formats:** Raw Body accepts JSON/XML/etc.; a Binary Property mode accepts file uploads (requires
  POST/PATCH/PUT). Default payload size cap is 16 MB; self-hosted instances can raise it via
  `N8N_PAYLOAD_SIZE_MAX`.

**Relevant to "send test":** the test URL only becomes "live" when the user clicks Listen/executes the
workflow — a StryveForms "Send test" button targeting an n8n test URL needs the user to have that listener
active in n8n first, otherwise the test call will fail; this is structurally different from the production
URL which is always listening once the workflow is active.

Sources:
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/

## 3. Zapier — Webhooks by Zapier ("Catch Hook") and REST Hooks

- **Catch Hook:** generates a unique `https://hooks.zapier.com/hooks/catch/...` URL; accepts GET, PUT, or
  POST; Zapier parses the request body for use in later Zap steps.
- **Catch Raw Hook:** same trigger family, also GET/PUT/POST, but leaves the body unparsed (raw string, max
  2 MB) and additionally exposes request headers — useful when a provider sends a payload shape Zapier's
  parser can't handle automatically.
- **No built-in auth on the Catch Hook URL itself** — the URL's secrecy is the access control; Zapier
  doesn't document bearer/basic/HMAC verification for Catch Hook (the sender decides whether to sign, Zapier
  doesn't check).
- **Data structure is sample-driven:** like Make, Zapier needs at least one real/test request sent to the
  Catch Hook URL during setup so its editor can show field mapping in later Zap steps — the URL is visible/
  copyable from the Zap's Test tab.
- **REST Hooks (alternative, used by integration developers rather than end users):** a trigger can expose a
  `subscribe`/`unsubscribe` pair. On Zap activation, Zapier POSTs to the developer's subscribe endpoint with
  a unique per-Zap target URL; the developer stores it and later pushes events to that URL directly (push
  model) instead of Zapier polling. On Zap deactivation/deletion, Zapier calls the unsubscribe endpoint
  (typically DELETE). If the integration doesn't implement subscribe/unsubscribe, Zapier falls back to a
  static "webhook" trigger, which isn't allowed in published public integrations. Subscriptions can declare
  an `expiration_date` so Zapier re-subscribes automatically; posting to a URL after unsubscribing returns
  `410 Gone`.

**Relevant to "send test":** Catch Hook requires a real inbound call before Zapier's UI can map fields —
functionally identical in spirit to Make's "determine data structure," so a StryveForms test-send button
is the natural way to prime a newly created Zap.

Sources:
- https://help.zapier.com/hc/en-us/articles/8496288690317
- https://platform.zapier.com/build/hook-trigger
- https://platform.zapier.com/build/cli-hook-trigger

## 4. Make (Integromat) — Custom Webhook module

- **Setup:** the Custom Webhook module (under Make's "Webhooks" app) generates a unique URL immediately;
  the module then needs to "determine its data structure" before downstream modules can map fields.
- **Determining the data structure:** either (a) automatic — Make listens on the generated URL and infers
  structure from the first real/sample request it receives, or (b) manual — the structure is defined
  up front under the module's advanced settings. A "Redetermine data structure" action exists to re-sample
  after the sender's payload shape changes. Without a defined structure, Make accepts incoming data without
  validating it.
- **Supported incoming formats:** query string, form data (`application/x-www-form-urlencoded` /
  multipart), and JSON.
- **Documented limits (from Make's Webhooks app docs):**
  - Each webhook has its own request queue; queue capacity scales with plan credits (667 items per 10,000
    monthly credits, capped at 10,000); once full, Make returns `400` ("queue is full").
  - Rate limit: max 300 incoming requests per rolling 10-second window; excess requests get `429`.
  - Default responses with no explicit "Webhook response" module configured: `200` Accepted, `400` Queue
    full, or `429` Too many requests.
  - A webhook left unattached to any active scenario for 5 days (120 hours) is auto-deactivated and starts
    returning `410 Gone`.
  - Webhook delivery logs are retained 3 days (30 days on Enterprise).
  - No documented IP-allowlisting feature was found on Make's own webhook docs (only the above rate/queue
    limits).

**Relevant to "send test":** this is the single most important vendor behavior for this project — a brand
new Make custom webhook is functionally inert for field-mapping purposes until it has received at least one
real call, so StryveForms' "Send test" button is not just a nice-to-have for Make, it's close to a hard
prerequisite for the user to be able to finish configuring the Make side at all.

Sources:
- https://www.make.com/en/help/tools/webhooks (redirects to https://help.make.com/webhooks)
- https://developers.make.com/custom-apps-documentation/app-components/webhooks

## 5. Pabbly Connect — Webhook trigger

- **Trigger model:** choosing "Webhook" as the trigger app starts the workflow on "When Webhook Happens."
  Pabbly Connect generates a unique webhook URL that you paste into the sending application/service.
- **Testing flow:** Pabbly's own UI pattern is "Save and Send Test Request" — the workflow waits for one
  inbound test call, captures the response, and uses that captured response's fields for mapping later
  trigger/action steps. This mirrors Make's "determine data structure" need: Pabbly's field list simply
  doesn't exist until a sample payload has been captured.
- **HTTP handling:** Pabbly's own documentation site (pabbly.com) is the only official source and is mostly
  high-level marketing/help copy; it does not clearly document supported HTTP methods, auth options (basic/
  bearer/HMAC), or payload size limits for the generic Webhook trigger app — these details were not found in
  official docs and should be treated as unverified.

**Relevant to "send test":** same shape as Make/Zapier — Pabbly's workflow can't be fully wired up without
at least one real inbound sample, so a StryveForms test-send button is directly useful during setup.

Sources:
- https://www.pabbly.com/pabbly-connect-documentation-complete-integration-guide/

## 6. Activepieces — Webhook trigger piece

- **Piece:** the "Webhook" piece exposes a "Catch Webhook" trigger that accepts **any HTTP method**
  (GET, POST, PUT, DELETE, etc., per the piece's own description), plus two companion actions: "Return
  Response" (send a response back to the original caller) and "Respond and Wait for Next Webhook" (send a
  response, then pause the flow until another webhook call arrives to resume it).
- **Auth options:** not documented on the official piece page or the piece-building guide — no mention of
  basic/bearer/HMAC verification for the Catch Webhook trigger was found in official docs.
- **Testing flow:** Activepieces' flow builder has a generic "load sample data" step for triggers (used in
  piece development via `AP_DEV_PIECES` + a local tunnel for webhook pieces specifically) — the production
  concept is the same as other platforms: a trigger needs sample/real data before you can reference fields
  in later steps.
- **Self-hosted note:** since Activepieces is itself open-source/self-hostable, a local dev instance needs
  its own public tunnel (e.g., localxpose) for inbound webhook testing — not directly relevant to
  StryveForms' sender side but useful context for why a user's Activepieces webhook URL might be
  unreachable in a dev setup.

**Relevant to "send test":** no distinct "test URL vs production URL" split is documented (unlike n8n) — it
appears to be a single URL per flow, gated by whether the flow is published.

Sources:
- https://www.activepieces.com/pieces/webhook
- https://www.activepieces.com/docs/build-pieces/building-pieces/create-trigger

## 7. Albato — Webhook trigger

- **Trigger model:** Albato's "Webhook" app exposes an "Incoming webhook" trigger. Setup flow: connect/
  authorize the Webhook app in Albato's Apps section, create a Scenario, then choose "Incoming webhook" (or
  another connected app) as the trigger, and add downstream actions.
- **Trigger types distinguished in-product:** Albato marks **webhook** triggers (fire immediately on event)
  differently from **API/polling** triggers (poll on an interval set by subscription plan) — shown via
  different icons during setup.
- **Testing flow:** Albato's documented pattern is to run a test before activating the scenario, to confirm
  the integration behaves as expected — same "prime it with a sample call" pattern as the other no-code
  tools above.
- **Gaps:** official Albato documentation does not clearly cover the webhook URL generation/copy step, auth
  options (basic/bearer/HMAC), payload size limits, or supported HTTP methods for the Incoming Webhook
  trigger — these were not found and should be treated as unverified; Albato's own help center/support was
  the documented fallback for details beyond the high-level flow.

**Relevant to "send test":** consistent with the rest of the no-code tool cohort — a test call during setup
is part of Albato's own documented workflow, reinforcing that a StryveForms-side "send test" feature is
broadly expected by users of these platforms, not just a Make/Zapier quirk.

Sources:
- https://albato.com/app-webhooks

## 8. Slack — Incoming Webhooks

- **Setup:** create (or reuse) a Slack app for a chosen workspace → enable "Incoming Webhooks" in the app's
  features → "Add New Webhook to Workspace," pick a channel, authorize. Slack then issues a URL of the form
  `https://hooks.slack.com/services/...` (GovSlack apps use the `slack-gov.com` domain instead). For
  distributed/public apps, request the `incoming-webhook` OAuth scope; the OAuth response then contains an
  `incoming_webhook.url` field instead of a dashboard-issued URL.
  Treat the webhook URL itself as a bearer-token-equivalent secret — Slack explicitly warns not to share it.
- **HTTP method / content type:** `POST` with `Content-Type: application/json`.
  No HMAC signing is used on outbound sends to Slack; the URL's secrecy is the only authentication.
- **Payload shape:** `text` (required — omitting it returns a `no_text` error), and/or `blocks` (Block Kit
  layout objects, which can include interactive components). Slack's current Incoming Webhooks docs do not
  document an `attachments` field in the payload — only a limit of 100 attachments per message is mentioned
  in the error list, implying legacy `attachments` support still exists but isn't the documented primary
  path (Block Kit `blocks` is the documented modern format).
- **Channel/username/icon overrides: confirmed unsupported** — Slack's current docs state plainly "you
  cannot override the default channel (chosen by the user who installed your app), username, or icon" for
  webhooks created through this (app-based) flow. These are fixed at webhook-creation time by whoever
  installed the app/authorized the channel, not controllable per-message. (This matters directly for
  StryveForms' settings UI: any "channel override" or "username override" field offered to users would be a
  no-op against a modern Slack webhook.)

**Relevant to "send test":** no special data-structure priming is required — a single well-formed POST with
`text` is immediately visible in the channel, so a "send test" button is straightforward and has no
analogue to Make/Zapier's sampling requirement.

Sources:
- https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks

## 9. Discord — Webhooks

- **Endpoints:** `POST /webhooks/{webhook.id}/{webhook.token}` (standard, full Discord payload), plus two
  compatibility aliases: `POST .../slack` (accepts Slack-shaped payloads) and `POST .../github` (accepts
  GitHub-shaped payloads).
- **Payload fields (standard endpoint):** `content` (up to 2000 chars), `embeds` (up to 10 embed objects),
  `username` and `avatar_url` (per-message overrides of the webhook's configured default name/avatar —
  **confirmed still supported** on the standard execute endpoint), plus `tts`, `allowed_mentions`,
  `components`, `flags`, `attachments`, `poll`, `thread_name`, `applied_tags`, and `files[n]` for uploads.
  At least one of `content`, `embeds`, `poll`, or a file must be present.
- **`thread_id` query parameter:** posts the message into a specific thread within the webhook's channel;
  Discord auto-unarchives the thread. In forum/media channels you must supply either `thread_id` (query
  string) or `thread_name` (body) so Discord knows where to post.
- **`wait` query parameter:** on the standard endpoint, defaults to `false` (returns `204 No Content`); on
  the `/slack` compatibility endpoint it defaults to `true`. The `/slack` endpoint only supports the
  `thread_id` and `wait` query parameters and explicitly does **not** support Slack's own `channel`,
  `icon_emoji`, `mrkdwn`, or `mrkdwn_in` fields — i.e. it's a payload-shape adapter, not a full Slack-webhook
  emulator.
- **Auth:** the webhook ID+token embedded in the URL is the sole credential; no separate bearer/HMAC layer.

**Relevant to "send test":** unlike Slack, Discord's `username`/`avatar_url` per-message overrides are
genuinely functional today on the standard endpoint — so a StryveForms settings UI offering those overrides
for Discord (unlike Slack) is accurate, not a no-op. `thread_id` support is worth exposing explicitly as an
advanced option.

Sources:
- https://docs.discord.com/developers/resources/webhook

## 10. Telegram — Bot API `sendMessage`

- **Transport:** `https://api.telegram.org/bot<token>/sendMessage` — the bot token is embedded directly in
  the URL path (issued once via @BotFather); there is no separate signing step. Both **GET and POST** are
  accepted; parameters can be passed as a URL query string, `application/x-www-form-urlencoded`,
  `application/json`, or `multipart/form-data` (the last only needed for file-upload methods, not
  `sendMessage`).
- **Required params:** `chat_id` (integer chat ID or `@username` for a channel/supergroup/bot), `text`
  (1–4096 characters after entity parsing).
- **`parse_mode` (confirmed exact values):** `HTML`, `Markdown` (legacy), `MarkdownV2`. `entities` can be
  used instead of `parse_mode` for precise formatting control.
- **`disable_notification`:** boolean — sends the message silently (delivered with no sound/no active
  notification, but still appears with a notification badge per Telegram's own description "users will
  receive a notification with no sound").
- **Other notable optional params:** `protect_content` (blocks forwarding/saving), `message_thread_id`
  (forum-topic targeting), `reply_parameters`, `reply_markup`, `link_preview_options`,
  `allow_paid_broadcast`, `message_effect_id`.

**Relevant to "send test":** no sampling/priming step exists at all — `sendMessage` is a direct synchronous
call with an immediate success/failure response (the sent `Message` object or a Telegram API error), making
it the simplest "send test" implementation of all ten integrations.

Sources:
- https://core.telegram.org/bots/api#sendmessage
