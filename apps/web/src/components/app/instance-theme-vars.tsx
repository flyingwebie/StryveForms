import { brandCssVariables } from "@/lib/brand-css";
import { useInstance } from "@/lib/instance";

/**
 * Applies the instance's brand colours (Admin → Branding) as CSS variables:
 * one set for light mode and one for dark mode (falling back to the light
 * colour), including the soft tints used by "soft" buttons and badges.
 */
export default function InstanceThemeVars() {
	const instance = useInstance();
	const css = brandCssVariables(
		instance?.primaryColor ?? null,
		instance?.primaryColorDark ?? null
	);
	if (!css) {
		return null;
	}
	// biome-ignore lint/security/noDangerouslySetInnerHtml: generated from two validated hex colours (server-side regex), not user HTML
	return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
