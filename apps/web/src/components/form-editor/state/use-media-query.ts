import { useEffect, useState } from "react";

/**
 * SSR-safe `matchMedia` subscription. The editor route is client-only
 * (`ssr: false`), but this still guards for the first render before
 * `window` exists.
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(() =>
		typeof window === "undefined" ? false : window.matchMedia(query).matches
	);

	useEffect(() => {
		const mql = window.matchMedia(query);
		setMatches(mql.matches);
		function onChange(e: MediaQueryListEvent) {
			setMatches(e.matches);
		}
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, [query]);

	return matches;
}

/** Below ~1024px (tablet/phone), the side panels become slide-over sheets. */
export function useNarrowEditor(): boolean {
	return useMediaQuery("(max-width: 1023px)");
}
