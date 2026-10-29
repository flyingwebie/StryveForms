import { cn } from "@StryveForms/ui/lib/utils";
import { CheckIcon } from "lucide-react";

const STEPS = [
	{ label: "Admin", step: 1 },
	{ label: "Branding", step: 2 },
	{ label: "Access", step: 3 },
	{ label: "Done", step: 4 },
] as const;

/** Horizontal numbered progress indicator for the setup wizard's four steps. */
export default function SetupStepper({ current }: { current: number }) {
	return (
		<ol className="flex w-full max-w-xl items-center">
			{STEPS.map(({ label, step }, index) => {
				const done = step < current;
				const active = step === current;
				return (
					<li className="flex flex-1 items-center last:flex-none" key={step}>
						<div className="flex items-center gap-2">
							<span
								className={cn(
									"flex size-7 shrink-0 items-center justify-center rounded-full font-semibold text-xs",
									done || active
										? "bg-primary text-primary-foreground"
										: "bg-secondary text-muted-foreground"
								)}
							>
								{done ? (
									<CheckIcon className="size-3.5" />
								) : (
									<span>{step}</span>
								)}
							</span>
							<span
								className={cn(
									"text-sm",
									active ? "font-semibold text-foreground" : "",
									done && !active ? "text-foreground" : "",
									!(done || active) && "text-muted-foreground"
								)}
							>
								{label}
							</span>
						</div>
						{index < STEPS.length - 1 ? (
							<span
								className={cn(
									"mx-3 h-px flex-1",
									done ? "bg-primary" : "bg-border"
								)}
							/>
						) : null}
					</li>
				);
			})}
		</ol>
	);
}
