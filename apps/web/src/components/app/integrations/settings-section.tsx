import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@StryveForms/ui/components/collapsible";
import { cn } from "@StryveForms/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

/**
 * One collapsible "Security" / "Payload" / "Advanced" group inside an
 * integration dialog — closed by default so the dialog stays calm, with a
 * one-line description of what the group covers.
 */
export function SettingsSection({
	children,
	defaultOpen = false,
	description,
	title,
}: {
	children: ReactNode;
	defaultOpen?: boolean;
	description?: string;
	title: string;
}) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<Collapsible onOpenChange={setOpen} open={open}>
			<CollapsibleTrigger
				className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted"
				type="button"
			>
				<span>
					<span className="font-medium text-sm">{title}</span>
					{description ? (
						<span className="block text-muted-foreground text-xs">
							{description}
						</span>
					) : null}
				</span>
				<ChevronDownIcon
					className={cn(
						"size-4 shrink-0 text-muted-foreground transition-transform",
						open && "rotate-180"
					)}
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="space-y-3 px-2 pt-1 pb-3">
				{children}
			</CollapsibleContent>
		</Collapsible>
	);
}
