/**
 * Draws a PDF template's zones onto an uploaded base PDF (or blank pages)
 * for one submission (or sample data), using pdf-lib. Isolated from the
 * tRPC/HTTP layer: callers pass plain data in, get PDF bytes back.
 */

import { resolveMentions } from "@StryveForms/forms/mentions";
import type { FormField } from "@StryveForms/forms/types";
import {
	displayValueToText,
	fileList,
	formatFieldValue,
} from "@StryveForms/forms/values";
import fontkit from "@pdf-lib/fontkit";
import {
	PDFArray,
	PDFDict,
	type PDFDocument,
	PDFDocument as PDFDocumentClass,
	type PDFFont,
	type PDFImage,
	PDFName,
	PDFNumber,
	type PDFPage,
	PDFString,
	rgb,
} from "pdf-lib";
import QRCode from "qrcode";

import type { Services } from "../../context";
import { submissionFileKey } from "../../lib/files";
import { loadPdfFonts } from "./fonts";
import type {
	PdfPage as PdfPageModel,
	PdfTextAlign,
	PdfZone,
	PdfZoneStyle,
} from "./model";
import { pageNumberText } from "./model";

export interface RenderContext {
	fields: FormField[];
	form: { id: string; title: string };
	pages: PdfPageModel[];
	services: Services;
	sourceFileKey: string | null;
	submissionMeta: { createdAt: Date; publicId: string };
	/** Raw submission.data (or sample values for a data-less preview). */
	values: Record<string, unknown>;
	zones: PdfZone[];
}

interface Box {
	hPt: number;
	topYPt: number;
	wPt: number;
	xPt: number;
}

interface DrawDeps {
	fieldsById: Map<string, FormField>;
	form: { id: string; title: string };
	/** When this render started, for "meta" zones showing a generation stamp. */
	generatedAt: Date;
	mentionValues: Record<string, string>;
	services: Services;
	submissionMeta: { createdAt: Date; publicId: string };
	/** Total pages in the output document, for "pagenumber" zones. */
	totalPages: number;
	values: Record<string, unknown>;
}

const HEX_SHORT = /^[0-9a-f]{3}$/i;
const HEX_LONG = /^[0-9a-f]{6}$/i;
const WHITESPACE = /\s+/;
const NEWLINE = /\n/g;

function hexToRgb(hex: string) {
	const clean = hex.replace("#", "").trim();
	let full = clean;
	if (HEX_SHORT.test(clean)) {
		full = clean
			.split("")
			.map((c) => c + c)
			.join("");
	}
	if (!HEX_LONG.test(full)) {
		full = "111111";
	}
	const r = Number.parseInt(full.slice(0, 2), 16) / 255;
	const g = Number.parseInt(full.slice(2, 4), 16) / 255;
	const b = Number.parseInt(full.slice(4, 6), 16) / 255;
	return rgb(r, g, b);
}

function wrapLines(
	font: PDFFont,
	text: string,
	fontSize: number,
	maxWidth: number
): string[] {
	const lines: string[] = [];
	for (const para of text.split("\n")) {
		const words = para.split(WHITESPACE).filter(Boolean);
		if (words.length === 0) {
			lines.push("");
			continue;
		}
		let current = "";
		for (const word of words) {
			const candidate = current ? `${current} ${word}` : word;
			if (!current || font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
				current = candidate;
			} else {
				lines.push(current);
				current = word;
			}
		}
		if (current) {
			lines.push(current);
		}
	}
	return lines;
}

function truncateToWidth(
	font: PDFFont,
	text: string,
	fontSize: number,
	maxWidth: number
): string {
	if (font.widthOfTextAtSize(text, fontSize) <= maxWidth) {
		return text;
	}
	for (let end = text.length - 1; end > 0; end -= 1) {
		const candidate = `${text.slice(0, end)}…`;
		if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
			return candidate;
		}
	}
	return "…";
}

const MIN_SHRINK_FONT_SIZE = 4;
const SHRINK_STEP = 0.5;

