import { describe, expect, test } from "bun:test";

import {
	findHostedAssets,
	mapForm,
	mapIntegration,
	mapSubmission,
	parseDate,
	replaceUrls,
	storedFileName,
} from "./map";
import type { OpnformForm, OpnformSubmission } from "./types";

const form: OpnformForm = {
	id: 42,
	slug: "contact-us-ab12cd",
	title: "Contact Us",
	theme: "notion",
	size: "huge",
	dark_mode: "auto",
	color: "#ff0000",
	seo_meta: [],
	cover_picture: "https://api.opnform.com/forms/assets/cover.jpg",
	password: "secret",
	views_count: 1520,
	closes_at: "2026-12-01T00:00:00+00:00",
	captcha_provider: "hcaptcha",
	properties: [
		{ id: "name", name: "Name", type: "text" },
		{ id: "cv", name: "CV", type: "files", multiple: true },
		{ id: "sig", name: "Signature", type: "signature" },
		{ id: "phone", name: "Phone", type: "phone_number" },
		{
			id: "img",
			name: "Image",
			type: "nf-image",
			image_block: "https://api.opnform.com/forms/assets/x.png",
		},
	],
};

const GENERATED_NAME = /^report_[0-9a-f-]{36}\.pdf$/;

describe("mapForm", () => {
	test("maps and clamps settings", () => {
		const mapped = mapForm(form);
		expect(mapped.settings.theme).toBe("notion");
		expect(mapped.settings.size).toBe("md");
		expect(mapped.settings.seoMeta).toEqual({});
		expect(mapped.password).toBe("secret");
		expect(mapped.viewsCount).toBe(1520);
		expect(mapped.settings.closesAt).toBe("2026-12-01T00:00:00.000Z");
		expect(mapped.legacySlug).toBe("contact-us-ab12cd");
	});

	test("finds and rewrites hosted assets", () => {
		const isHosted = (u: string) => u.includes("/forms/assets/");
		const assets = findHostedAssets(form, isHosted);
		expect(assets.sort()).toEqual([
			"https://api.opnform.com/forms/assets/cover.jpg",
			"https://api.opnform.com/forms/assets/x.png",
		]);
		const rewritten = replaceUrls(
			form,
			new Map([[assets[0] as string, "https://new/a.png"]])
		);
		expect(JSON.stringify(rewritten)).toContain("https://new/a.png");
	});
});

describe("mapSubmission", () => {
	const submission: OpnformSubmission = {
		id: 9001,
		form_id: 42,
		submission_id: "b6a1f3d2-1111-4222-8333-944455556666",
		completion_time: 47,
		meta: { attribution: { utm_source: "google" } },
		data: {
			name: "Jane",
			cv: [
				{
					file_url: "https://api.opnform.com/f/1?sig=x",
					file_name: "cv_123e4567-e89b-12d3-a456-426614174000.pdf",
				},
			],
			sig: [
				{
					file_url: "https://api.opnform.com/f/2?sig=x",
					file_name: "signature.png",
				},
			],
			phone: "US+12025550142",
			status: "completed",
			created_at: "2024-05-01 12:00:00",
			id: 9001,
			submission_id: "b6a1f3d2-1111-4222-8333-944455556666",
			ip_address: "1.2.3.4",
		},
	};

	test("cleans meta keys, maps files and phone numbers", () => {
		const mapped = mapSubmission(submission, form.properties);
		expect(Object.keys(mapped.data).sort()).toEqual([
			"cv",
			"name",
			"phone",
			"sig",
		]);
		expect(mapped.data.cv).toEqual([
			"cv_123e4567-e89b-12d3-a456-426614174000.pdf",
		]);
		expect(typeof mapped.data.sig).toBe("string");
		expect(mapped.data.phone).toBe("+12025550142");
		expect(mapped.files).toHaveLength(2);
		expect(mapped.meta).toMatchObject({
			attribution: { utm_source: "google" },
			ip_address: "1.2.3.4",
		});
		expect(mapped.createdAt.toISOString()).toBe("2024-05-01T12:00:00.000Z");
		expect(mapped.publicId).toBe("b6a1f3d2-1111-4222-8333-944455556666");
	});
});

describe("helpers", () => {
	test("stored file names", () => {
		expect(storedFileName("report.pdf")).toMatch(GENERATED_NAME);
		expect(storedFileName("a_123e4567-e89b-12d3-a456-426614174000.pdf")).toBe(
			"a_123e4567-e89b-12d3-a456-426614174000.pdf"
		);
	});

	test("dates", () => {
		expect(parseDate("bad")).toBeNull();
		expect(parseDate("2024-01-02 03:04:05")?.toISOString()).toBe(
			"2024-01-02T03:04:05.000Z"
		);
	});

	test("integrations", () => {
		expect(
			mapIntegration({
				id: 1,
				form_id: 1,
				integration_id: "google_sheets",
				status: "active",
				data: {},
				logic: null,
			})
		).toBeNull();
		const email = mapIntegration({
			id: 2,
			form_id: 1,
			integration_id: "email",
			status: "active",
			data: { send_to: "a@b.c" },
			logic: [] as never,
		});
		expect(email?.status).toBe("active");
		expect(email?.logic).toBeNull();
	});
});
