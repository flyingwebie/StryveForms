import type { PdfPage, PdfZone } from "@StryveForms/api/services/pdf/model";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

import { apiBase } from "@/lib/api-url";
import { loadPdfjs } from "@/lib/pdfjs";

import ZoneBox from "./zone-box";

/**
 * One pdf.js document load per templateId, shared across page changes and
 * re-renders (instead of re-fetching the whole source PDF every time the
 * user flips pages or React re-runs the effect).
 */
const docCache = new Map<string, Promise<PDFDocumentProxy>>();

function loadSourceDoc(templateId: string): Promise<PDFDocumentProxy> {
	let promise = docCache.get(templateId);
	if (!promise) {
		promise = loadPdfjs().then(
			(pdfjsLib) =>
				pdfjsLib.getDocument({
					url: `${apiBase()}/api/pdf/${templateId}/source`,
					withCredentials: true,
				}).promise
		);
		docCache.set(templateId, promise);
		// Don't keep a failed load cached: retrying (e.g. after a network blip
		// or navigating away and back) should fetch again.
		promise.catch(() => docCache.delete(templateId));
	}
	return promise;
}

function isRenderingCancelled(error: unknown): boolean {
	return (
		error instanceof Error &&
		(error.name === "RenderingCancelledException" ||
			error.message.includes("Rendering cancelled"))
	);
}

/** Cancels whatever pdf.js render task currently owns the canvas and waits for it to actually stop. */
async function cancelCurrentRender(renderTaskRef: {
	current: RenderTask | null;
}) {
	if (!renderTaskRef.current) {
		return;
	}
	renderTaskRef.current.cancel();
	await renderTaskRef.current.promise.catch(() => {
		// Expected: cancel() rejects the task's own promise.
	});
}

interface RenderGuard {
	/** The pdf.js task currently drawing into the canvas, if any. */
	renderTaskRef: { current: RenderTask | null };
	/** This call's id, compared against requestIdRef to detect staleness. */
	requestId: number;
	/** Bumped on every effect run/cleanup; a stale call bails when it no longer matches. */
	requestIdRef: { current: number };
}

/**
 * Loads one page of the source PDF and draws it into `canvas`, at a
 * device-pixel-ratio-aware resolution for crispness. Never starts drawing
 * without first cancelling (and awaiting) any render task already using the
 * canvas, and bails at every checkpoint once superseded by a newer call —
 * together these stop two render() calls from ever overlapping on the same
 * canvas, which is what throws "Cannot use the same canvas during multiple
 * render() operations".
 */
async function renderPageIntoCanvas(
	templateId: string,
	pageIndex: number,
	canvas: HTMLCanvasElement,
	guard: RenderGuard
): Promise<void> {
	const { requestId, requestIdRef, renderTaskRef } = guard;
	const doc = await loadSourceDoc(templateId);
	if (requestIdRef.current !== requestId) {
		return; // superseded by a newer page/zoom/template change
	}
	const pdfPage = await doc.getPage(pageIndex + 1);
	if (requestIdRef.current !== requestId) {
		return;
	}

	await cancelCurrentRender(renderTaskRef);
	if (requestIdRef.current !== requestId) {
		return; // another render started while we were cancelling
	}

	// Render at device-pixel-ratio-aware resolution so the page stays crisp
	// on high-DPI screens and when zoomed in.
	const dpr = Math.min(window.devicePixelRatio || 1, 3);
	const viewport = pdfPage.getViewport({ scale: 2 * dpr });
	canvas.width = viewport.width;
	canvas.height = viewport.height;
	const context = canvas.getContext("2d");
	if (!context) {
		return;
	}

	const task = pdfPage.render({ canvas, canvasContext: context, viewport });
	renderTaskRef.current = task;
	await task.promise;
	if (renderTaskRef.current === task) {
		renderTaskRef.current = null;
	}
}

/** Renders the current page's background (uploaded PDF page, or a blank sheet) plus the zones overlay. */
export default function PageCanvas({
	hasSource,
	labelForZone,
	onBeginEdit,
	onDeselect,
	onSelectZone,
	onZoneChange,
	page,
	pageIndex,
	selectedZoneId,
	templateId,
	zones,
}: {
	hasSource: boolean;
	labelForZone: (zone: PdfZone) => string;
	onBeginEdit: () => void;
	onDeselect: () => void;
	onSelectZone: (id: string) => void;
	onZoneChange: (zone: PdfZone) => void;
	page: PdfPage;
	pageIndex: number;
	selectedZoneId: string | null;
	templateId: string;
	zones: PdfZone[];
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	// The pdf.js render task currently drawing into the canvas (if any) and a
	// monotonic request id: both are refs, so they survive React re-running
	// this effect (fast page/zoom changes, or a StrictMode double-invoke)
	// without re-subscribing. Together they stop two render() calls from ever
	// touching the same canvas at once, which is what throws
	// "Cannot use the same canvas during multiple render() operations".
	const renderTaskRef = useRef<RenderTask | null>(null);
	const requestIdRef = useRef(0);

	useEffect(() => {
		if (!hasSource) {
			return;
		}
		const canvas = canvasRef.current;
		if (!canvas) {
			return;
		}
		requestIdRef.current += 1;
		const requestId = requestIdRef.current;
		setLoadError(null);

		renderPageIntoCanvas(templateId, pageIndex, canvas, {
			renderTaskRef,
			requestId,
			requestIdRef,
		}).catch((error: unknown) => {
			if (isRenderingCancelled(error)) {
				return;
			}
			if (requestIdRef.current === requestId) {
				setLoadError(
					error instanceof Error ? error.message : "Couldn't load the PDF"
				);
			}
		});

		return () => {
			// Invalidate this request immediately and stop its render task, so
			// a change that fires right after (new page, StrictMode's second
			// mount) never races it for the canvas.
			requestIdRef.current += 1;
			renderTaskRef.current?.cancel();
		};
	}, [hasSource, pageIndex, templateId]);

	return (
		<div
			className="relative mx-auto overflow-hidden rounded-xl border border-border bg-white shadow-xs"
			onPointerDown={onDeselect}
			style={{ aspectRatio: `${page.width} / ${page.height}`, width: "100%" }}
		>
			{hasSource ? (
				<canvas className="absolute inset-0 h-full w-full" ref={canvasRef} />
			) : null}
			{loadError ? (
				<div className="absolute inset-0 flex items-center justify-center bg-background/80 text-center text-destructive text-xs">
					{loadError}
				</div>
			) : null}
			{zones
				.filter((zone) => zone.page === pageIndex)
				.map((zone) => (
					<ZoneBox
						key={zone.id}
						label={labelForZone(zone)}
						onBeginEdit={onBeginEdit}
						onChange={onZoneChange}
						onSelect={() => onSelectZone(zone.id)}
						selected={zone.id === selectedZoneId}
						zone={zone}
					/>
				))}
		</div>
	);
}