function shrinkToFit(
	font: PDFFont,
	text: string,
	style: PdfZoneStyle,
	boxWidth: number,
	boxHeight: number
): { fontSize: number; lines: string[] } {
	let { fontSize } = style;
	while (fontSize > MIN_SHRINK_FONT_SIZE) {
		const lines = wrapLines(font, text, fontSize, boxWidth);
		if (lines.length * fontSize * style.lineHeight <= boxHeight) {
			return { fontSize, lines };
		}
		fontSize -= SHRINK_STEP;
	}
	return {
		fontSize: MIN_SHRINK_FONT_SIZE,
		lines: wrapLines(font, text, MIN_SHRINK_FONT_SIZE, boxWidth),
	};
}

/** Draws `text` inside `box`, applying the zone's size/wrap/shrink/align rules. */
function drawTextInBox(
	page: PDFPage,
	text: string,
	box: Box,
	style: PdfZoneStyle,
	font: PDFFont
) {
	if (!text) {
		return;
	}
	let { fontSize } = style;
	let lines: string[];
	if (style.overflow === "shrink") {
		({ fontSize, lines } = shrinkToFit(font, text, style, box.wPt, box.hPt));
	} else if (style.overflow === "wrap") {
		lines = wrapLines(font, text, fontSize, box.wPt);
		const maxLines = Math.max(
			1,
			Math.floor(box.hPt / (fontSize * style.lineHeight))
		);
		lines = lines.slice(0, maxLines);
	} else {
		lines = [
			truncateToWidth(font, text.replace(NEWLINE, " "), fontSize, box.wPt),
		];
	}
	const color = hexToRgb(style.color);
	const bottomLimit = box.topYPt - box.hPt - fontSize;
	let cursorY = box.topYPt - fontSize;
	for (const line of lines) {
		if (cursorY < bottomLimit) {
			break;
		}
		const lineWidth = font.widthOfTextAtSize(line, fontSize);
		let x = box.xPt;
		if (style.align === "center") {
			x = box.xPt + (box.wPt - lineWidth) / 2;
		} else if (style.align === "right") {
			x = box.xPt + (box.wPt - lineWidth);
		}
		page.drawText(line, { color, font, size: fontSize, x, y: cursorY });
		cursorY -= fontSize * style.lineHeight;
	}
}

function drawImageInBox(
	page: PDFPage,
	image: PDFImage,
	box: Box,
	align: PdfTextAlign
) {
	const scale = Math.min(box.wPt / image.width, box.hPt / image.height, 1);
	const w = image.width * scale;
	const h = image.height * scale;
	let x = box.xPt;
	if (align === "center") {
		x = box.xPt + (box.wPt - w) / 2;
	} else if (align === "right") {
		x = box.xPt + (box.wPt - w);
	}
	const y = box.topYPt - box.hPt + (box.hPt - h) / 2;
	page.drawImage(image, { height: h, width: w, x, y });
}

async function embedImageBlob(
	doc: PDFDocument,
	blob: Blob
): Promise<PDFImage | null> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
	try {
		return isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
	} catch {
		try {
			return isPng ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
		} catch {
			return null;
		}
	}
}

function boxFor(page: PDFPage, zone: PdfZone): Box {
	const pageW = page.getWidth();
	const pageH = page.getHeight();
	return {
		hPt: zone.h * pageH,
		topYPt: pageH - zone.y * pageH,
		wPt: zone.w * pageW,
		xPt: zone.x * pageW,
	};
}

function checkboxIsChecked(
	zone: PdfZone,
	field: FormField | undefined,
	value: unknown
) {
	if (field?.type === "checkbox") {
		return value === true || value === "true" || value === 1;
	}
	if (Array.isArray(value)) {
		return zone.checkboxValue
			? value.map(String).includes(zone.checkboxValue)
			: value.length > 0;
	}
	if (value === undefined || value === null || value === "") {
		return false;
	}
	return zone.checkboxValue ? String(value) === zone.checkboxValue : true;
}

