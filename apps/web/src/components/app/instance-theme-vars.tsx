import { useLayoutEffect } from "react";

import { readableForeground, useInstance } from "@/lib/instance";

/** Applies the instance's primary color to the page's CSS variables. Renders nothing. */
export default function InstanceThemeVars() {
	const instance = useInstance();
	const color = instance?.primaryColor;

	useLayoutEffect(() => {
		const root = document.documentElement;
		if (!color) {
			root.style.removeProperty("--primary");
			root.style.removeProperty("--ring");
			root.style.removeProperty("--primary-foreground");
			return;
		}
		root.style.setProperty("--primary", color);
		root.style.setProperty("--ring", color);
		root.style.setProperty("--primary-foreground", readableForeground(color));
	}, [color]);

	return null;
}
