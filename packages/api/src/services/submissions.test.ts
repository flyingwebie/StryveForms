import { describe, expect, test } from "bun:test";

import { parseUserAgent } from "./submissions";

const CHROME_MAC =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const FIREFOX_WINDOWS =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0";
const EDGE_WINDOWS =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0";
const ANDROID_TABLET =
	"Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const ANDROID_PHONE =
	"Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";

describe("parseUserAgent", () => {
	test("desktop Chrome on macOS", () => {
		expect(parseUserAgent(CHROME_MAC)).toEqual({
			browser: "Chrome",
			device: "Desktop",
			os: "macOS",
		});
	});

	test("Safari on iPhone is Mobile/iOS", () => {
		expect(parseUserAgent(SAFARI_IPHONE)).toEqual({
			browser: "Safari",
			device: "Mobile",
			os: "iOS",
		});
	});

	test("Firefox on Windows", () => {
		expect(parseUserAgent(FIREFOX_WINDOWS)).toEqual({
			browser: "Firefox",
			device: "Desktop",
			os: "Windows",
		});
	});

	test("Edge is distinguished from Chrome despite sharing its token", () => {
		expect(parseUserAgent(EDGE_WINDOWS)).toEqual({
			browser: "Edge",
			device: "Desktop",
			os: "Windows",
		});
	});

	test("an Android device with no Mobile token is a Tablet", () => {
		expect(parseUserAgent(ANDROID_TABLET)).toEqual({
			browser: "Chrome",
			device: "Tablet",
			os: "Android",
		});
	});

	test("an Android device with a Mobile token is a Mobile", () => {
		expect(parseUserAgent(ANDROID_PHONE)).toEqual({
			browser: "Chrome",
			device: "Mobile",
			os: "Android",
		});
	});

	test("an unrecognised user agent falls back to Unknown/Desktop", () => {
		expect(parseUserAgent("some-bot/1.0")).toEqual({
			browser: "Unknown",
			device: "Desktop",
			os: "Unknown",
		});
	});
});
