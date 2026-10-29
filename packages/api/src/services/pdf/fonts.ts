/**
 * The Unicode font embedded in generated PDFs, so accented and non-Latin
 * (Cyrillic, Greek, Vietnamese, etc.) answers render correctly instead of
 * falling back to pdf-lib's Latin-1-only standard fonts. See ./fonts/LICENSE.txt.
 */

import { join } from "node:path";

export interface PdfFontBytes {
	bold: Uint8Array;
	regular: Uint8Array;
}

let cached: Promise<PdfFontBytes> | null = null;

/**
 * Where the font files live: next to this file in development, or in the
 * source tree when the server runs from its bundle (apps/server/dist).
 */
const FONT_DIRS = [
	join(import.meta.dir, "fonts"),
	join(import.meta.dir, "../../../packages/api/src/services/pdf/fonts"),
	join(process.cwd(), "packages/api/src/services/pdf/fonts"),
];

async function readFont(fileName: string): Promise<Uint8Array> {
	for (const dir of FONT_DIRS) {
		const file = Bun.file(join(dir, fileName));
		// biome-ignore lint/performance/noAwaitInLoops: directories are tried in order
		if (await file.exists()) {
			return new Uint8Array(await file.arrayBuffer());
		}
	}
	throw new Error(`PDF font ${fileName} not found`);
}

/** Loads (and caches) the bundled regular + bold font bytes. */
export function loadPdfFonts(): Promise<PdfFontBytes> {
	cached ??= Promise.all([
		readFont("DejaVuSans.ttf"),
		readFont("DejaVuSans-Bold.ttf"),
	]).then(([regular, bold]) => ({ bold, regular }));
	return cached;
}
