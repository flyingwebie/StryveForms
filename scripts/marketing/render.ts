// Renders scripts/marketing/pages/*.html to PNG using playwright-core + system Chrome.
// Run with: bun run scripts/marketing/render.ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const PAGES_DIR = path.join(import.meta.dirname, "pages");
const OUT_DIR = path.join(import.meta.dirname, "..", "..", ".github", "assets");

const CHROME_PATH =
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const HTML_EXTENSION = /\.html$/;

type Manifest = Record<string, { width: number; height: number }>;

async function main() {
	const manifest: Manifest = JSON.parse(
		await readFile(path.join(PAGES_DIR, "manifest.json"), "utf8")
	);
	const files = (await readdir(PAGES_DIR)).filter((f) => f.endsWith(".html"));

	const browser = await chromium.launch({
		executablePath: CHROME_PATH,
		headless: true,
	});
	try {
		// Rendered one page at a time (not Promise.all) so a single shared Chrome
		// instance isn't asked to paint every page concurrently.
		for (const file of files) {
			const name = file.replace(HTML_EXTENSION, "");
			const size = manifest[name];
			if (!size) {
				console.warn(`Skipping ${file}: no manifest entry`);
				continue;
			}
			// biome-ignore lint/performance/noAwaitInLoops: pages render sequentially against one shared browser, by design.
			const page = await browser.newPage({
				viewport: { width: size.width, height: size.height },
				deviceScaleFactor: 2,
			});
			await page.goto(`file://${path.join(PAGES_DIR, file)}`);
			await page.waitForTimeout(150);
			const outPath = path.join(OUT_DIR, `${name}.png`);
			await page.screenshot({ path: outPath, type: "png" });
			await page.close();
			console.log(`Rendered ${name}.png (${size.width}x${size.height} @2x)`);
		}
	} finally {
		await browser.close();
	}
}

await main();
