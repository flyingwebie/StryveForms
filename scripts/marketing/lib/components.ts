// Shared HTML/CSS building blocks for StryveForms marketing images.
// Everything here returns plain HTML strings assembled by build-pages.ts.
// Paths are relative to scripts/marketing/pages/*.html (where the final page files live).

export const SCREENSHOTS = "../../../apps/fumadocs/public/screenshots";
export const BRAND = "../../../apps/web/public/brand";
export const FONTS = "../fonts";

export const colors = {
	violetFrom: "#8B5CF6",
	violetTo: "#4338CA",
	zinc50: "#fafafa",
	zinc100: "#f4f4f5",
	zinc200: "#e4e4e7",
	zinc300: "#d4d4d8",
	zinc400: "#a1a1aa",
	zinc500: "#71717a",
	zinc600: "#52525b",
	zinc700: "#3f3f46",
	zinc800: "#27272a",
	zinc900: "#18181b",
	zinc950: "#09090b",
};

/** @font-face declarations, shared by every page. */
export function fontFaces(): string {
	const weights: [string, number][] = [
		["Regular", 400],
		["Medium", 500],
		["SemiBold", 600],
		["Bold", 700],
		["Black", 900],
	];
	return weights
		.map(
			([name, weight]) => `
  @font-face {
    font-family: "Geist";
    font-style: normal;
    font-weight: ${weight};
    src: url("${FONTS}/Geist-${name}.woff2") format("woff2");
  }`
		)
		.join("\n");
}

/** Base reset + typography shared by every page. */
export function baseStyles(width: number, height: number): string {
	return `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    font-family: "Geist", "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .mono {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  }
  `;
}

