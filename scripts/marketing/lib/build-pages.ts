// Assembles every marketing page's HTML and writes it to scripts/marketing/pages/*.html.
// Run with: bun run scripts/marketing/lib/build-pages.ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	backdrop,
	badge,
	browserFrame,
	colors,
	floatCard,
	logoLockup,
	page,
	phoneFrame,
	SCREENSHOTS,
	terminal,
} from "./components.ts";

const PAGES_DIR = path.join(import.meta.dirname, "..", "pages");

interface Shot {
	dark: string;
	light: string;
}

const shot = (p: string): Shot => ({
	light: `${SCREENSHOTS}/${p}-light.png`,
	dark: `${SCREENSHOTS}/${p}-dark.png`,
});

const editorCanvas = shot("forms/editor-classic-canvas");
const submissionsTable = shot("submissions/table");
const analytics = shot("submissions/analytics");
const notificationsEditor = shot("notifications/editor");
const integrationsList = shot("integrations/list");
const pdfZones = shot("pdf/pdf-editor-zones");
const aiAssistant = shot("ai/assistant");
const contactClassicDesktop = shot("public/contact-classic-desktop");
const eventFocusedMobile = `${SCREENSHOTS}/public/event-focused-mobile-light.png`;

const HEADING = (text: string, dark: boolean, size = 30) => `
  <h2 style="font-weight:700; font-size:${size}px; line-height:1.15; letter-spacing:-0.01em;
    color:${dark ? "#fff" : colors.zinc950}; margin:14px 0 10px;">${text}</h2>`;

const SUB = (text: string, dark: boolean, size = 15.5) => `
  <p style="font-weight:400; font-size:${size}px; line-height:1.55; color:${dark ? colors.zinc400 : colors.zinc600}; max-width:400px;">${text}</p>`;

// ---------- Hero ----------
function heroPage(dark: boolean): string {
	const W = 1200;
	const H = 700;
	const body = `
  <div style="position:relative; width:${W}px; height:${H}px;">
    ${backdrop(dark)}
    <div style="position:relative; display:flex; flex-direction:column; align-items:center; text-align:center; padding:56px 60px 0;">
      ${badge("Open source &middot; AGPL-3.0 &middot; self-hostable", dark)}
      <h1 style="margin:20px 0 14px; font-weight:800; font-size:42px; line-height:1.12; letter-spacing:-0.02em; color:${dark ? "#fff" : colors.zinc950};">
        The form builder you<br/>can actually own
      </h1>
      <p style="font-size:16.5px; line-height:1.55; color:${dark ? colors.zinc400 : colors.zinc600}; max-width:620px;">
        Build forms, share or embed them, and collect answers — white-label, self-hosted on your own
        infrastructure, with no submission limits or paywalls.
      </p>
      <div style="margin-top:30px;">
        ${browserFrame({
					src: dark ? editorCanvas.dark : editorCanvas.light,
					width: 880,
					height: 330,
					dark,
					zoom: 1.28,
				})}
      </div>
    </div>
  </div>`;
	return page({ width: W, height: H, body });
}

// ---------- Feature: visual editor ----------
function featureEditorPage(dark: boolean): string {
	const W = 1200;
	const H = 680;
	const body = `
  <div style="position:relative; width:${W}px; height:${H}px;">
    ${backdrop(dark, { glow: false })}
    <div style="position:relative; display:flex; align-items:center; height:100%; padding:0 64px; gap:48px;">
      <div style="width:400px; flex-shrink:0;">
        ${badge("Visual editor", dark)}
        ${HEADING("Drag, drop, done.", dark, 32)}
        ${SUB("Build forms on a live canvas: drag fields from the palette, resize them to sit side by side, and reorder with your mouse. Conditional logic, formulas and validation live in the same panel — no separate screen to learn.", dark)}
      </div>
      <div style="flex:1; display:flex; justify-content:center;">
        ${browserFrame({ src: dark ? editorCanvas.dark : editorCanvas.light, width: 600, height: 382, dark, zoom: 1.28 })}
      </div>
    </div>
  </div>`;
	return page({ width: W, height: H, body });
}

