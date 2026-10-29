const PRESETS = [
	"#7C3AED",
	"#2563EB",
	"#059669",
	"#DC2626",
	"#EA580C",
	"#0891B2",
	"#DB2777",
	"#111827",
];

/** Light and dark neutrals, for backgrounds and text. */
export const NEUTRAL_PRESETS = [
	"#FFFFFF",
	"#FAFAFA",
	"#F4F4F5",
	"#E4E4E7",
	"#71717A",
	"#3F3F46",
	"#18181B",
	"#09090B",
];

export default function ColorPicker({
	onChange,
	presets = PRESETS,
	value,
}: {
	onChange: (color: string) => void;
	presets?: readonly string[];
	value: string;
}) {
	const isPreset = presets.some((p) => p.toLowerCase() === value.toLowerCase());
	return (
		<div className="flex flex-wrap items-center gap-2">
			{presets.map((preset) => (
				<button
					className="size-7 shrink-0 rounded-full border border-black/10 ring-offset-2 ring-offset-background data-selected:ring-2 data-selected:ring-foreground"
					data-selected={preset.toLowerCase() === value.toLowerCase()}
					key={preset}
					onClick={() => onChange(preset)}
					style={{ backgroundColor: preset }}
					type="button"
				>
					<span className="sr-only">Use {preset}</span>
				</button>
			))}
			<label className="relative flex size-7 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border">
				<span
					aria-hidden="true"
					className="pointer-events-none size-full"
					style={
						isPreset
							? {
									background:
										"conic-gradient(#f43f5e, #f59e0b, #22c55e, #06b6d4, #6366f1, #d946ef, #f43f5e)",
								}
							: { backgroundColor: value }
					}
				/>
				<input
					aria-label="Custom color"
					className="absolute inset-0 size-full cursor-pointer opacity-0"
					onChange={(event) => onChange(event.target.value)}
					type="color"
					value={value}
				/>
			</label>
			<span className="text-muted-foreground text-xs uppercase">{value}</span>
		</div>
	);
}