function drawFieldZone(
	page: PDFPage,
	zone: PdfZone,
	box: Box,
	font: PDFFont,
	deps: DrawDeps
) {
	const text = zone.fieldId ? (deps.mentionValues[zone.fieldId] ?? "") : "";
	drawTextInBox(page, text, box, zone.style, font);
}

function drawStaticZone(
	page: PDFPage,
	zone: PdfZone,
	box: Box,
	font: PDFFont,
	deps: DrawDeps
) {
	const text = resolveMentions(zone.content ?? "", deps.mentionValues, {
		mode: "text",
	});
	drawTextInBox(page, text, box, zone.style, font);
}

function metaText(zone: PdfZone, deps: DrawDeps): string {
	if (zone.metaKey === "submission_id") {
		return deps.submissionMeta.publicId;
	}
	if (zone.metaKey === "submitted_at") {
		return deps.submissionMeta.createdAt.toLocaleString();
	}
	if (zone.metaKey === "form_title") {
		return deps.form.title;
	}
	if (zone.metaKey === "generated_at") {
		return deps.generatedAt.toLocaleString();
	}
	return "";
}

function drawMetaZone(
	page: PDFPage,
	zone: PdfZone,
	box: Box,
	font: PDFFont,
	deps: DrawDeps
) {
	drawTextInBox(page, metaText(zone, deps), box, zone.style, font);
}

function drawCheckboxZone(
	page: PDFPage,
	zone: PdfZone,
	box: Box,
	font: PDFFont,
	deps: DrawDeps
) {
	const field = zone.fieldId ? deps.fieldsById.get(zone.fieldId) : undefined;
	const value = zone.fieldId ? deps.values[zone.fieldId] : undefined;
	if (checkboxIsChecked(zone, field, value)) {
		drawTextInBox(page, "✓", box, { ...zone.style, align: "center" }, font);
	}
}

/**
 * Loads the file behind a "signature" zone, or an "image" zone, and draws
 * it, if any. An "image" zone with a fieldId draws that field's uploaded
 * file (e.g. a "files" or signature field) instead of its fixed imageKey.
 */
function loadZoneImageBlob(
	zone: PdfZone,
	deps: DrawDeps
): Promise<Blob | null> {
	if (zone.type === "image" && !zone.fieldId) {
		return zone.imageKey
			? deps.services.storage.get(zone.imageKey)
			: Promise.resolve(null);
	}
	const field = zone.fieldId ? deps.fieldsById.get(zone.fieldId) : undefined;
	if (!field) {
		return Promise.resolve(null);
	}
	const [name] = fileList(deps.values[field.id]);
	return name
		? deps.services.storage.get(submissionFileKey(deps.form.id, name))
		: Promise.resolve(null);
}

async function drawImageZone(
	doc: PDFDocument,
	page: PDFPage,
	zone: PdfZone,
	box: Box,
	deps: DrawDeps
) {
	const blob = await loadZoneImageBlob(zone, deps);
	if (!blob) {
		return;
	}
	const image = await embedImageBlob(doc, blob);
	if (image) {
		drawImageInBox(page, image, box, zone.style.align);
	}
}

/** Only http(s)/mailto/tel URLs become clickable: everything else is a no-op (no annotation), to avoid e.g. "javascript:" links. */
const SAFE_LINK_SCHEME = /^(https?:|mailto:|tel:)/i;

