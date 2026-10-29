import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { BrandLockup } from "@/components/app/instance-logo";
import { readableForeground } from "@/lib/instance";

import type { BrandMode, BrandModeValues } from "./logo-guide";

export interface LogoPlacementValue extends BrandModeValues {
	heroTitle: string;
	name: string;
}

function Placement({
	children,
	label,
}: {
	children: ReactNode;
	label: string;
}) {
	return (
		<div className="space-y-1.5">
			<p className="font-medium text-[11px] text-subtle-foreground uppercase tracking-wider">
				{label}
			</p>
			{children}
		</div>
	);
}

const SURFACES = {
	dark: {
		app: "#0e0d13",
		border: "border-white/10",
		muted: "bg-white/5",
		panel: "#16151d",
		text: "text-white",
	},
	light: {
		app: "#f4f4f7",
		border: "border-black/10",
		muted: "bg-black/[0.04]",
		panel: "#ffffff",
		text: "text-[#16151d]",
	},
} as const;

/**
 * Every place the instance brand appears, for one colour scheme, live as the
 * admin edits it, using the same rules as the real app (wordmark vs. mark +
 * name, white tile for a light logo on dark, dark values falling back to light).
 */
export default function LogoPlacementPreview({
	mode,
	value,
}: {
	mode: BrandMode;
	value: LogoPlacementValue;
}) {
	const isDark = mode === "dark";
	const surface = SURFACES[mode];
	const color = (isDark ? value.primaryColorDark : null) ?? value.primaryColor;
	const icon = (isDark ? value.faviconDarkUrl : null) ?? value.faviconUrl;
	const sidebarLogo = isDark
		? (value.logoDarkUrl ?? value.logoUrl)
		: value.logoUrl;
	const sidebarChip = isDark && Boolean(value.logoUrl && !value.logoDarkUrl);
	// The sign-in panel is always coloured, so it uses the dark-backgrounds logo.
	const panelLogo = value.logoDarkUrl ?? value.logoUrl;
	const panelChip = Boolean(value.logoUrl && !value.logoDarkUrl);

	return (
		<div className="space-y-4 rounded-2xl bg-subtle p-4">
			<p className="font-semibold text-sm">
				Where it appears · {isDark ? "dark mode" : "light mode"}
			</p>

			<Placement label="Sidebar">
				<div
					className={`rounded-xl border p-3 ${surface.border}`}
					style={{ backgroundColor: surface.app }}
				>
					<BrandLockup
						chip={sidebarChip}
						iconUrl={icon}
						logoUrl={sidebarLogo}
						name={value.name}
						nameClassName={surface.text}
						size="sm"
					/>
					<div className="mt-3 space-y-1">
						<div
							className="h-6 rounded-md"
							style={{
								backgroundColor: `color-mix(in oklch, ${color} ${isDark ? 24 : 14}%, transparent)`,
							}}
						/>
						<div className={`h-6 w-3/4 rounded-md ${surface.muted}`} />
					</div>
				</div>
			</Placement>

			<Placement label="Buttons & links">
				<div
					className={`flex items-center gap-3 rounded-xl border p-3 ${surface.border}`}
					style={{ backgroundColor: surface.panel }}
				>
					<span
						className="rounded-lg px-3 py-1.5 font-medium text-xs"
						style={{ backgroundColor: color, color: readableForeground(color) }}
					>
						Publish
					</span>
					<span className="font-medium text-xs underline" style={{ color }}>
						View form
					</span>
				</div>
			</Placement>

			<Placement label="Sign-in page">
				<div
					className="space-y-3 rounded-xl p-4"
					style={{
						backgroundImage: `linear-gradient(135deg, ${color}, color-mix(in oklch, ${color} 55%, black))`,
					}}
				>
					<BrandLockup
						chip={panelChip}
						iconUrl={icon}
						logoUrl={panelLogo}
						name={value.name}
						nameClassName="text-white"
						size="sm"
					/>
					<p className="font-display text-white text-xl leading-tight">
						{value.heroTitle}
					</p>
				</div>
			</Placement>

			<Placement label="Browser tab">
				<div
					className={`flex items-center gap-2 rounded-t-lg border border-b-0 px-3 py-2 text-xs ${surface.border} ${surface.text}`}
					style={{ backgroundColor: surface.panel }}
				>
					<BrandLockup
						className="size-4 rounded-sm"
						iconUrl={icon}
						logoUrl={sidebarLogo}
						mode="icon"
						name={value.name}
						size="sm"
					/>
					<span className="min-w-0 flex-1 truncate">{value.name} · Forms</span>
					<XIcon className="size-3 opacity-50" />
				</div>
			</Placement>

			<Placement label="Collapsed sidebar · form editor">
				<div className="flex items-center gap-3">
					<div
						className={`rounded-xl border p-2 ${surface.border}`}
						style={{ backgroundColor: surface.app }}
					>
						<BrandLockup
							iconUrl={icon}
							logoUrl={sidebarLogo}
							mode="icon"
							name={value.name}
							size="md"
						/>
					</div>
					<p className="text-muted-foreground text-xs">
						{icon
							? "Uses your app icon."
							: "No app icon yet: showing a fallback."}
					</p>
				</div>
			</Placement>
		</div>
	);
}
