import { cn } from "@StryveForms/ui/lib/utils";
import { CheckCircle2Icon } from "lucide-react";
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
				"flex flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center transition-colors",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
				selected
					? "border-primary bg-primary-soft"
					: "border-border hover:border-foreground/40 hover:bg-muted/40",
				disabled && "pointer-events-none opacity-50"
			)}
			disabled={disabled}
			onClick={onSelect}
			type="button"
		>
			{illustration}
			<span className="flex items-center gap-1 text-xs first-letter:uppercase">
				{label}
				{selected ? (
					<CheckCircle2Icon className="size-3.5 shrink-0 text-primary" />
				) : null}
			</span>
		</button>
	);
}

const COLUMN_CLASSES: Record<number, string> = {
	2: "grid-cols-2",
	3: "grid-cols-3",
	4: "grid-cols-4",
};

/** Lays out a fixed-column grid of `OptionCard`s, stretched to fill the panel's width. */
export function OptionCardGrid({
	children,
	columns = 3,
}: {
	children: ReactNode;
	columns?: 2 | 3 | 4;
}) {
	return (
		<div className={cn("grid gap-2", COLUMN_CLASSES[columns])}>{children}</div>
	);
}