/** Full-bleed background: flat colour + faint grid + a soft violet glow. */
export function backdrop(dark: boolean, opts?: { glow?: boolean }): string {
	const glow = opts?.glow ?? true;
	const bg = dark ? colors.zinc950 : colors.zinc50;
	const gridLine = dark ? "rgba(255,255,255,0.055)" : "rgba(9,9,11,0.06)";
	const glowOpacity = dark ? 0.32 : 0.16;
	return `
  <div style="position:absolute; inset:0; background:${bg};">
    <div style="position:absolute; inset:0;
      background-image:
        linear-gradient(${gridLine} 1px, transparent 1px),
        linear-gradient(90deg, ${gridLine} 1px, transparent 1px);
      background-size: 44px 44px;
      mask-image: radial-gradient(ellipse 90% 80% at 50% 0%, black 40%, transparent 85%);
      -webkit-mask-image: radial-gradient(ellipse 90% 80% at 50% 0%, black 40%, transparent 85%);
    "></div>
    ${
			glow
				? `<div style="position:absolute; left:50%; top:-20%; width:1100px; height:620px; transform:translateX(-50%);
      background: radial-gradient(closest-side, ${colors.violetFrom} 0%, ${colors.violetTo} 55%, transparent 100%);
      opacity:${glowOpacity}; filter: blur(70px);"></div>`
				: ""
		}
  </div>`;
}

/** Small uppercase pill label. */
export function badge(text: string, dark: boolean): string {
	const bg = dark ? "rgba(139,92,246,0.14)" : "rgba(139,92,246,0.10)";
	const fg = dark ? "#c4b5fd" : "#6d28d9";
	const border = dark ? "rgba(139,92,246,0.3)" : "rgba(109,40,217,0.18)";
	return `<span style="display:inline-flex; align-items:center; gap:7px; padding:6px 13px; border-radius:999px;
    background:${bg}; color:${fg}; border:1px solid ${border};
    font-size:12.5px; font-weight:600; letter-spacing:0.07em; text-transform:uppercase;">
    <span style="width:5px; height:5px; border-radius:999px; background:${colors.violetFrom};"></span>${text}
  </span>`;
}

/**
 * A browser-window frame around a cropped app screenshot.
 * imgWidth/imgHeight = the frame's content box size; the source screenshot
 * (1440x900) is shown with object-fit cover, cropped from the top so the
 * meaningful UI survives and blank space below it is cut off.
 */
export function browserFrame(opts: {
	src: string;
	width: number;
	height: number;
	urlLabel?: string;
	dark?: boolean;
	radius?: number;
	/** Zoom factor >1 crops dead space (e.g. an empty right-hand inspector panel) by scaling the screenshot up and clipping the overflow. */
	zoom?: number;
}): string {
	const {
		src,
		width,
		height,
		urlLabel = "app.stryveforms.com",
		dark = false,
		radius = 16,
		zoom = 1,
	} = opts;
	const chrome = dark ? colors.zinc900 : "#ffffff";
	const chromeBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(9,9,11,0.08)";
	const barBg = dark ? colors.zinc800 : colors.zinc100;
	const barFg = dark ? colors.zinc400 : colors.zinc500;
	const topBarH = 38;
	return `
  <div style="width:${width}px; border-radius:${radius}px; overflow:hidden; background:${chrome};
    border:1px solid ${chromeBorder}; box-shadow:0 30px 60px -20px rgba(24,10,60,0.35), 0 10px 24px -12px rgba(24,10,60,0.25);">
    <div style="height:${topBarH}px; display:flex; align-items:center; gap:8px; padding:0 14px; background:${chrome}; border-bottom:1px solid ${chromeBorder};">
      <span style="width:9px; height:9px; border-radius:999px; background:#f87171;"></span>
      <span style="width:9px; height:9px; border-radius:999px; background:#fbbf24;"></span>
      <span style="width:9px; height:9px; border-radius:999px; background:#4ade80;"></span>
      <div style="flex:1; display:flex; justify-content:center;">
        <span style="padding:4px 14px; border-radius:999px; background:${barBg}; color:${barFg}; font-size:11.5px; font-weight:500;">${urlLabel}</span>
      </div>
      <span style="width:46px;"></span>
    </div>
    <div style="width:${width}px; height:${height - topBarH}px; overflow:hidden;">
      <img src="${src}" style="width:${width * zoom}px; height:auto; display:block;" />
    </div>
  </div>`;
}

/** A phone bezel around a mobile screenshot (390x844 source). */
export function phoneFrame(opts: {
	src: string;
	width: number;
	height: number;
}): string {
	const { src, width, height } = opts;
	const bezel = 10;
	return `
  <div style="width:${width}px; height:${height}px; border-radius:38px; background:${colors.zinc900};
    padding:${bezel}px; box-shadow:0 30px 60px -18px rgba(24,10,60,0.4), 0 10px 24px -10px rgba(24,10,60,0.3);
    position:relative; border:1px solid rgba(255,255,255,0.08);">
    <div style="width:100%; height:100%; border-radius:${38 - bezel}px; overflow:hidden; background:#fff; position:relative;">
      <img src="${src}" style="width:${width - bezel * 2}px; height:auto; display:block; object-fit:cover; object-position:top;" />
      <div style="position:absolute; top:7px; left:50%; transform:translateX(-50%); width:70px; height:16px; border-radius:999px; background:${colors.zinc900};"></div>
    </div>
  </div>`;
}

/** A floating card (no browser chrome) used as an overlapping inset. */
export function floatCard(opts: {
	src: string;
	width: number;
	height: number;
	dark?: boolean;
}): string {
	const { src, width, height, dark = false } = opts;
	const border = dark ? "rgba(255,255,255,0.10)" : "rgba(9,9,11,0.08)";
	return `
  <div style="width:${width}px; height:${height}px; border-radius:14px; overflow:hidden; border:1px solid ${border};
    box-shadow:0 24px 48px -16px rgba(24,10,60,0.4); background:${dark ? colors.zinc900 : "#fff"};">
    <img src="${src}" style="width:${width}px; height:auto; display:block; object-fit:cover; object-position:top;" />
  </div>`;
}

/** A self-drawn terminal window (not a screenshot) for CLI / MCP content. */
export function terminal(opts: {
	width: number;
	height: number;
	lines: string[];
}): string {
	const { width, height, lines } = opts;
	const body = lines
		.map((l) => `<div style="white-space:pre; line-height:1.9;">${l}</div>`)
		.join("\n");
	return `
  <div style="width:${width}px; height:${height}px; border-radius:16px; overflow:hidden; background:${colors.zinc900};
    border:1px solid rgba(255,255,255,0.08); box-shadow:0 30px 60px -18px rgba(24,10,60,0.4);">
    <div style="height:38px; display:flex; align-items:center; gap:8px; padding:0 14px; background:${colors.zinc800}; border-bottom:1px solid rgba(255,255,255,0.06);">
      <span style="width:9px; height:9px; border-radius:999px; background:#f87171;"></span>
      <span style="width:9px; height:9px; border-radius:999px; background:#fbbf24;"></span>
      <span style="width:9px; height:9px; border-radius:999px; background:#4ade80;"></span>
      <span class="mono" style="margin-left:8px; color:${colors.zinc400}; font-size:12px;">zsh</span>
    </div>
    <div class="mono" style="padding:20px 22px; font-size:13.5px; color:${colors.zinc300};">${body}</div>
  </div>`;
}

export function logoLockup(opts: { dark: boolean; height: number }): string {
	const { dark, height } = opts;
	const src = dark
		? `${BRAND}/stryveforms-logo-dark.svg`
		: `${BRAND}/stryveforms-logo.svg`;
	return `<img src="${src}" style="height:${height}px; width:auto; display:block;" />`;
}

/** Wraps page content in a full HTML document. */
export function page(opts: {
	width: number;
	height: number;
	body: string;
}): string {
	return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
${fontFaces()}
${baseStyles(opts.width, opts.height)}
</style>
</head>
<body>
${opts.body}
</body>
</html>`;
}
