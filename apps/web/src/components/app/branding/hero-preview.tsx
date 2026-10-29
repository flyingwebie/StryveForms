import { readableForeground } from "@/lib/instance";

export interface HeroPreviewValue {
	heroSubtitle: string;
	heroTitle: string;
	logoUrl: string | null;
	name: string;
	primaryColor: string;
}

/** A scaled-down mock of the homepage hero, reflecting branding changes live. */
export default function HeroPreview({ value }: { value: HeroPreviewValue }) {
	const foreground = readableForeground(value.primaryColor);
	return (
		<div className="relative overflow-hidden border border-border bg-background p-6">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute top-[-4rem] left-[-4rem] size-48 rounded-full opacity-20 blur-2xl"
				style={{ backgroundColor: value.primaryColor }}
			/>
			<div className="relative flex flex-col items-center gap-2 text-center">
				{value.logoUrl ? (
					<img
						alt={value.name}
						className="h-8 w-auto"
						height={32}
						src={value.logoUrl}
						width={120}
					/>
				) : (
					<span
						className="flex size-8 items-center justify-center rounded-lg font-semibold text-xs"
						style={{ backgroundColor: value.primaryColor, color: foreground }}
					>
						{value.name.slice(0, 2).toUpperCase()}
					</span>
				)}
				<h3 className="font-semibold text-lg">{value.heroTitle}</h3>
				<p className="max-w-xs text-muted-foreground text-sm">
					{value.heroSubtitle}
				</p>
				<button
					className="mt-2 px-4 py-1.5 font-medium text-sm"
					style={{ backgroundColor: value.primaryColor, color: foreground }}
					type="button"
				>
					Sign in
				</button>
			</div>
		</div>
	);
}
