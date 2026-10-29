import { describe, expect, test } from "bun:test";
import {
	applyWorkspaceBrand,
	BRAND_KEYS,
	type FormBrandLink,
	isBrandInherited,
	NESTED_BRAND_KEYS,
	resolveClassicLayout,
	resolveTopImage,
	workspaceBrandSchema,
} from "./brand";

const FOLLOW: FormBrandLink = { brandOverrides: [], useWorkspaceBrand: true };

describe("workspaceBrandSchema", () => {
	test("accepts the round-5 layout/background/logo keys", () => {
		const result = workspaceBrandSchema.safeParse({
			backgroundImage: "https://example.com/bg.jpg",
			backgroundImageFit: "cover",
			backgroundOverlayOpacity: 40,
			frameBackgroundColor: "#ffffff",
			frameBorderWidth: 1,
			frameShadow: "md",
			headerImage: "https://example.com/header.jpg",
			headerImageHeight: 200,
			layout: "frameless",
			logoPictureDark: "https://example.com/dark.png",
			noBranding: true,
			pageBackgroundColor: "#111111",
		});
		expect(result.success).toBe(true);
	});

	test("every nested brand key is a real BrandKey", () => {
		for (const key of NESTED_BRAND_KEYS) {
			expect(BRAND_KEYS).toContain(key);
		}
	});
});

describe("isBrandInherited / applyWorkspaceBrand with new keys", () => {
	test("a form following the brand inherits layout and frame colours", () => {
		const brand = {
			frameBackgroundColor: "#f5f5f5",
			frameBorderColor: "#e5e5e5",
			layout: "frameless" as const,
		};
		expect(isBrandInherited("layout", FOLLOW, brand)).toBe(true);
		const merged = applyWorkspaceBrand(
			{ frameBackgroundColor: "#ffffff", layout: "framed" },
			FOLLOW,
			brand
		);
		expect(merged.layout).toBe("frameless");
		expect(merged.frameBackgroundColor).toBe("#f5f5f5");
	});

	test("an overridden key keeps the form's own value", () => {
		const brand = { layout: "frameless" as const };
		const link: FormBrandLink = {
			brandOverrides: ["layout"],
			useWorkspaceBrand: true,
		};
		const merged = applyWorkspaceBrand({ layout: "framed" }, link, brand);
		expect(merged.layout).toBe("framed");
	});

	test("a brand key the workspace never set is left alone", () => {
		const merged = applyWorkspaceBrand(
			{ headerImage: "https://example.com/mine.jpg" },
			FOLLOW,
			{}
		);
		expect(merged.headerImage).toBe("https://example.com/mine.jpg");
	});

	test("logoPictureDark inherits independently from logoPicture", () => {
		const brand = { logoPictureDark: "https://example.com/dark.png" };
		const merged = applyWorkspaceBrand(
			{
				logoPicture: "https://example.com/mine-light.png",
				logoPictureDark: null as string | null,
			},
			FOLLOW,
			brand
		);
		expect(merged.logoPicture).toBe("https://example.com/mine-light.png");
		expect(merged.logoPictureDark).toBe("https://example.com/dark.png");
	});

	test("noBranding is brand-governed like any other key", () => {
		const merged = applyWorkspaceBrand({ noBranding: false }, FOLLOW, {
			noBranding: true,
		});
		expect(merged.noBranding).toBe(true);
	});
});

describe("resolveTopImage (coverPicture/headerImage migration-on-read)", () => {
	test("prefers headerImage when both are set", () => {
		expect(
			resolveTopImage({
				coverPicture: "https://example.com/cover.jpg",
				headerImage: "https://example.com/header.jpg",
			})
		).toBe("https://example.com/header.jpg");
	});

	test("falls back to the legacy coverPicture when headerImage is unset", () => {
		expect(
			resolveTopImage({
				coverPicture: "https://example.com/cover.jpg",
				headerImage: null,
			})
		).toBe("https://example.com/cover.jpg");
	});

	test("returns null when neither is set", () => {
		expect(resolveTopImage({ coverPicture: null, headerImage: null })).toBe(
			null
		);
	});
});

describe("resolveClassicLayout (Classic layout migration-on-read)", () => {
	test("an explicit classicLayout always wins", () => {
		expect(
			resolveClassicLayout({
				backgroundImage: "https://example.com/bg.jpg",
				classicLayout: "card",
				layout: "frameless",
			})
		).toBe("card");
	});

	test("a plain framed form with no images migrates to card", () => {
		expect(resolveClassicLayout({ layout: "framed" })).toBe("card");
	});

	test("a framed form with a background image migrates to card-on-background", () => {
		expect(
			resolveClassicLayout({
				backgroundImage: "https://example.com/bg.jpg",
				layout: "framed",
			})
		).toBe("card-on-background");
	});

	test("a framed form with a header image migrates to card-with-header", () => {
		expect(
			resolveClassicLayout({
				headerImage: "https://example.com/header.jpg",
				layout: "framed",
			})
		).toBe("card-with-header");
	});

	test("a framed form with only the legacy coverPicture migrates to card-with-header", () => {
		expect(
			resolveClassicLayout({
				coverPicture: "https://example.com/cover.jpg",
				layout: "framed",
			})
		).toBe("card-with-header");
	});

	test("a frameless form migrates to header-image even with no banner uploaded yet", () => {
		expect(resolveClassicLayout({ layout: "frameless" })).toBe("header-image");
	});

	test("a frameless form with a header image still migrates to header-image", () => {
		expect(
			resolveClassicLayout({
				headerImage: "https://example.com/header.jpg",
				layout: "frameless",
			})
		).toBe("header-image");
	});

	test("defaults to card when layout itself was never set (new form)", () => {
		expect(resolveClassicLayout({})).toBe("card");
	});
});
