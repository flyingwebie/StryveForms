import { BrandLockup } from "@/components/app/instance-logo";
import { readableForeground } from "@/lib/instance";

export interface HeroPreviewValue {
	heroSubtitle: string;
	heroTitle: string;
	logoUrl: string | null;
	name: string;
	primaryColor: string;
}

/**
 * A scaled-down, non-interactive mock of the sign-in screen, reflecting
 * branding changes (logo, name, colour, headline) live as the admin edits
 * them. Also shows a sidebar snippet so the brand colour's in-app usage
 * (active nav item) is visible at a glance.
 */
export default function HeroPreview({ value }: { value: HeroPreviewValue }) {
	const foreground = readableForeground(value.primaryColor);

	return (
		<div className="space-y-3 rounded-2xl bg-subtle p-5">
			<p className="font-medium text-subtle-foreground text-xs uppercase tracking-wide">
				Live preview
			</p>
			<div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
				<div className="flex flex-col items-center gap-3 px-6 py-7 text-center">
					{value.logoUrl ? (
						<BrandLockup logoUrl={value.logoUrl} name={value.name} size="lg" />
					) : (
						<span
							className="flex size-9 items-center justify-center rounded-xl font-semibold text-sm"
							style={{ backgroundColor: value.primaryColor, color: foreground }}
						>
							{value.name.slice(0, 2).toUpperCase()}
						</span>
					)}
					<div className="space-y-1">
						<h3 className="font-semibold text-base">{value.heroTitle}</h3>
						<p className="text-muted-foreground text-xs">
							Sign in to {value.name}
						</p>
					</div>
					<div className="mt-1 w-full space-y-2">
						<div className="h-8 w-full rounded-lg border border-input bg-background" />
						<div className="h-8 w-full rounded-lg border border-input bg-background" />
					</div>
					<button
						className="mt-1 w-full rounded-lg py-2 font-medium text-sm"
						style={{ backgroundColor: value.primaryColor, color: foreground }}
						type="button"
					>
						Sign in
					</button>
				</div>
			</div>
			<div className="space-y-1 rounded-xl border border-border bg-card p-2">
				<div
					className="truncate rounded-md px-2.5 py-1.5 font-medium text-xs"
					style={{
						backgroundColor: `color-mix(in oklch, ${value.primaryColor} 14%, transparent)`,
						color: value.primaryColor,
					}}
				>
					Forms
				</div>
				<div className="truncate px-2.5 py-1.5 text-muted-foreground text-xs">
					Templates
				</div>
				<div className="truncate px-2.5 py-1.5 text-muted-foreground text-xs">
					Assistant
				</div>
			</div>
		</div>
	);
}
