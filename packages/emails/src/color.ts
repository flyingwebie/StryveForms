// biome-ignore-all lint/suspicious/noBitwiseOperators: extracting RGB channels from a packed hex int, not a logical-operator typo
/** Small hex/HSL helpers used to auto-derive a dark palette from the light one. */

function hexToRgb(hex: string): [number, number, number] {
	const cleaned = hex.replace("#", "");
	const full =
		cleaned.length === 3
			? cleaned
					.split("")
					.map((c) => c + c)
					.join("")
			: cleaned;
	const n = Number.parseInt(full, 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
	return `#${[clamp(r), clamp(g), clamp(b)]
		.map((v) => v.toString(16).padStart(2, "0"))
		.join("")}`;
}

interface Hsl {
	h: number;
	l: number;
	s: number;
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	const delta = max - min;
	if (delta === 0) {
		return { h: 0, l: l * 100, s: 0 };
	}
	const s = delta / (1 - Math.abs(2 * l - 1));
	let h: number;
	if (max === rn) {
		h = ((gn - bn) / delta) % 6;
	} else if (max === gn) {
		h = (bn - rn) / delta + 2;
	} else {
		h = (rn - gn) / delta + 4;
	}
	h *= 60;
	if (h < 0) {
		h += 360;
	}
	return { h, l: l * 100, s: s * 100 };
}

function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
	const sn = s / 100;
	const ln = l / 100;
	const c = (1 - Math.abs(2 * ln - 1)) * sn;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = ln - c / 2;
	let [r, g, b] = [0, 0, 0];
	if (h < 60) {
		[r, g, b] = [c, x, 0];
	} else if (h < 120) {
		[r, g, b] = [x, c, 0];
	} else if (h < 180) {
		[r, g, b] = [0, c, x];
	} else if (h < 240) {
		[r, g, b] = [0, x, c];
	} else if (h < 300) {
		[r, g, b] = [x, 0, c];
	} else {
		[r, g, b] = [c, 0, x];
	}
	return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/**
 * Derives a dark-mode counterpart of `hex` by resetting its lightness and
 * capping saturation, so a bright accent stays readable and a pastel
 * background turns into an appropriately dark one — without needing the
 * admin to pick two full palettes.
 */
export function autoDarkColor(
	hex: string,
	targetLightness: number,
	maxSaturation = 35
): string {
	const [r, g, b] = hexToRgb(hex);
	const hsl = rgbToHsl(r, g, b);
	const next: Hsl = {
		h: hsl.h,
		l: targetLightness,
		s: Math.min(hsl.s, maxSaturation),
	};
	return rgbToHex(...hslToRgb(next));
}

/** True when `hex` reads as a light colour (used to decide default dark targets). */
export function isLightColor(hex: string): boolean {
	const [r, g, b] = hexToRgb(hex);
	return rgbToHsl(r, g, b).l > 60;
}
