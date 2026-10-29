/**
 * PDF template model: pages and positioned "zones" that get drawn onto a
 * generated PDF (either an uploaded base PDF or blank pages) for a
 * submission. Pure and isomorphic (no pdf-lib/Node APIs) so both the server
 * (rendering) and the web editor (building/validating zones) can share it.
 *
 * Zone coordinates are stored as fractions (0–1) of the page, top-left
 * origin, independent of the page's absolute point size. This keeps zones
 * stable if a page's size ever changes and matches how the editor measures
 * things on screen (percentages of the rendered page image).
 */

import type { FormField } from "@StryveForms/forms/types";
import { z } from "zod";

export const PDF_PAGE_SIZES = ["A4", "Letter"] as const;
export type PdfPageSize = (typeof PDF_PAGE_SIZES)[number];

export const PDF_ORIENTATIONS = ["portrait", "landscape"] as const;
export type PdfOrientation = (typeof PDF_ORIENTATIONS)[number];

/** Page sizes in points (1/72 inch), portrait. */
export const PDF_PAGE_POINTS: Record<
	PdfPageSize,
	{ height: number; width: number }
> = {
	A4: { height: 841.89, width: 595.28 },
	Letter: { height: 792, width: 612 },
};

export function pagePoints(
	size: PdfPageSize,
	orientation: PdfOrientation
): { height: number; width: number } {
	const base = PDF_PAGE_POINTS[size];
	return orientation === "landscape"
		? { height: base.width, width: base.height }
		: base;
}

export interface PdfPage {
	height: number;
	orientation: PdfOrientation;
	size: PdfPageSize;
	width: number;
}

export function blankPages(
	count: number,
	size: PdfPageSize,
	orientation: PdfOrientation
): PdfPage[] {
	const { width, height } = pagePoints(size, orientation);
	const n = Math.min(50, Math.max(1, Math.trunc(count) || 1));
	return Array.from({ length: n }, () => ({
		height,
		orientation,
		size,
		width,
	}));
}

export const PDF_ZONE_TYPES = [
	"field",
	"static",
	"meta",
	"image",
	"checkbox",
	"signature",
	"link",
	"line",
	"rect",
	"qrcode",
	"pagenumber",
] as const;
export type PdfZoneType = (typeof PDF_ZONE_TYPES)[number];

export const PDF_TEXT_ALIGNS = ["left", "center", "right"] as const;
export type PdfTextAlign = (typeof PDF_TEXT_ALIGNS)[number];

export const PDF_TEXT_OVERFLOWS = ["shrink", "wrap", "clip"] as const;
export type PdfTextOverflow = (typeof PDF_TEXT_OVERFLOWS)[number];

export const PDF_FONT_WEIGHTS = ["normal", "bold"] as const;
export type PdfFontWeight = (typeof PDF_FONT_WEIGHTS)[number];

export const PDF_META_KEYS = [
	"submission_id",
	"submitted_at",
	"form_title",
	"generated_at",
] as const;
export type PdfMetaKey = (typeof PDF_META_KEYS)[number];

export interface PdfZoneStyle {
	align: PdfTextAlign;
	color: string;
	fontSize: number;
	fontWeight: PdfFontWeight;
	lineHeight: number;
	overflow: PdfTextOverflow;
}

export const DEFAULT_VALUE_STYLE: PdfZoneStyle = {
	align: "left",
	color: "#111111",
	fontSize: 10,
	fontWeight: "normal",
	lineHeight: 1.3,
	overflow: "shrink",
};

export const DEFAULT_LABEL_STYLE: PdfZoneStyle = {
	align: "left",
	color: "#6b7280",
	fontSize: 8,
	fontWeight: "bold",
	lineHeight: 1.2,
	overflow: "clip",
};

