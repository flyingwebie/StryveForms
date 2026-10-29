/**
 * Exercises renderPdf end-to-end for every zone type (including the new
 * link/line/rect/qrcode/pagenumber elements added alongside the existing
 * field/static/meta/checkbox/image/signature ones), against a blank
 * in-memory template, to catch drawing crashes and sanity-check the output.
 */

import type { FormField } from "@StryveForms/forms/types";
import { describe, expect, it } from "bun:test";

import type { Services } from "../../context";
import type { StorageDriver } from "../storage";
import {
	DEFAULT_VALUE_STYLE,
	type PdfPage,
	type PdfZone,
	type PdfZoneStyle,
} from "./model";
import { renderPdf } from "./render";

const style: PdfZoneStyle = { ...DEFAULT_VALUE_STYLE };

/** A 1x1 red PNG, used as the "uploaded" file behind image/signature zones. */
const ONE_PX_PNG = Uint8Array.from(
	atob(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
	),
	(c) => c.charCodeAt(0)
);

function fakeStorage(): StorageDriver {
	const files = new Map<string, Uint8Array>([
		["forms/f1/submissions/pic.png", ONE_PX_PNG],
	]);
	return {
		delete: () => Promise.resolve(),
		exists: (key) => Promise.resolve(files.has(key)),
		get: (key) => {
			const bytes = files.get(key);
			return Promise.resolve(bytes ? new Blob([bytes]) : null);
		},
		// Minimal stand-ins for the streaming methods backup/export added to
		// StorageDriver (services/backup) — unused by this PDF-rendering test.
		getStream: (key) => {
			const bytes = files.get(key);
			return Promise.resolve(
				bytes
					? new ReadableStream<Uint8Array>({
							start(controller) {
								controller.enqueue(bytes);
								controller.close();
							},
						})
					: null
			);
		},
		list: () => Promise.resolve(Array.from(files.keys())),
		put: () => Promise.resolve(),
		putStream: () => Promise.resolve(),
		size: (key) => Promise.resolve(files.get(key)?.length ?? null),
	};
}

function services(): Services {
	return {
		config: {
			appName: "StryveForms",
			appUrl: "https://example.com",
			captcha: {},
			importRateLimitPerMinute: 60,
			serverUrl: "https://example.com",
			signingSecret: "test",
		},
		mailer: {} as Services["mailer"],
		storage: fakeStorage(),
	};
}

const fields: FormField[] = [
	{ id: "name", name: "Name", type: "text" },
	{ id: "sig", name: "Signature", type: "signature" },
	{ id: "pic", name: "Photo", type: "files" },
];

const pages: PdfPage[] = [
	{ height: 841.89, orientation: "portrait", size: "A4", width: 595.28 },
];

function zone(
	partial: Partial<PdfZone> & Pick<PdfZone, "id" | "type">
): PdfZone {
	return {
		h: 0.1,
		page: 0,
		style,
		w: 0.3,
		x: 0.1,
		y: 0.1,
		...partial,
	};
}