/** Adds a clickable "open this URL" annotation covering `box`, via pdf-lib's low-level object API (no high-level link helper exists). */
function addLinkAnnotation(
	doc: PDFDocument,
	page: PDFPage,
	box: Box,
	url: string
) {
	const target = url.trim();
	if (!SAFE_LINK_SCHEME.test(target)) {
		return;
	}
	const { context } = doc;
	const rect = PDFArray.withContext(context);
	for (const n of [
		box.xPt,
		box.topYPt - box.hPt,
		box.xPt + box.wPt,
		box.topYPt,
	]) {
		rect.push(PDFNumber.of(n));
	}
	const border = PDFArray.withContext(context);
	for (const n of [0, 0, 0]) {
		border.push(PDFNumber.of(n));
	}
	const action = PDFDict.withContext(context);
	action.set(PDFName.of("Type"), PDFName.of("Action"));
	action.set(PDFName.of("S"), PDFName.of("URI"));
	action.set(PDFName.of("URI"), PDFString.of(target));
	const annotation = PDFDict.withContext(context);
	annotation.set(PDFName.of("Type"), PDFName.of("Annot"));
	annotation.set(PDFName.of("Subtype"), PDFName.of("Link"));
	annotation.set(PDFName.of("Rect"), rect);
	annotation.set(PDFName.of("Border"), border);
	annotation.set(PDFName.of("A"), action);
	page.node.addAnnot(context.register(annotation));
}

function drawLinkZone(
	doc: PDFDocument,
	page: PDFPage,
	zone: PdfZone,
	box: Box,
	font: PDFFont,
	deps: DrawDeps
) {
	const displayText = resolveMentions(zone.content ?? "", deps.mentionValues, {
		mode: "text",
	});
	const url = resolveMentions(zone.linkUrl ?? "", deps.mentionValues, {
		mode: "text",
	});
	drawTextInBox(page, displayText || url, box, zone.style, font);
	if (url) {
		addLinkAnnotation(doc, page, box, url);
	}
}

/** A top-left-origin (y grows downward) rounded-rectangle path, for `page.drawSvgPath`. */
function roundedRectPath(w: number, h: number, radius: number): string {
	const r = Math.max(0, Math.min(radius, w / 2, h / 2));
	if (r < 0.01) {
		return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
	}
	return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
}

function drawRectZone(page: PDFPage, zone: PdfZone, box: Box) {
	const fill = zone.fillColor ? hexToRgb(zone.fillColor) : undefined;
	const stroke = zone.strokeColor ? hexToRgb(zone.strokeColor) : undefined;
	if (!(fill || stroke)) {
		return;
	}
	page.drawSvgPath(roundedRectPath(box.wPt, box.hPt, zone.cornerRadius ?? 0), {
		borderColor: stroke,
		borderWidth: stroke ? (zone.strokeWidth ?? 1) : 0,
		color: fill,
		opacity: zone.fillOpacity ?? 1,
		x: box.xPt,
		y: box.topYPt,
	});
}

/** A horizontal divider through the vertical middle of the zone's box. */
function drawLineZone(page: PDFPage, zone: PdfZone, box: Box) {
	const color = zone.strokeColor
		? hexToRgb(zone.strokeColor)
		: hexToRgb(zone.style.color);
	const y = box.topYPt - box.hPt / 2;
	page.drawLine({
		color,
		end: { x: box.xPt + box.wPt, y },
		start: { x: box.xPt, y },
		thickness: zone.strokeWidth ?? 1,
	});
}

function drawPageNumberZone(
	page: PDFPage,
	zone: PdfZone,
	box: Box,
	font: PDFFont,
	deps: DrawDeps
) {
	const text = pageNumberText(zone.content, zone.page, deps.totalPages);
	drawTextInBox(page, text, box, zone.style, font);
}

/** Generates a QR PNG for the zone's (mention-resolved) text and embeds it, scaled to fill the box. */
async function drawQrZone(
	doc: PDFDocument,
	page: PDFPage,
	zone: PdfZone,
	box: Box,
	deps: DrawDeps
) {
	const text = resolveMentions(zone.content ?? "", deps.mentionValues, {
		mode: "text",
	});
	if (!text) {
		return;
	}
	const pixels = Math.max(
		64,
		Math.min(1024, Math.round(Math.min(box.wPt, box.hPt) * 4))
	);
	let png: Uint8Array;
	try {
		png = await QRCode.toBuffer(text, {
			margin: 1,
			type: "png",
			width: pixels,
		});
	} catch (error) {
		console.error("[pdf] failed to generate QR code", zone.id, error);
		return;
	}
	const image = await doc.embedPng(png);
	drawImageInBox(page, image, box, "center");
}