export interface PdfZone {
	/** For "checkbox" zones against a select/multi_select field: the option to match. */
	checkboxValue?: string;
	/**
	 * Text content: static text, a "link" zone's display text, a "qrcode"
	 * zone's encoded text/URL, or a "pagenumber" zone's format pattern
	 * (tokens "{n}" and "{total}"). Supports @mention spans where noted.
	 */
	content?: string;
	/** "rect": corner radius in points. */
	cornerRadius?: number;
	/**
	 * The bound field, for "field"/"checkbox"/"signature" zones, and
	 * optionally "image" zones (draws the field's uploaded file instead of a
	 * fixed imageKey). Also set (for grouping only, ignored by rendering) on
	 * an auto-generated "static" label zone paired with a "field" zone.
	 */
	fieldId?: string;
	/** "rect": fill colour (omit for no fill, border-only). */
	fillColor?: string;
	/** "rect": fill opacity, 0-1. */
	fillOpacity?: number;
	h: number;
	id: string;
	/** For "image" zones with no fieldId: a fixed asset storage key. */
	imageKey?: string;
	/** "link": destination URL, resolved like `content` (supports @mentions). */
	linkUrl?: string;
	metaKey?: PdfMetaKey;
	page: number;
	/** "line"/"rect": stroke colour. */
	strokeColor?: string;
	/** "line"/"rect": stroke width in points. */
	strokeWidth?: number;
	style: PdfZoneStyle;
	type: PdfZoneType;
	w: number;
	x: number;
	y: number;
}

export const pdfZoneStyleSchema = z.object({
	align: z.enum(PDF_TEXT_ALIGNS),
	color: z.string().max(20),
	fontSize: z.number().min(4).max(96),
	fontWeight: z.enum(PDF_FONT_WEIGHTS),
	lineHeight: z.number().min(0.8).max(3),
	overflow: z.enum(PDF_TEXT_OVERFLOWS),
});

export const pdfZoneSchema = z.object({
	checkboxValue: z.string().max(200).optional(),
	content: z.string().max(5000).optional(),
	cornerRadius: z.number().min(0).max(300).optional(),
	fieldId: z.string().max(200).optional(),
	fillColor: z.string().max(20).optional(),
	fillOpacity: z.number().min(0).max(1).optional(),
	h: z.number().min(0.002).max(1),
	id: z.string().min(1).max(100),
	imageKey: z.string().max(500).optional(),
	linkUrl: z.string().max(2000).optional(),
	metaKey: z.enum(PDF_META_KEYS).optional(),
	page: z.number().int().min(0).max(49),
	strokeColor: z.string().max(20).optional(),
	strokeWidth: z.number().min(0).max(60).optional(),
	style: pdfZoneStyleSchema,
	type: z.enum(PDF_ZONE_TYPES),
	w: z.number().min(0.002).max(1),
	x: z.number().min(-0.5).max(1.5),
	y: z.number().min(-0.5).max(1.5),
});

export const pdfPageSchema = z.object({
	height: z.number().min(50).max(5000),
	orientation: z.enum(PDF_ORIENTATIONS),
	size: z.enum(PDF_PAGE_SIZES),
	width: z.number().min(50).max(5000),
});

export const pdfTemplateSettingsSchema = z
	.object({
		attachToEmail: z.boolean().optional(),
	})
	.catchall(z.unknown());

export function newZoneId(): string {
	return crypto.randomUUID();
}

/**
 * Lays out a "label above value" row for every answerable field, like
 * OpnForm's default auto-generated zones. Returns the zones plus the page
 * count they actually used (may exceed the page count the caller started
 * with, if there are many fields).
 */
