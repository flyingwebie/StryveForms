import { cn } from "@StryveForms/ui/lib/utils";
import {
	TextAlignCenterIcon,
	TextAlignEndIcon,
	TextAlignStartIcon,
} from "lucide-react";

export type LogoAlignment = "left" | "center" | "right";

const OPTIONS = [
	{ icon: TextAlignStartIcon, label: "Left", value: "left" },
	{ icon: TextAlignCenterIcon, label: "Center", value: "center" },
	{ icon: TextAlignEndIcon, label: "Right", value: "right" },
] as const;

/** Left / Center / Right position of the brand logo above the form. */
export default function LogoAlignmentControl({
	onChange,
	value,
}: {
	onChange: (alignment: LogoAlignment) => void;
	value: LogoAlignment;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className="font-medium text-[13px]">Logo position</span>
			<div className="inline-flex w-fit rounded-lg bg-secondary p-1">
				{OPTIONS.map(({ icon: Icon, label, value: option }) => (
					<button
						aria-pressed={value === option}
						className={cn(
							"flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25",
							value === option
								? "bg-background text-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						)}
						key={option}
						onClick={() => onChange(option)}
						type="button"
					>
						<Icon className="size-4" />
						{label}
					</button>
				))}
			</div>
		</div>
	);
}
