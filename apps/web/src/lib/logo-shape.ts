import { useEffect, useState } from "react";

/** How a logo image is proportioned, which decides how and where it can be shown. */
export type LogoShape = "wide" | "square" | "tall";

export interface LogoInfo {
	height: number;
	shape: LogoShape;
	width: number;
}

/** Wider than 1.6:1 reads as a wordmark (name included); narrower than 1:1.6 as a tall/stacked lockup. */
const WIDE_RATIO = 1.6;
const TALL_RATIO = 1 / 1.6;

export function logoShapeFor(width: number, height: number): LogoShape {
	if (!(width && height)) {
		return "square";
	}
	const ratio = width / height;
	if (ratio >= WIDE_RATIO) {
		return "wide";
	}
	if (ratio <= TALL_RATIO) {
		return "tall";
	}
	return "square";
}

const cache = new Map<string, LogoInfo>();

/**
 * Loads an image URL just to read its natural size (cached per URL), so logos
 * can be laid out by shape: a wordmark replaces the product name, a square
 * mark sits next to it. Returns null until the image has loaded (or if it fails).
 */
export function useLogoInfo(url: string | null | undefined): LogoInfo | null {
	const [info, setInfo] = useState<LogoInfo | null>(() =>
		url ? (cache.get(url) ?? null) : null
	);

	useEffect(() => {
		if (!url) {
			setInfo(null);
			return;
		}
		const cached = cache.get(url);
		if (cached) {
			setInfo(cached);
			return;
		}
		let cancelled = false;
		const image = new Image();
		image.onload = () => {
			// SVGs without intrinsic size report 0×0; treat them as square marks.
			const width = image.naturalWidth || 1;
			const height = image.naturalHeight || 1;
			const next: LogoInfo = {
				height,
				shape: logoShapeFor(width, height),
				width,
			};
			cache.set(url, next);
			if (!cancelled) {
				setInfo(next);
			}
		};
		image.onerror = () => {
			if (!cancelled) {
				setInfo(null);
			}
		};
		image.src = url;
		return () => {
			cancelled = true;
		};
	}, [url]);

	return info;
}
