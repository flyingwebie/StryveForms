import { describe, expect, test } from "bun:test";

import { getCachedSocialIconPng, renderSocialIconPng } from "./social-icon";

const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

describe("renderSocialIconPng", () => {
	test("produces a valid PNG signature and IHDR for the requested size", () => {
		const png = renderSocialIconPng("facebook", "brand", 32);
		expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
		// IHDR chunk: 4-byte length, "IHDR", width (4B), height (4B)...
		expect(png.readUInt32BE(8 + 4)).toBe(0x49_48_44_52); // "IHDR"
		expect(png.readUInt32BE(16)).toBe(32); // width
		expect(png.readUInt32BE(20)).toBe(32); // height
	});

	test("clamps size into the supported range", () => {
		const tooSmall = renderSocialIconPng("github", "muted", 1);
		expect(tooSmall.readUInt32BE(16)).toBe(16);
		const tooBig = renderSocialIconPng("github", "muted", 1000);
		expect(tooBig.readUInt32BE(16)).toBe(128);
	});

	test("mono style uses the provided colour, not the brand colour", () => {
		const brand = renderSocialIconPng("facebook", "brand", 32);
		const mono = renderSocialIconPng("facebook", "mono", 32, "#ff00ff");
		expect(Buffer.compare(brand, mono)).not.toBe(0);
	});
});

describe("getCachedSocialIconPng", () => {
	test("returns the identical buffer instance for the same key", () => {
		const first = getCachedSocialIconPng("x", "brand", 24);
		const second = getCachedSocialIconPng("x", "brand", 24);
		expect(first).toBe(second);
	});
});
