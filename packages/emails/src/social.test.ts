import { describe, expect, test } from "bun:test";

import {
	detectSocialNetwork,
	SOCIAL_NETWORKS,
	type SocialNetworkId,
	socialIconPath,
} from "./social";

describe("detectSocialNetwork", () => {
	const cases: [string, SocialNetworkId][] = [
		["https://www.facebook.com/acme", "facebook"],
		["instagram.com/acme", "instagram"],
		["https://x.com/acme", "x"],
		["https://twitter.com/acme", "x"],
		["linkedin.com/company/acme", "linkedin"],
		["youtu.be/abc123", "youtube"],
		["t.me/acme", "telegram"],
		["wa.me/15551234567", "whatsapp"],
		["github.com/acme", "github"],
	];

	test.each(cases)("detects %s as %s", (url, expected) => {
		expect(detectSocialNetwork(url)).toBe(expected);
	});

	test("falls back to email for a bare address", () => {
		expect(detectSocialNetwork("hello@acme.com")).toBe("email");
	});

	test("falls back to website for an unrecognised domain", () => {
		expect(detectSocialNetwork("acme.com")).toBe("website");
	});

	test("falls back to website for blank input", () => {
		expect(detectSocialNetwork("")).toBe("website");
	});
});

const HEX6 = /^#[0-9a-f]{6}$/i;

describe("SOCIAL_NETWORKS", () => {
	test("every network has a brand colour and a short monogram", () => {
		for (const network of Object.values(SOCIAL_NETWORKS)) {
			expect(network.brandColor).toMatch(HEX6);
			expect(network.monogram.length).toBeGreaterThan(0);
			expect(network.monogram.length).toBeLessThanOrEqual(2);
		}
	});
});

describe("socialIconPath", () => {
	test("builds a deterministic relative URL", () => {
		expect(socialIconPath("facebook", "brand", 28)).toBe(
			"/api/email-assets/social-icon/facebook.png?size=28&style=brand"
		);
	});

	test("includes colour only for the mono style", () => {
		expect(socialIconPath("facebook", "mono", 28, "#123456")).toContain(
			"color=%23123456"
		);
		expect(socialIconPath("facebook", "brand", 28, "#123456")).not.toContain(
			"color"
		);
	});
});
