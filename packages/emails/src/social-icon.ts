/**
 * Renders social network icons as PNG for emails (email clients can't rely on
 * SVG). The official brand marks come from simple-icons (CC0); networks it no
 * longer ships (LinkedIn) and generic ones (website, email) use simple drawn
 * marks. SVG → PNG uses resvg compiled to WebAssembly, so it works on every
 * platform self-hosters run without native addons.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { initWasm, Resvg } from "@resvg/resvg-wasm";
import {
	siDiscord,
	siFacebook,
	siGithub,
	siInstagram,
	siMastodon,
	siPinterest,
	siTelegram,
	siThreads,
	siTiktok,
	siWhatsapp,
	siX,
	siYoutube,
} from "simple-icons";

import { SOCIAL_NETWORKS, type SocialNetworkId } from "./social";

export const SOCIAL_ICON_STYLES = ["brand", "mono", "muted"] as const;
export type SocialIconStyle = (typeof SOCIAL_ICON_STYLES)[number];

const MUTED_GREY = "#9CA3AF";
const MIN_SIZE = 16;
const MAX_SIZE = 128;
/** Share of the badge the logo takes up. */
const GLYPH_SCALE = 0.56;
const VIEWBOX = 24;

const LINKEDIN_PATH =
	"M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452z";

/** Each network's mark in a 24×24 box: a filled path or stroked shapes. */
const GLYPHS: Record<SocialNetworkId, { fill?: string; stroke?: string }> = {
	discord: { fill: siDiscord.path },
	email: {
		stroke:
			'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
	},
	facebook: { fill: siFacebook.path },
	github: { fill: siGithub.path },
	instagram: { fill: siInstagram.path },
	linkedin: { fill: LINKEDIN_PATH },
	mastodon: { fill: siMastodon.path },
	pinterest: { fill: siPinterest.path },
	telegram: { fill: siTelegram.path },
	threads: { fill: siThreads.path },
	tiktok: { fill: siTiktok.path },
	website: {
		stroke:
			'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
	},
	whatsapp: { fill: siWhatsapp.path },
	x: { fill: siX.path },
	youtube: { fill: siYoutube.path },
};

// Load the renderer once. Top-level await keeps rendering synchronous.
await initWasm(
	readFileSync(
		fileURLToPath(import.meta.resolve("@resvg/resvg-wasm/index_bg.wasm"))
	)
);

function resolveFillColor(
	network: SocialNetworkId,
	style: SocialIconStyle,
	customColor?: string
): string {
	if (style === "muted") {
		return MUTED_GREY;
	}
	if (style === "mono") {
		return customColor ?? MUTED_GREY;
	}
	return SOCIAL_NETWORKS[network].brandColor;
}

/** The SVG of a round badge: coloured background with the white logo. */
export function socialIconSvg(
	network: SocialNetworkId,
	style: SocialIconStyle,
	size: number,
	customColor?: string
): string {
	const color = resolveFillColor(network, style, customColor);
	const glyph = GLYPHS[network];
	const scale = (size * GLYPH_SCALE) / VIEWBOX;
	const offset = (size - VIEWBOX * scale) / 2;
	const mark = glyph.fill
		? `<path fill="#fff" d="${glyph.fill}"/>`
		: `<g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph.stroke ?? ""}</g>`;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${color}"/><g transform="translate(${offset} ${offset}) scale(${scale})">${mark}</g></svg>`;
}

/** Renders a round PNG badge with the network's logo. */
export function renderSocialIconPng(
	network: SocialNetworkId,
	style: SocialIconStyle,
	size: number,
	customColor?: string
): Buffer {
	const clamped = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(size)));
	const svg = socialIconSvg(network, style, clamped, customColor);
	const png = new Resvg(svg, { fitTo: { mode: "width", value: clamped } })
		.render()
		.asPng();
	return Buffer.from(png);
}

/** Process-lifetime cache: output is deterministic for a given (network, style, size, colour). */
const cache = new Map<string, Buffer>();
const MAX_CACHE_ENTRIES = 500;

export function getCachedSocialIconPng(
	network: SocialNetworkId,
	style: SocialIconStyle,
	size: number,
	customColor?: string
): Buffer {
	const key = `${network}|${style}|${Math.round(size)}|${customColor ?? ""}`;
	const hit = cache.get(key);
	if (hit) {
		return hit;
	}
	const buf = renderSocialIconPng(network, style, size, customColor);
	if (cache.size >= MAX_CACHE_ENTRIES) {
		cache.clear();
	}
	cache.set(key, buf);
	return buf;
}
