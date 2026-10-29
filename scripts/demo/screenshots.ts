/**
 * Captures every fumadocs screenshot from the seeded "Acme Studio" demo
 * workspace (see seed-demo.ts / manifest.json), in both light and dark mode,
 * saving pairs to apps/fumadocs/public/screenshots/<section>/<name>-{light,dark}.png.
 *
 * Standalone script (own package.json + node_modules in this folder — see
 * README.md for why) so it never touches the repo's root bun.lock.
 *
 * Usage:
 *   cd scripts/demo && bun install && bun screenshots.ts
 *
 * Requires: the dev servers running (web :3002, API :3000) and the demo
 * workspace already seeded (apps/server: `bun run scripts/demo/seed-demo.ts`).
 *
 * Design notes:
 * - One `tour(page, variant)` function drives the whole walkthrough; it's
 *   called once per color scheme (light/dark) with a fresh browser context,
 *   so both variants follow the exact same navigation.
 * - Every risky, deep UI interaction (opening a specific panel, clicking a
 *   dynamic row) is wrapped in `safe()`, which logs and continues instead of
 *   aborting the whole run — a handful of missed "bonus" screenshots is far
 *   better than losing the rest because one selector didn't match.
 * - The TanStack Router/Query devtools toggles are always-fixed, very high
 *   z-index elements (z-index 99999/100000) regardless of their generated
 *   class names, so they're hidden by z-index + position rather than by a
 *   brittle class selector.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const SHOTS_ROOT = join(REPO_ROOT, "apps/fumadocs/public/screenshots");
const BASE_URL = "http://localhost:3002";
const CHROME_PATH =
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

type Variant = "light" | "dark";

const WORKSPACE_SWITCHER_LABEL = /Acme Studio/;
const EMBED_TAB_LABEL = /Embed/;
const POPUP_SUBTAB_LABEL = /popup/i;
const COLUMNS_BUTTON_LABEL = /Columns/i;

const manifestPath = join(__dirname, "manifest.json");
if (!existsSync(manifestPath)) {
	throw new Error(
		"scripts/demo/manifest.json not found — run apps/server/scripts/demo/seed-demo.ts first"
	);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
	workspaceId: string;
	testerEmail: string;
	forms: Record<string, { id: string; slug: string }>;
	pdfTemplateId: string;
};

function ensureDir(path: string) {
	if (!existsSync(path)) {
		mkdirSync(path, { recursive: true });
	}
}

/** Hides the TanStack Router/Query devtools toggles, regardless of class names. */
async function hideDevtools(page: Page) {
	await page.evaluate(() => {
		for (const el of document.querySelectorAll<HTMLElement>("body *")) {
			const style = getComputedStyle(el);
			if (
				style.position === "fixed" &&
				Number.parseInt(style.zIndex || "0", 10) >= 9999
			) {
				el.style.setProperty("display", "none", "important");
			}
		}
	});
}

/** Runs a risky step; logs and continues on failure instead of aborting the tour. */
async function safe(label: string, fn: () => Promise<void>) {
	try {
		await fn();
	} catch (error) {
		console.warn(`[skip] ${label}:`, (error as Error).message.split("\n")[0]);
	}
}

async function login(page: Page) {
	await page.goto(`${BASE_URL}/login`);
	await page.waitForTimeout(1500);
	await page.getByRole("textbox", { name: "Email" }).fill(manifest.testerEmail);
	await page.locator("input[type=password]").fill("Password123!");
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL("**/dashboard**");
	await page.waitForTimeout(1200);
	// Switch the browser's active workspace to the demo workspace. This is a
	// client-only localStorage key (see apps/web/src/lib/workspace.ts) — it
	// never touches server state, so the tester's own "last active workspace"
	// elsewhere is completely unaffected.
	await page.evaluate((id: string) => {
		window.localStorage.setItem("stryveforms.currentWorkspaceId", id);
	}, manifest.workspaceId);
	await page.goto(`${BASE_URL}/dashboard`);
	await page.waitForTimeout(1500);
}

async function go(page: Page, path: string) {
	await page.goto(`${BASE_URL}${path}`);
	await page.waitForTimeout(1100);
	await hideDevtools(page);
}

function shotPath(section: string, name: string, variant: Variant) {
	const dir = join(SHOTS_ROOT, section);
	ensureDir(dir);
	return join(dir, `${name}-${variant}.png`);
}

