import type { FormField } from "@StryveForms/forms/types";
import { describe, expect, it } from "bun:test";

import {
	autoZonesForFields,
	blankPages,
	pageNumberText,
	pagePoints,
	pdfZoneSchema,
	renderFilenamePattern,
} from "./model";

describe("pagePoints / blankPages", () => {
	it("swaps width and height for landscape", () => {
		const portrait = pagePoints("A4", "portrait");
		const landscape = pagePoints("A4", "landscape");
		expect(landscape.width).toBe(portrait.height);
		expect(landscape.height).toBe(portrait.width);
	});

	it("creates the requested number of pages with matching size", () => {
		const pages = blankPages(3, "Letter", "portrait");
		expect(pages).toHaveLength(3);
		expect(pages.every((p) => p.size === "Letter" && p.width === 612)).toBe(
			true
		);
	});

	it("clamps page count to a sane range", () => {
		expect(blankPages(0, "A4", "portrait")).toHaveLength(1);
		expect(blankPages(999, "A4", "portrait")).toHaveLength(50);
	});
});

describe("renderFilenamePattern", () => {
	const ctx = {
		date: "2026-10-22",
		formTitle: "Kitchen Sink",
		submissionId: "abc-123",
		templateName: "Invoice",
	};

	it("substitutes known tokens and appends .pdf", () => {
		expect(renderFilenamePattern("{form_title}-{submission_id}", ctx)).toBe(
			"Kitchen Sink-abc-123.pdf"
		);
	});

	it("falls back to the default pattern when empty", () => {
		expect(renderFilenamePattern("", ctx)).toBe("Kitchen Sink-abc-123.pdf");
		expect(renderFilenamePattern(undefined, ctx)).toBe(
			"Kitchen Sink-abc-123.pdf"
		);
	});

	it("sanitizes unsafe filename characters", () => {
		expect(renderFilenamePattern("{form_title}/../etc", ctx)).toBe(
			"Kitchen Sink_.._etc.pdf"
		);
	});

	it("leaves unknown tokens untouched", () => {
		expect(renderFilenamePattern("{nope}-{submission_id}", ctx)).toBe(
			"_nope_-abc-123.pdf"
		);
	});

	it("doesn't double up an already-present .pdf extension", () => {
		expect(renderFilenamePattern("report.pdf", ctx)).toBe("report.pdf");
	});
});

describe("autoZonesForFields", () => {
	const fields: FormField[] = [
		{ id: "name", name: "Name", type: "text" },
		{ id: "email", name: "Email", type: "email" },
		{ id: "sig", name: "Signature", type: "signature" },
		{ id: "doc", name: "Attachment", type: "files" },
	];

	it("creates a label + value zone pair per eligible field, skipping files", () => {
		const { zones } = autoZonesForFields(fields);
		// name + email + signature = 3 fields * 2 zones; "doc" (files) is skipped
		expect(zones).toHaveLength(6);
		expect(zones.filter((z) => z.type === "static")).toHaveLength(3);
		expect(
			zones.find((z) => z.fieldId === "sig" && z.type === "signature")?.type
		).toBe("signature");
		expect(zones.some((z) => z.fieldId === "doc")).toBe(false);
	});

	it("tags the label zone with the field id too, so the editor can group label + answer together", () => {
		const { zones } = autoZonesForFields(fields);
		const label = zones.find(
			(z) => z.type === "static" && z.content === "Name"
		);
		const value = zones.find((z) => z.type === "field" && z.fieldId === "name");
		expect(label?.fieldId).toBe("name");
		expect(value?.fieldId).toBe("name");
	});

	it("keeps every zone within the page bounds", () => {
		const { zones } = autoZonesForFields(fields);
		for (const zone of zones) {
			expect(zone.y).toBeGreaterThanOrEqual(0);
			expect(zone.y + zone.h).toBeLessThanOrEqual(1);
		}
	});

	it("overflows onto additional pages for many fields", () => {
		const many: FormField[] = Array.from({ length: 40 }, (_, i) => ({
			id: `f${i}`,
			name: `Field ${i}`,
			type: "text",
		}));
		const { pageCount, zones } = autoZonesForFields(many);
		expect(pageCount).toBeGreaterThan(1);
		expect(new Set(zones.map((z) => z.page)).size).toBe(pageCount);
	});
});

describe("pageNumberText", () => {
	it("defaults to 'Page {n} of {total}'", () => {
		expect(pageNumberText(undefined, 0, 5)).toBe("Page 1 of 5");
		expect(pageNumberText("", 2, 5)).toBe("Page 3 of 5");
	});

	it("substitutes a custom pattern, 1-indexing the page", () => {
		expect(pageNumberText("{n}/{total}", 0, 3)).toBe("1/3");
		expect(pageNumberText("p. {n}", 4, 10)).toBe("p. 5");
	});

	it("leaves a pattern with no tokens untouched", () => {
		expect(pageNumberText("Draft", 0, 1)).toBe("Draft");
	});
});

const baseZone = {
	h: 0.1,
	id: "zone-1",
	page: 0,
	style: {
		align: "left" as const,
		color: "#111111",
		fontSize: 10,
		fontWeight: "normal" as const,
		lineHeight: 1.3,
		overflow: "shrink" as const,
	},
	w: 0.2,
	x: 0.1,
	y: 0.1,
};

describe("pdfZoneSchema - new element types", () => {
	it("accepts a link zone (display text + URL)", () => {
		const result = pdfZoneSchema.safeParse({
			...baseZone,
			content: "Open form",
			linkUrl: "https://example.com",
			type: "link",
		});
		expect(result.success).toBe(true);
	});

	it("accepts a line zone (stroke colour + width)", () => {
		const result = pdfZoneSchema.safeParse({
			...baseZone,
			strokeColor: "#9ca3af",
			strokeWidth: 2,
			type: "line",
		});
		expect(result.success).toBe(true);
	});

	it("accepts a rect zone (fill/border/radius)", () => {
		const result = pdfZoneSchema.safeParse({
			...baseZone,
			cornerRadius: 8,
			fillColor: "#eef2ff",
			fillOpacity: 0.8,
			strokeColor: "#6366f1",
			strokeWidth: 1,
			type: "rect",
		});
		expect(result.success).toBe(true);
	});

	it("accepts a qrcode zone (encoded content)", () => {
		const result = pdfZoneSchema.safeParse({
			...baseZone,
			content: "https://example.com",
			type: "qrcode",
		});
		expect(result.success).toBe(true);
	});

	it("accepts a pagenumber zone (format pattern)", () => {
		const result = pdfZoneSchema.safeParse({
			...baseZone,
			content: "Page {n} of {total}",
			type: "pagenumber",
		});
		expect(result.success).toBe(true);
	});

	it("rejects an unknown zone type", () => {
		const result = pdfZoneSchema.safeParse({ ...baseZone, type: "bogus" });
		expect(result.success).toBe(false);
	});
});
