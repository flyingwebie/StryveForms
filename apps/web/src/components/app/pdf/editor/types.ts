import {
	DEFAULT_PAGE_NUMBER_PATTERN,
	DEFAULT_VALUE_STYLE,
	newZoneId,
	type PdfPage,
	type PdfZone,
	type PdfZoneType,
} from "@StryveForms/api/services/pdf/model";
import type { FormField } from "@StryveForms/forms/types";
import {
	AlignLeftIcon,
	CheckSquareIcon,
	HashIcon,
	ImageIcon,
	InfoIcon,
	LinkIcon,
	MinusIcon,
	PenLineIcon,
	QrCodeIcon,
	SquareIcon,
	TypeIcon,
} from "lucide-react";

/** The editor's in-memory copy of a template: what gets PUT back on save. */
export interface PdfTemplateDraft {
	enabled: boolean;
	filenamePattern: string;
	name: string;
	pages: PdfPage[];
	settings: Record<string, unknown>;
	zones: PdfZone[];
}

const DEFAULT_ZONE_SIZE = { h: 0.04, w: 0.3 };

/** A new zone of the given type, with size/defaults that make sense for it, centered-ish on the current page. */
export function createZone(type: PdfZoneType, page: number): PdfZone {
	const base = {
		id: newZoneId(),
		page,
		style: { ...DEFAULT_VALUE_STYLE },
		x: 0.1,
		y: 0.1,
	};
	switch (type) {
		case "image":
		case "signature":
			return { ...base, h: 0.12, type, w: 0.25 };
		case "qrcode":
			return { ...base, content: "", h: 0.15, type, w: 0.15 };
		case "line":
			return {
				...base,
				h: 0.004,
				strokeColor: "#9ca3af",
				strokeWidth: 1,
				type,
				w: 0.4,
			};
		case "rect":
			return {
				...base,
				cornerRadius: 6,
				fillColor: "#eef2ff",
				fillOpacity: 1,
				h: 0.12,
				strokeColor: "#6366f1",
				strokeWidth: 1,
				type,
				w: 0.3,
			};
		case "link":
			return {
				...base,
				content: "",
				h: 0.03,
				linkUrl: "",
				style: { ...DEFAULT_VALUE_STYLE, color: "#2563eb" },
				type,
				w: 0.3,
			};
		case "pagenumber":
			return {
				...base,
				content: DEFAULT_PAGE_NUMBER_PATTERN,
				h: 0.025,
				style: { ...DEFAULT_VALUE_STYLE, align: "center" },
				type,
				w: 0.2,
				x: 0.4,
				y: 0.95,
			};
		default:
			return { ...base, h: DEFAULT_ZONE_SIZE.h, type, w: DEFAULT_ZONE_SIZE.w };
	}
}

export const ZONE_TYPE_LABELS: Record<PdfZoneType, string> = {
	checkbox: "Checkbox mark",
	field: "Field answer",
	image: "Image",
	link: "Link",
	line: "Line / divider",
	meta: "Submission info",
	pagenumber: "Page number",
	qrcode: "QR code",
	rect: "Box / rectangle",
	signature: "Signature",
	static: "Static text",
};

/** One plain-language sentence per zone type, shown in the "Add zone" menu. */
export const ZONE_TYPE_DESCRIPTIONS: Record<PdfZoneType, string> = {
	checkbox: "Draws a checkmark when a field's answer matches a value.",
	field: "Shows one question's answer.",
	image: "A fixed picture, or a photo from an upload/signature field.",
	link: "Clickable text that opens a URL in a PDF viewer.",
	line: "A straight horizontal divider line.",
	meta: "Submission id, date, form title, or when the PDF was generated.",
	pagenumber: 'Shows the page number, e.g. "Page 2 of 5".',
	qrcode: "A scannable QR code for text or a URL (supports @ mentions).",
	rect: "A filled and/or outlined box, e.g. a background panel.",
	signature: "Places the drawn signature from a signature field.",
	static: 'Fixed text you write yourself — type "@" to insert an answer.',
};

/** Icon shown for each zone type, on the canvas and in the zones list. */
export const ZONE_ICONS: Record<PdfZone["type"], typeof TypeIcon> = {
	checkbox: CheckSquareIcon,
	field: TypeIcon,
	image: ImageIcon,
	link: LinkIcon,
	line: MinusIcon,
	meta: InfoIcon,
	pagenumber: HashIcon,
	qrcode: QrCodeIcon,
	rect: SquareIcon,
	signature: PenLineIcon,
	static: AlignLeftIcon,
};

const STRIP_TAGS = /<[^>]+>/g;

/**
 * The field a "static" zone is the label for, if any: either the stored
 * fieldId grouping hint (new auto-generated templates), or — for older
 * templates created before that hint existed — a case-insensitive match
 * between the zone's plain text and a field's name. Returns undefined for a
 * static zone that's just freestanding text.
 */
export function staticLabelFieldMatch(
	zone: PdfZone,
	fields: FormField[]
): FormField | undefined {
	if (zone.type !== "static") {
		return undefined;
	}
	if (zone.fieldId) {
		return fields.find((f) => f.id === zone.fieldId);
	}
	const text = (zone.content ?? "")
		.replace(STRIP_TAGS, "")
		.trim()
		.toLowerCase();
	if (!text) {
		return undefined;
	}
	return fields.find((f) => f.name.trim().toLowerCase() === text);
}

const GRID = 0.01;

export function snap(value: number): number {
	return Math.round(value / GRID) * GRID;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
