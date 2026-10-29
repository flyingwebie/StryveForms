import { cn } from "@StryveForms/ui/lib/utils";
import type { ReactNode } from "react";

/** One illustrated, selectable card in a design-option picker (theme, size, radius…). */
export function OptionCard({
	disabled,
	illustration,
	label,
	onSelect,
	selected,
}: {
	disabled?: boolean;
	illustration: ReactNode;
	label: string;
	onSelect: () => void;
	selected: boolean;
}) {
	return (
		<button
			aria-pressed={selected}
			className={cn(
				"flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-colors",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
				selected
					? "border-primary bg-primary/5 ring-1 ring-primary"
					: "border-input hover:border-foreground/30 hover:bg-muted/40",
				disabled && "pointer-events-none opacity-50"
			)}
			disabled={disabled}
			onClick={onSelect}
			type="button"
		>
			{illustration}
			<span className="block text-xs first-letter:uppercase">{label}</span>
		</button>
	);
}

/** Lays out a row of `OptionCard`s that wraps on narrow panels. */
export function OptionCardGrid({ children }: { children: ReactNode }) {
	return <div className="flex flex-wrap gap-2">{children}</div>;
}