// ---------- Feature: classic vs focused ----------
function featurePublicFormsPage(dark: boolean): string {
	const W = 1200;
	const H = 680;
	const body = `
  <div style="position:relative; width:${W}px; height:${H}px;">
    ${backdrop(dark, { glow: false })}
    <div style="position:relative; display:flex; align-items:center; height:100%; padding:0 64px; gap:40px;">
      <div style="width:360px; flex-shrink:0;">
        ${badge("Classic or Focused", dark)}
        ${HEADING("Two ways to present every form.", dark, 30)}
        ${SUB("Classic lays every question out on the page, like a document. Focused shows one question at a time, Typeform-style, full-bleed cover image included. Either way: five themes, your colours and fonts, dark mode, RTL and custom CSS.", dark)}
      </div>
      <div style="position:relative; flex:1; height:560px;">
        <div style="position:absolute; left:0; top:70px;">
          ${browserFrame({ src: dark ? contactClassicDesktop.dark : contactClassicDesktop.light, width: 480, height: 320, dark, urlLabel: "Classic" })}
        </div>
        <div style="position:absolute; right:40px; top:0;">
          ${phoneFrame({ src: eventFocusedMobile, width: 190, height: 400 })}
        </div>
      </div>
    </div>
  </div>`;
	return page({ width: W, height: H, body });
}

// ---------- Feature: submissions + analytics ----------
function featureSubmissionsPage(dark: boolean): string {
	const W = 1200;
	const H = 680;
	const body = `
  <div style="position:relative; width:${W}px; height:${H}px;">
    ${backdrop(dark, { glow: false })}
    <div style="position:relative; display:flex; align-items:center; height:100%; padding:0 64px; gap:48px;">
      <div style="width:380px; flex-shrink:0;">
        ${badge("Submissions &amp; analytics", dark)}
        ${HEADING("Every answer, searchable and exportable.", dark, 30)}
        ${SUB("Search, filter and export submissions to CSV, review per-question summaries, and track views, completion rate and average time with built-in analytics.", dark)}
      </div>
      <div style="position:relative; flex:1; height:560px;">
        <div style="position:absolute; left:0; top:40px;">
          ${browserFrame({ src: dark ? submissionsTable.dark : submissionsTable.light, width: 620, height: 380, dark })}
        </div>
        <div style="position:absolute; right:0; bottom:20px;">
          ${floatCard({ src: dark ? analytics.dark : analytics.light, width: 320, height: 210, dark })}
        </div>
      </div>
    </div>
  </div>`;
	return page({ width: W, height: H, body });
}

// ---------- Feature: email notifications ----------
function featureNotificationsPage(dark: boolean): string {
	const W = 1200;
	const H = 680;
	const body = `
  <div style="position:relative; width:${W}px; height:${H}px;">
    ${backdrop(dark, { glow: false })}
    <div style="position:relative; display:flex; align-items:center; height:100%; padding:0 64px; gap:48px;">
      <div style="width:380px; flex-shrink:0;">
        ${badge("Email notifications", dark)}
        ${HEADING("See the email before it sends.", dark, 30)}
        ${SUB("Design the notification with a rich-text editor, insert any field as an &commat;-mention, and watch the live preview update as you type. Send yourself a real test before it goes near a respondent.", dark)}
      </div>
      <div style="flex:1; display:flex; justify-content:center;">
        ${browserFrame({ src: dark ? notificationsEditor.dark : notificationsEditor.light, width: 660, height: 440, dark })}
      </div>
    </div>
  </div>`;
	return page({ width: W, height: H, body });
}

// ---------- Feature: integrations + PDF ----------
function featureIntegrationsPage(dark: boolean): string {
	const W = 1200;
	const H = 680;
	const body = `
  <div style="position:relative; width:${W}px; height:${H}px;">
    ${backdrop(dark, { glow: false })}
    <div style="position:relative; display:flex; align-items:center; height:100%; padding:0 64px; gap:40px;">
      <div style="width:360px; flex-shrink:0;">
        ${badge("Integrations &amp; PDF templates", dark)}
        ${HEADING("Send answers where work happens.", dark, 30)}
        ${SUB("Slack, Discord, Telegram, signed webhooks, n8n, Zapier, Make and more — plus a visual PDF template editor that fills a document with every submission, ready to download.", dark)}
      </div>
      <div style="position:relative; flex:1; height:560px;">
        <div style="position:absolute; left:0; top:10px;">
          ${browserFrame({ src: dark ? integrationsList.dark : integrationsList.light, width: 500, height: 320, dark })}
        </div>
        <div style="position:absolute; right:0; bottom:0;">
          ${browserFrame({ src: dark ? pdfZones.dark : pdfZones.light, width: 460, height: 300, dark, urlLabel: "PDF editor" })}
        </div>
      </div>
    </div>
  </div>`;
	return page({ width: W, height: H, body });
}

