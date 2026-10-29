import { cn } from "@StryveForms/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * A compact pill-shaped multi-way toggle (Public/Private, Sm/Md/Lg,
 * None/Small/Full…), for option sets too plain for an illustrated
 * `OptionCard` grid. The selected segment gets a raised white/background
 * chip, matching the design's segmented controls.
 */
export function SegmentedControl<T extends string>({
	ariaLabel,
	fullWidth,
	onChange,
	options,
	value,
}: {
	ariaLabel?: string;
	/** Stretches segments to fill the row equally, instead of hugging their content. */
	fullWidth?: boolean;
	onChange: (value: T) => void;
	options: { label: ReactNode; value: T }[];
	value: T;
}) {
	return (
		<fieldset
			aria-label={ariaLabel}
			className={cn(
				"m-0 inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5",
				fullWidth && "flex w-full"
			)}
		>
			{options.map((option) => (
				<button
					aria-pressed={option.value === value}
					className={cn(
						"rounded-md px-3 py-1.5 text-center font-medium text-xs transition-colors",
						fullWidth && "flex-1",
						option.value === value
							? "bg-background text-foreground shadow-xs"
							: "text-muted-foreground hover:text-foreground"
					)}
					key={option.value}
					onClick={() => onChange(option.value)}
					type="button"
				>
					{option.label}
				</button>
			))}
		</fieldset>
	);
}