describe("renderPdf - new element types", () => {
	it("draws a link zone with a clickable URL annotation", async () => {
		const bytes = await renderPdf({
			fields,
			form: { id: "f1", title: "Kitchen Sink" },
			pages,
			services: services(),
			sourceFileKey: null,
			submissionMeta: { createdAt: new Date(), publicId: "sub-1" },
			values: {},
			zones: [
				zone({
					content: "Visit us",
					id: "z-link",
					linkUrl: "https://example.com",
					type: "link",
				}),
			],
		});
		expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
	});

	it("ignores an unsafe link scheme (no annotation, no crash)", async () => {
		const bytes = await renderPdf({
			fields,
			form: { id: "f1", title: "Kitchen Sink" },
			pages,
			services: services(),
			sourceFileKey: null,
			submissionMeta: { createdAt: new Date(), publicId: "sub-1" },
			values: {},
			zones: [
				zone({
					content: "Nope",
					id: "z-link-bad",
					linkUrl: "javascript:alert(1)",
					type: "link",
				}),
			],
		});
		expect(bytes.byteLength).toBeGreaterThan(0);
	});

	it("draws a line divider", async () => {
		const bytes = await renderPdf({
			fields,
			form: { id: "f1", title: "Kitchen Sink" },
			pages,
			services: services(),
			sourceFileKey: null,
			submissionMeta: { createdAt: new Date(), publicId: "sub-1" },
			values: {},
			zones: [
				zone({
					h: 0.004,
					id: "z-line",
					strokeColor: "#9ca3af",
					strokeWidth: 2,
					type: "line",
					w: 0.5,
				}),
			],
		});
		expect(bytes.byteLength).toBeGreaterThan(0);
	});

	it("draws a rounded rect with fill and border", async () => {
		const bytes = await renderPdf({
			fields,
			form: { id: "f1", title: "Kitchen Sink" },
			pages,
			services: services(),
			sourceFileKey: null,
			submissionMeta: { createdAt: new Date(), publicId: "sub-1" },
			values: {},
			zones: [
				zone({
					cornerRadius: 8,
					fillColor: "#eef2ff",
					fillOpacity: 0.8,
					id: "z-rect",
					strokeColor: "#6366f1",
					strokeWidth: 1,
					type: "rect",
				}),
			],
		});
		expect(bytes.byteLength).toBeGreaterThan(0);
	});

	it("draws a rect with border only (no fillColor)", async () => {
		const bytes = await renderPdf({
			fields,
			form: { id: "f1", title: "Kitchen Sink" },
			pages,
			services: services(),
			sourceFileKey: null,
			submissionMeta: { createdAt: new Date(), publicId: "sub-1" },
			values: {},
			zones: [zone({ id: "z-rect-2", strokeColor: "#000000", type: "rect" })],
		});
		expect(bytes.byteLength).toBeGreaterThan(0);
	});

	it("embeds a generated QR code image", async () => {
		const bytes = await renderPdf({
			fields,
			form: { id: "f1", title: "Kitchen Sink" },
			pages,
			services: services(),
			sourceFileKey: null,
			submissionMeta: { createdAt: new Date(), publicId: "sub-1" },
			values: {},
			zones: [
				zone({
					content: "https://example.com/s/sub-1",
					id: "z-qr",
					type: "qrcode",
				}),
			],
		});
		expect(bytes.byteLength).toBeGreaterThan(200);
	});

	it("skips a qrcode zone with empty content", async () => {
		const bytes = await renderPdf({
			fields,
			form: { id: "f1", title: "Kitchen Sink" },
			pages,
			services: services(),
			sourceFileKey: null,
			submissionMeta: { createdAt: new Date(), publicId: "sub-1" },
			values: {},
			zones: [zone({ id: "z-qr-empty", type: "qrcode" })],
		});
		expect(bytes.byteLength).toBeGreaterThan(0);
	});

	it("formats a pagenumber zone with the default pattern", async () => {
		const bytes = await renderPdf({
			fields,
			form: { id: "f1", title: "Kitchen Sink" },
			pages,
			services: services(),
			sourceFileKey: null,
			submissionMeta: { createdAt: new Date(), publicId: "sub-1" },
			values: {},
			zones: [zone({ id: "z-pn", type: "pagenumber" })],
		});
		expect(bytes.byteLength).toBeGreaterThan(0);
	});

	it("draws a meta zone showing the generation timestamp", async () => {
		const bytes = await renderPdf({
			fields,
			form: { id: "f1", title: "Kitchen Sink" },
			pages,
			services: services(),
			sourceFileKey: null,
			submissionMeta: { createdAt: new Date(), publicId: "sub-1" },
			values: {},
			zones: [zone({ id: "z-meta", metaKey: "generated_at", type: "meta" })],
		});
		expect(bytes.byteLength).toBeGreaterThan(0);
	});

	it("draws an image zone sourced from a field's uploaded file", async () => {
		const bytes = await renderPdf({
			fields,
			form: { id: "f1", title: "Kitchen Sink" },
			pages,
			services: services(),
			sourceFileKey: null,
			submissionMeta: { createdAt: new Date(), publicId: "sub-1" },
			values: { pic: "pic.png" },
			zones: [zone({ fieldId: "pic", id: "z-img", type: "image" })],
		});
		expect(bytes.byteLength).toBeGreaterThan(200);
	});

	it("renders every new zone type together without throwing", async () => {
		const bytes = await renderPdf({
			fields,
			form: { id: "f1", title: "Kitchen Sink" },
			pages,
			services: services(),
			sourceFileKey: null,
			submissionMeta: { createdAt: new Date(), publicId: "sub-1" },
			values: { name: "Jane" },
			zones: [
				zone({
					id: "z1",
					type: "link",
					content: "Docs",
					linkUrl: "https://example.com",
				}),
				zone({ id: "z2", type: "line", y: 0.3 }),
				zone({ id: "z3", type: "rect", y: 0.4, fillColor: "#eee" }),
				zone({ id: "z4", type: "qrcode", y: 0.55, content: "hello" }),
				zone({ id: "z5", type: "pagenumber", y: 0.9 }),
			],
		});
		expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
	});
});