// ---------- Feature: AI assistant + MCP/CLI ----------
function featureAiPage(dark: boolean): string {
	const W = 1200;
	const H = 680;
	const body = `
  <div style="position:relative; width:${W}px; height:${H}px;">
    ${backdrop(dark, { glow: false })}
    <div style="position:relative; display:flex; align-items:center; height:100%; padding:0 64px; gap:40px;">
      <div style="width:360px; flex-shrink:0;">
        ${badge("Built for AI agents", dark)}
        ${HEADING("A chat panel for you, an MCP server for your agent.", dark, 28)}
        ${SUB("The in-app assistant builds and edits forms from a description. The same actions are exposed over MCP and a scriptable CLI, so Claude Code, Cursor or a CI job can do it too — scoped to real workspace permissions.", dark)}
      </div>
      <div style="position:relative; flex:1; height:560px;">
        <div style="position:absolute; left:0; top:10px;">
          ${browserFrame({ src: dark ? aiAssistant.dark : aiAssistant.light, width: 420, height: 320, dark, urlLabel: "Assistant" })}
        </div>
        <div style="position:absolute; right:0; bottom:0;">
          ${terminal({
						width: 460,
						height: 300,
						lines: [
							`<span style="color:${colors.zinc500}">$</span> npx skills add flyingwebie/stryveforms`,
							`<span style="color:#4ade80">&#10003;</span> 5 agent skills installed`,
							"",
							`<span style="color:${colors.zinc500}">$</span> stryveforms forms list --workspace acme --json`,
							`<span style="color:${colors.zinc400}">[{ "title": "Contact Us", "submissions": 128 }]</span>`,
							"",
							`<span style="color:#c4b5fd">mcp</span> &rarr; create_form, update_form_fields,`,
							"      set_form_visibility, list_submissions&hellip;",
						],
					})}
        </div>
      </div>
    </div>
  </div>`;
	return page({ width: W, height: H, body });
}

// ---------- Social preview (GitHub repo card, fixed 1280x640) ----------
function socialPreviewPage(): string {
	const W = 1280;
	const H = 640;
	const dark = true;
	const body = `
  <div style="position:relative; width:${W}px; height:${H}px;">
    ${backdrop(dark)}
    <div style="position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center;">
      ${logoLockup({ dark: true, height: 64 })}
      <p style="margin-top:26px; font-size:22px; font-weight:500; color:${colors.zinc400}; max-width:760px;">
        The self-hosted, white-label form builder
      </p>
      <p style="margin-top:14px; font-size:15px; font-weight:500; color:${colors.zinc500}; letter-spacing:0.02em;">
        github.com/flyingwebie/stryveforms &middot; AGPL-3.0
      </p>
    </div>
  </div>`;
	return page({ width: W, height: H, body });
}

const FEATURE_SIZE = { width: 1200, height: 680 };
const HERO_SIZE = { width: 1200, height: 700 };
const SOCIAL_SIZE = { width: 1280, height: 640 };

const pages: Record<string, { html: string; width: number; height: number }> = {
	"hero-light": { html: heroPage(false), ...HERO_SIZE },
	"hero-dark": { html: heroPage(true), ...HERO_SIZE },
	"feature-editor-light": { html: featureEditorPage(false), ...FEATURE_SIZE },
	"feature-editor-dark": { html: featureEditorPage(true), ...FEATURE_SIZE },
	"feature-public-forms-light": {
		html: featurePublicFormsPage(false),
		...FEATURE_SIZE,
	},
	"feature-public-forms-dark": {
		html: featurePublicFormsPage(true),
		...FEATURE_SIZE,
	},
	"feature-submissions-light": {
		html: featureSubmissionsPage(false),
		...FEATURE_SIZE,
	},
	"feature-submissions-dark": {
		html: featureSubmissionsPage(true),
		...FEATURE_SIZE,
	},
	"feature-notifications-light": {
		html: featureNotificationsPage(false),
		...FEATURE_SIZE,
	},
	"feature-notifications-dark": {
		html: featureNotificationsPage(true),
		...FEATURE_SIZE,
	},
	"feature-integrations-light": {
		html: featureIntegrationsPage(false),
		...FEATURE_SIZE,
	},
	"feature-integrations-dark": {
		html: featureIntegrationsPage(true),
		...FEATURE_SIZE,
	},
	"feature-ai-agents-light": { html: featureAiPage(false), ...FEATURE_SIZE },
	"feature-ai-agents-dark": { html: featureAiPage(true), ...FEATURE_SIZE },
	"social-preview": { html: socialPreviewPage(), ...SOCIAL_SIZE },
};

await mkdir(PAGES_DIR, { recursive: true });
const manifest: Record<string, { width: number; height: number }> = {};
for (const [name, { html, width, height }] of Object.entries(pages)) {
	// biome-ignore lint/performance/noAwaitInLoops: a handful of small local file writes; sequential is simplest here.
	await writeFile(path.join(PAGES_DIR, `${name}.html`), html, "utf8");
	manifest[name] = { width, height };
}
await writeFile(
	path.join(PAGES_DIR, "manifest.json"),
	`${JSON.stringify(manifest, null, 2)}\n`,
	"utf8"
);
console.log(`Wrote ${Object.keys(pages).length} pages to ${PAGES_DIR}`);
