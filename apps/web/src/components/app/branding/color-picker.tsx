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

const HEX_INPUT = /^#[0-9a-f]{0,6}$/i;

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
		<div className="flex flex-wrap items-center gap-3">
			<label className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-input shadow-xs">
				<span
					aria-hidden="true"
					className="pointer-events-none size-full"
					style={{ backgroundColor: value }}
				/>
				<input
					aria-label="Custom color"
					className="absolute inset-0 size-full cursor-pointer opacity-0"
					onChange={(event) => onChange(event.target.value)}
					type="color"
					value={value}
				/>
			</label>
			<input
				aria-label="Hex color value"
				className="h-8 w-28 rounded-lg border border-input bg-background px-2.5 font-mono text-xs uppercase shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
				onChange={(event) => {
					const next = event.target.value;
					if (HEX_INPUT.test(next)) {
						onChange(next);
					}
				}}
				spellCheck={false}
				value={value}
			/>
			<div className="flex flex-wrap items-center gap-1.5">
				{presets.map((preset) => (
					<button
						className="size-5 shrink-0 rounded-full border border-black/10 ring-offset-2 ring-offset-background data-selected:ring-2 data-selected:ring-primary"
						data-selected={preset.toLowerCase() === value.toLowerCase()}
						key={preset}
						onClick={() => onChange(preset)}
						style={{ backgroundColor: preset }}
						type="button"
					>
						<span className="sr-only">Use {preset}</span>
					</button>
				))}
				{!isPreset && (
					<span
						aria-hidden="true"
						className="size-5 shrink-0 rounded-full ring-2 ring-primary ring-offset-2 ring-offset-background"
						style={{ backgroundColor: value }}
					/>
				)}
			</div>
		</div>
	);
}
