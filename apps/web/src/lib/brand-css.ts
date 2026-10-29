import { readableForeground } from "@/lib/instance";

const HEX = /^#[0-9a-f]{6}$/i;

function vars(color: string, mode: "light" | "dark"): string {
	const soft =
		mode === "light"
			? `color-mix(in oklch, ${color} 12%, white)`
			: `color-mix(in oklch, ${color} 22%, #16151d)`;
	const softForeground =
		mode === "light"
			? `color-mix(in oklch, ${color} 82%, black)`
			: `color-mix(in oklch, ${color} 60%, white)`;
	return [
		`--primary: ${color}`,
		`--primary-foreground: ${readableForeground(color)}`,
		`--ring: ${color}`,
		`--primary-soft: ${soft}`,
		`--primary-soft-foreground: ${softForeground}`,
		`--sidebar-primary: ${color}`,
		`--sidebar-primary-foreground: ${readableForeground(color)}`,
		`--sidebar-ring: ${color}`,
		`--chart-1: ${color}`,
	].join("; ");
}

/**
 * CSS overriding the theme's brand variables with the instance's colours:
 * `light` for `:root`, `dark` (or `light` when unset) for `.dark`. Only
 * strict `#rrggbb` values are used, so the output is always safe to inline.
 */
export function brandCssVariables(
	light: string | null,
	dark: string | null
): string | null {
	const lightColor = light && HEX.test(light) ? light : null;
	const darkColor = dark && HEX.test(dark) ? dark : lightColor;
	if (!(lightColor || darkColor)) {
		return null;
	}
	const rules: string[] = [];
	if (lightColor) {
		rules.push(`:root, .light { ${vars(lightColor, "light")}; }`);
	}
	if (darkColor) {
		rules.push(`.dark { ${vars(darkColor, "dark")}; }`);
	}
	return rules.join("\n");
}
