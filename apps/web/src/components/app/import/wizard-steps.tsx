import { cn } from "@StryveForms/ui/lib/utils";
import { CheckIcon } from "lucide-react";

export const IMPORT_STEPS = ["Connect", "Choose forms", "Review", "Import"];

/**
 * Step indicator, e.g. Connect → Choose forms → Review → Import. Pass
 * `steps` to reuse it for a different wizard (the StryveForms file import
 * has its own step list); defaults to the OpnForm/JotForm steps.
 */
export default function WizardSteps({
	current,
	steps = IMPORT_STEPS,
}: {
	current: number;
	steps?: string[];
}) {
	return (
		<ol className="flex items-center gap-2 text-sm">
			{steps.map((label, index) => {
				const done = index < current;
				const active = index === current;
				return (
					<li
						aria-current={active ? "step" : undefined}
						className="flex flex-1 items-center gap-2.5"
						key={label}
					>
						<span
							className={cn(
								"flex size-6 shrink-0 items-center justify-center rounded-full border font-medium text-xs transition-colors",
								(done || active) &&
									"border-primary bg-primary text-primary-foreground",
								!(done || active) && "border-border text-muted-foreground"
							)}
						>
							{done ? <CheckIcon className="size-3.5" /> : index + 1}
						</span>
						<span
							className={cn(
								"hidden truncate text-sm sm:inline",
								active && "font-semibold text-foreground",
								done && !active && "font-normal text-foreground",
								!(done || active) && "text-muted-foreground"
							)}
						>
							{label}
						</span>
						{index < steps.length - 1 ? (
							<span
								className={cn("h-px flex-1 bg-border", done && "bg-primary")}
							/>
						) : null}
					</li>
				);
			})}
		</ol>
	);
}