export function autoZonesForFields(
	fields: FormField[],
	startPage = 0
): { pageCount: number; zones: PdfZone[] } {
	const eligible = fields.filter((field) => field.type !== "files");
	const marginX = 0.07;
	const width = 1 - marginX * 2;
	const labelH = 0.022;
	const valueH = 0.03;
	const signatureValueH = 0.09;
	const rowGap = 0.014;
	const top = 0.06;
	const bottom = 0.94;

	const zones: PdfZone[] = [];
	let page = startPage;
	let y = top;
	for (const field of eligible) {
		const isSignature = field.type === "signature";
		const vH = isSignature ? signatureValueH : valueH;
		const rowH = labelH + vH + rowGap;
		if (y + rowH > bottom && y > top) {
			page += 1;
			y = top;
		}
		zones.push({
			// fieldId here is a grouping hint only (ignored by rendering): it
			// lets the editor show this label zone next to its matching
			// answer zone instead of as two identically-named "Name" rows.
			fieldId: field.id,
			h: labelH,
			id: newZoneId(),
			page,
			style: { ...DEFAULT_LABEL_STYLE },
			type: "static",
			content: field.name,
			w: width,
			x: marginX,
			y,
		});
		zones.push({
			fieldId: field.id,
			h: vH,
			id: newZoneId(),
			page,
			style: { ...DEFAULT_VALUE_STYLE },
			type: isSignature ? "signature" : "field",
			w: width,
			x: marginX,
			y: y + labelH,
		});
		y += rowH;
	}
	return { pageCount: page + 1, zones };
}

/** Default "pagenumber" zone format pattern. */
export const DEFAULT_PAGE_NUMBER_PATTERN = "Page {n} of {total}";

const PAGE_NUMBER_TOKEN = /\{(n|total)\}/g;

/** Renders a "pagenumber" zone's pattern, replacing "{n}" and "{total}". */
export function pageNumberText(
	pattern: string | null | undefined,
	pageIndex: number,
	totalPages: number
): string {
	const source = pattern?.trim() || DEFAULT_PAGE_NUMBER_PATTERN;
	return source.replace(PAGE_NUMBER_TOKEN, (_full, token: string) =>
		token === "n" ? String(pageIndex + 1) : String(totalPages)
	);
}

/** Tokens available in a filename pattern, e.g. "{form_title}-{submission_id}". */
export const FILENAME_TOKENS = [
	"form_title",
	"submission_id",
	"date",
	"template_name",
] as const;
export type FilenameToken = (typeof FILENAME_TOKENS)[number];

export interface FilenameContext {
	date: string;
	formTitle: string;
	submissionId: string;
	templateName: string;
}

const TOKEN_PATTERN = /\{(\w+)\}/g;
const UNSAFE_FILENAME_CHARS = /[^a-zA-Z0-9\-_. ]+/g;
const COLLAPSE_SPACE = /\s+/g;

/** Renders a filename pattern and sanitizes the result into a safe `.pdf` file name. */
export function renderFilenamePattern(
	pattern: string | null | undefined,
	ctx: FilenameContext
): string {
	const map: Record<FilenameToken, string> = {
		date: ctx.date,
		form_title: ctx.formTitle,
		submission_id: ctx.submissionId,
		template_name: ctx.templateName,
	};
	const source = pattern?.trim() || "{form_title}-{submission_id}";
	const rendered = source.replace(TOKEN_PATTERN, (full, name: string) =>
		name in map ? map[name as FilenameToken] : full
	);
	const safe = rendered
		.replace(UNSAFE_FILENAME_CHARS, "_")
		.replace(COLLAPSE_SPACE, " ")
		.trim();
	const base = safe.length > 0 ? safe : "document";
	return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

/** Sample values used by "Preview with sample data" when no submission is chosen. */
export function sampleValueForField(field: FormField): unknown {
	switch (field.type) {
		case "checkbox":
			return true;
		case "number":
		case "rating":
		case "scale":
		case "slider":
			return field.rating_max_value ?? field.scale_max_value ?? 4;
		case "date":
			return new Date().toISOString();
		case "email":
			return "jane@example.com";
		case "phone_number":
			return "+1 555 0100";
		case "url":
			return "https://example.com";
		case "select":
		case "multi_select": {
			const option = (field.select ?? field.multi_select)?.options[0];
			const name = option?.name ?? "Sample";
			return field.type === "multi_select" ? [name] : name;
		}
		case "signature":
		case "files":
			return null;
		default:
			return `Sample ${field.name}`;
	}
}
