/**
 * Lazy-loaded pdfjs-dist, used only by the PDF template editor to render an
 * uploaded base PDF's pages as the canvas background. Importing dynamically
 * keeps its ~1 MB bundle out of every other route.
 */

let cached: Promise<typeof import("pdfjs-dist")> | null = null;

export function loadPdfjs(): Promise<typeof import("pdfjs-dist")> {
	cached ??= (async () => {
		const [pdfjsLib, workerUrl] = await Promise.all([
			import("pdfjs-dist"),
			import("pdfjs-dist/build/pdf.worker.mjs?url").then((m) => m.default),
		]);
		pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
		return pdfjsLib;
	})();
	return cached;
}