async function shot(
	page: Page,
	section: string,
	name: string,
	variant: Variant
) {
	await hideDevtools(page);
	await page.screenshot({ path: shotPath(section, name, variant) });
}

/* -------------------------------------------------------------------------- */
/*                               The full tour                               */
/* -------------------------------------------------------------------------- */

async function tour(page: Page, variant: Variant) {
	const f = manifest.forms;

	/* --------------------------- Getting started --------------------------- */
	await go(page, "/login");
	// The very first navigation in a fresh browser context can still be
	// rendering its loading spinner at this point (cold JS bundle fetch/
	// compile) — wait for the email field specifically before capturing.
	await page
		.getByRole("textbox", { name: "Email" })
		.waitFor({ timeout: 15_000 })
		.catch(() => undefined);
	await shot(page, "getting-started", "login", variant);
	await safe(
		"homepage screenshot (registration may redirect here)",
		async () => {
			await go(page, "/register");
			await shot(page, "getting-started", "homepage-or-register", variant);
		}
	);

	await login(page);
	await shot(page, "getting-started", "dashboard-forms-grid", variant);

	await safe("new form dialog", async () => {
		await page.getByRole("button", { name: "New form" }).first().click();
		await page.waitForTimeout(600);
		await shot(page, "getting-started", "new-form-dialog", variant);
		await page.keyboard.press("Escape");
		await page.waitForTimeout(300);
	});

	await safe("workspace switcher", async () => {
		await page
			.getByRole("button", { name: WORKSPACE_SWITCHER_LABEL })
			.first()
			.click();
		await page.waitForTimeout(400);
		await shot(page, "getting-started", "workspace-switcher", variant);
		await page.keyboard.press("Escape");
	});

	/* --------------------------------- Forms -------------------------------- */
	await go(page, `/editor/${f.contactUs.id}`);
	await page.waitForTimeout(800);
	await shot(page, "forms", "editor-classic-canvas", variant);

	await safe("editor: select a field", async () => {
		await page.getByRole("button", { name: "Select Full name" }).click();
		await page.waitForTimeout(500);
		await shot(page, "forms", "editor-field-settings", variant);
	});

	await safe("editor: logic tab", async () => {
		await page
			.getByRole("button", { name: "Select What's this about?" })
			.click();
		await page.waitForTimeout(400);
		await page.getByRole("tab", { name: "Logic" }).click();
		await page.waitForTimeout(400);
		await shot(page, "forms", "editor-field-validation-group", variant);
	});

	await safe("editor: add block panel", async () => {
		await page.getByRole("button", { name: "Add block" }).first().click();
		await page.waitForTimeout(500);
		await shot(page, "forms", "editor-add-block-panel", variant);
		await page.keyboard.press("Escape");
	});

	await safe("editor: design tab", async () => {
		await page.getByRole("tab", { name: "Design" }).click();
		await page.waitForTimeout(500);
		await shot(page, "forms", "editor-design-tab", variant);
	});

	await safe("editor: AI tab", async () => {
		await page.getByRole("tab", { name: "AI" }).click();
		await page.waitForTimeout(500);
		await shot(page, "forms", "editor-ai-tab", variant);
	});

	await safe("editor: settings dialog", async () => {
		// Several per-field icon buttons also have a "Settings" tooltip title —
		// the top bar's own text button is the one plain <button> without a
		// [title] attribute.
		await page
			.locator("button:not([title])")
			.filter({ hasText: "Settings" })
			.first()
			.click();
		await page.waitForTimeout(500);
		await shot(page, "forms", "editor-form-settings-general", variant);
		await safe("settings: access & security tab", async () => {
			await page.getByRole("tab", { name: "Access & security" }).click();
			await page.waitForTimeout(400);
			await shot(page, "forms", "editor-form-settings-access", variant);
		});
		await page.keyboard.press("Escape");
	});

	await safe("editor: version history", async () => {
		await page.getByRole("button", { name: "History" }).click();
		await page.waitForTimeout(500);
		await shot(page, "forms", "editor-version-history", variant);
		await page.keyboard.press("Escape");
	});

	// Focused style + pages + a split image layout.
	await go(page, `/editor/${f.eventRegistration.id}`);
	await page.waitForTimeout(800);
	await shot(page, "forms", "editor-focused-canvas", variant);

	await safe("editor: focused image layout panel", async () => {
		await page.getByRole("button", { name: "Select Full name" }).click();
		await page.waitForTimeout(400);
		await shot(page, "forms", "editor-focused-image-layout", variant);
	});

	await safe("editor: option images (ticket type)", async () => {
		await page.getByRole("button", { name: "Select Ticket type" }).click();
		await page.waitForTimeout(400);
		await shot(page, "forms", "editor-option-images", variant);
	});

	await safe("editor: PDF template editor", async () => {
		await go(
			page,
			`/editor/${f.jobApplication.id}/pdf/${manifest.pdfTemplateId}`
		);
		await page.waitForTimeout(1000);
		await shot(page, "pdf", "pdf-editor-zones", variant);
	});

	await go(page, "/dashboard/templates");
	await page.waitForTimeout(900);
	await shot(page, "forms", "templates-gallery", variant);

	/* --------------------------------- Brand -------------------------------- */
	await go(page, "/dashboard/settings?tab=brand");
	await shot(page, "brand", "workspace-brand", variant);

	await go(page, "/dashboard/admin?tab=branding");
	await shot(page, "brand", "admin-instance-branding", variant);

	/* ------------------------------- Sharing -------------------------------- */
	await go(page, `/dashboard/forms/${f.contactUs.id}/share`);
	await shot(page, "sharing", "share-panel", variant);
	await safe("sharing: embed popup tab", async () => {
		await page.getByRole("tab", { name: EMBED_TAB_LABEL }).click();
		await page.waitForTimeout(400);
		await safe("sharing: popup sub-tab", async () => {
			await page.getByRole("tab", { name: POPUP_SUBTAB_LABEL }).click();
			await page.waitForTimeout(400);
		});
		await shot(page, "sharing", "share-embed-popup", variant);
	});

	/* ----------------------------- Submissions ------------------------------ */
	await go(page, `/dashboard/forms/${f.eventRegistration.id}`);
	await page.waitForTimeout(900);
	await shot(page, "submissions", "table", variant);

	await safe("submissions: detail sheet", async () => {
		await page.locator("table tbody tr").first().click();
		await page.waitForTimeout(600);
		await shot(page, "submissions", "detail-sheet", variant);
		await page.keyboard.press("Escape");
	});

	await safe("submissions: column menu", async () => {
		await page.getByRole("button", { name: COLUMNS_BUTTON_LABEL }).click();
		await page.waitForTimeout(400);
		await shot(page, "submissions", "column-menu", variant);
		await page.keyboard.press("Escape");
	});

	await go(page, `/dashboard/forms/${f.eventRegistration.id}/analytics`);
	await page.waitForTimeout(1000);
	await shot(page, "submissions", "analytics", variant);

	await go(page, `/dashboard/forms/${f.productFeedback.id}/summary`);
	await page.waitForTimeout(1000);
	await shot(page, "submissions", "summary", variant);

	/* ----------------------------- Notifications ----------------------------- */
	await go(page, `/dashboard/forms/${f.contactUs.id}/notifications`);
	await page.waitForTimeout(800);
	await shot(page, "notifications", "list", variant);

	await safe("notifications: editor", async () => {
		// Each row's subject line is itself the "edit" button (see
		// notification-row.tsx) — click the first one by its seeded subject text.
		await page
			.getByRole("button", { name: "New contact form submission" })
			.click();
		await page.waitForTimeout(500);
		await shot(page, "notifications", "editor", variant);
		await page.keyboard.press("Escape");
	});

	/* ----------------------------- Integrations ----------------------------- */
	await go(page, `/dashboard/forms/${f.contactUs.id}/integrations`);
	await page.waitForTimeout(800);
	await shot(page, "integrations", "list", variant);

	await safe("integrations: webhook detail", async () => {
		await page.getByText("Webhook", { exact: true }).first().click();
		await page.waitForTimeout(500);
		await shot(page, "integrations", "webhook-detail", variant);
		await page.keyboard.press("Escape");
	});

	/* --------------------------------- PDF ---------------------------------- */
	await go(page, `/dashboard/forms/${f.jobApplication.id}/pdf`);
	await page.waitForTimeout(800);
	await shot(page, "pdf", "list", variant);

	/* --------------------------------- AI ----------------------------------- */
	await go(page, "/dashboard/assistant");
	await page.waitForTimeout(1000);
	await shot(page, "ai", "assistant", variant);

	await go(page, "/dashboard/settings?tab=ai");
	await page.waitForTimeout(800);
	await shot(page, "ai", "settings-provider", variant);

	/* ------------------------------- Settings ------------------------------- */
	// "workspace" is visited via an in-app tab click below, not a fresh
	// goto() like the others: WorkspaceSettingsTab seeds its Name field from
	// `useState(workspace.name)` with no `key` to force a remount, so on a
	// brand-new page load it freezes whatever the workspace list's very
	// first render resolved (briefly the oldest workspace, before the
	// localStorage-selected one settles a tick later) — a real app bug
	// (apps/web/src/components/app/settings/workspace-tab.tsx, not ours to
	// fix). Loading a different tab first, then clicking into "General"
	// in-app, reaches it only after the correct workspace already settled.
	for (const tab of ["members", "roles", "email", "account", "about"]) {
		// biome-ignore lint/performance/noAwaitInLoops: one shared page must visit each tab in order, not in parallel
		await go(page, `/dashboard/settings?tab=${tab}`);
		await page.waitForTimeout(800);
		await shot(page, "settings", tab, variant);
	}
	await safe(
		"settings: workspace tab (in-app, avoids the stale-mount bug)",
		async () => {
			await page.getByRole("button", { name: "General" }).click();
			await page.waitForTimeout(600);
			await shot(page, "settings", "workspace", variant);
		}
	);

	/* --------------------------------- Admin -------------------------------- */
	for (const tab of ["access", "users", "emails", "agents"]) {
		// biome-ignore lint/performance/noAwaitInLoops: one shared page must visit each tab in order, not in parallel
		await go(page, `/dashboard/admin?tab=${tab}`);
		await page.waitForTimeout(800);
		await shot(page, "admin", tab, variant);
	}

	/* --------------------------------- Import -------------------------------- */
	await go(page, "/dashboard/import");
	await page.waitForTimeout(800);
	await shot(page, "import", "center", variant);
}

