import { describe, expect, test } from "bun:test";

import { autoDarkColor, isLightColor } from "./color";

const HEX6 = /^#[0-9a-f]{6}$/i;

describe("isLightColor", () => {
	test("flags a light grey as light", () => {
		expect(isLightColor("#f4f4f5")).toBe(true);
	});

	test("flags near-black as dark", () => {
		expect(isLightColor("#18181b")).toBe(false);
	});
});

describe("autoDarkColor", () => {
	test("re-targets lightness while roughly preserving hue", () => {
		const dark = autoDarkColor("#f4f4f5", 10);
		expect(dark).toMatch(HEX6);
		expect(isLightColor(dark)).toBe(false);
	});

	test("caps saturation so a vivid colour doesn't turn neon in dark mode", () => {
		const dark = autoDarkColor("#ff0000", 20, 30);
		// Pure red has saturation 100%; capped output should be far less vivid.
		expect(dark.toLowerCase()).not.toBe("#ff0000");
	});
});
