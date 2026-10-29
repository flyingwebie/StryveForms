import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@StryveForms/ui/components/tooltip";
import { InfoIcon } from "lucide-react";

/**
 * Keyboard-focusable info icon + tooltip. Only for spots too tight for a
 * visible `FieldDescription` line (e.g. a compact inline button row) — a
 * plain description is the default everywhere else, since a `title`
 * tooltip alone is invisible on touch and to keyboard users who don't
 * trigger `:hover`.
 */
export function OptionHint({ children }: { children: string }) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						aria-label={`What this does: ${children}`}
						className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
						type="button"
					/>
				}
			>
				<InfoIcon className="size-3.5" />
			</TooltipTrigger>
			<TooltipContent>{children}</TooltipContent>
		</Tooltip>
	);
}