/* -------------------------------------------------------------------------- */
/*                                  Public forms                              */
/* -------------------------------------------------------------------------- */

async function publicFormsTour(
	browser: Awaited<ReturnType<typeof chromium.launch>>
) {
	const f = manifest.forms;
	for (const variant of ["light", "dark"] as const) {
		// biome-ignore lint/performance/noAwaitInLoops: each variant's context/page must be fully torn down before the next starts
		const context = await browser.newContext({
			viewport: { width: 1440, height: 900 },
			colorScheme: variant,
		});
		const page = await context.newPage();
		page.setDefaultTimeout(20_000);
		await go(page, `/forms/${f.contactUs.slug}`);
		await shot(page, "public", "contact-classic-desktop", variant);
		await go(page, `/forms/${f.eventRegistration.slug}`);
		await shot(page, "public", "event-focused-desktop", variant);
		await context.close();
	}

	// A couple of mobile shots (390x844), light only to keep the count sane.
	const mobile = await browser.newContext({
		viewport: { width: 390, height: 844 },
		colorScheme: "light",
	});
	const mobilePage = await mobile.newPage();
	mobilePage.setDefaultTimeout(20_000);
	await go(mobilePage, `/forms/${f.contactUs.slug}`);
	await shot(mobilePage, "public", "contact-classic-mobile", "light");
	await go(mobilePage, `/forms/${f.eventRegistration.slug}`);
	await shot(mobilePage, "public", "event-focused-mobile", "light");
	await mobile.close();
}

/* -------------------------------------------------------------------------- */
/*                                    Main                                    */
/* -------------------------------------------------------------------------- */

async function main() {
	ensureDir(SHOTS_ROOT);
	const browser = await chromium.launch({
		executablePath: CHROME_PATH,
		headless: true,
	});
	for (const variant of ["light", "dark"] as const) {
		console.log(`\n=== ${variant} tour ===`);
		// biome-ignore lint/performance/noAwaitInLoops: each variant's context/page must be fully torn down before the next starts
		const context = await browser.newContext({
			viewport: { width: 1440, height: 900 },
			colorScheme: variant,
		});
		const page = await context.newPage();
		page.setDefaultTimeout(20_000);
		page.on("pageerror", (e) => console.warn("[pageerror]", e.message));
		await tour(page, variant);
		await context.close();
	}
	console.log("\n=== public form tour ===");
	await publicFormsTour(browser);
	await browser.close();
	console.log(
		"\nDone. Screenshots written to apps/fumadocs/public/screenshots/"
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