async function drawZone(
	doc: PDFDocument,
	page: PDFPage,
	zone: PdfZone,
	box: Box,
	font: PDFFont,
	deps: DrawDeps
) {
	switch (zone.type) {
		case "field":
			drawFieldZone(page, zone, box, font, deps);
			return;
		case "static":
			drawStaticZone(page, zone, box, font, deps);
			return;
		case "meta":
			drawMetaZone(page, zone, box, font, deps);
			return;
		case "checkbox":
			drawCheckboxZone(page, zone, box, font, deps);
			return;
		case "signature":
		case "image":
			await drawImageZone(doc, page, zone, box, deps);
			return;
		case "link":
			drawLinkZone(doc, page, zone, box, font, deps);
			return;
		case "line":
			drawLineZone(page, zone, box);
			return;
		case "rect":
			drawRectZone(page, zone, box);
			return;
		case "pagenumber":
			drawPageNumberZone(page, zone, box, font, deps);
			return;
		case "qrcode":
			await drawQrZone(doc, page, zone, box, deps);
			return;
		default:
	}
}

async function loadSourceDoc(services: Services, key: string) {
	const blob = await services.storage.get(key);
	if (!blob) {
		throw new Error("The uploaded PDF is missing from storage");
	}
	const bytes = new Uint8Array(await blob.arrayBuffer());
	return PDFDocumentClass.load(bytes, { ignoreEncryption: true });
}

/** Renders one submission's (or sample data's) PDF and returns the file bytes. */
export async function renderPdf(ctx: RenderContext): Promise<Uint8Array> {
	const doc = ctx.sourceFileKey
		? await loadSourceDoc(ctx.services, ctx.sourceFileKey)
		: await PDFDocumentClass.create();
	if (!ctx.sourceFileKey) {
		for (const page of ctx.pages) {
			doc.addPage([page.width, page.height]);
		}
	}
	doc.registerFontkit(fontkit);
	const fontBytes = await loadPdfFonts();
	const [regular, bold] = await Promise.all([
		doc.embedFont(fontBytes.regular, { subset: true }),
		doc.embedFont(fontBytes.bold, { subset: true }),
	]);
	const pdfPages = doc.getPages();

	const fieldsById = new Map(
		ctx.fields.map((field) => [field.id, field] as const)
	);
	const mentionValues: Record<string, string> = {};
	for (const field of ctx.fields) {
		const display = formatFieldValue(field, ctx.values[field.id]);
		mentionValues[field.id] =
			display === null ? "" : displayValueToText(display);
	}
	const deps: DrawDeps = {
		fieldsById,
		form: ctx.form,
		generatedAt: new Date(),
		mentionValues,
		services: ctx.services,
		submissionMeta: ctx.submissionMeta,
		totalPages: pdfPages.length,
		values: ctx.values,
	};

	// Drawn via a promise chain (not a `for` loop with `await`) so zones still
	// draw strictly in array order: later zones must layer on top of earlier
	// ones when boxes overlap.
	await ctx.zones.reduce(async (previous, zone) => {
		await previous;
		const page = pdfPages[zone.page];
		if (!page) {
			return;
		}
		const box = boxFor(page, zone);
		const font = zone.style.fontWeight === "bold" ? bold : regular;
		try {
			await drawZone(doc, page, zone, box, font, deps);
		} catch (error) {
			console.error("[pdf] failed to draw zone", zone.id, error);
		}
	}, Promise.resolve());

	return doc.save();
}

/** Reads a just-uploaded base PDF's page count and point sizes. */
export async function inspectUploadedPdf(bytes: Uint8Array) {
	const doc = await PDFDocumentClass.load(bytes, { ignoreEncryption: true });
	return doc.getPages().map((page) => ({
		height: page.getHeight(),
		width: page.getWidth(),
	}));
}
