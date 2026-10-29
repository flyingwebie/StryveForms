import { VISIBILITIES } from "@StryveForms/forms/settings";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@StryveForms/ui/components/alert-dialog";
import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import { cn } from "@StryveForms/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { VISIBILITY_META as META, type Visibility } from "../shared/visibility";
import { useEditor } from "../state/editor-context";

/**
 * Publish-state control: a status dropdown (Published / Draft / Closed) with
 * a confirmation step whenever a live form is about to stop accepting
 * submissions. Changes go through the same autosaved `patch` as every other
 * setting.
 */
export function StatusControl() {
	const { patch, readOnly, state } = useEditor();
	const { visibility } = state.settings;
	const [pending, setPending] = useState<Visibility | null>(null);

	function choose(next: Visibility) {
		if (next === visibility) {
			return;
		}
		// Only confirm when taking a *live* form offline — switching between
		// draft and closed, or publishing, needs no extra step.
		if (visibility === "public") {
			setPending(next);
		} else {
			patch({ visibility: next });
		}
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							className="rounded-full"
							disabled={readOnly}
							size="sm"
							type="button"
							variant="outline"
						/>
					}
				>
					<span
						aria-hidden="true"
						className={cn("size-2 rounded-full", META[visibility].dotClassName)}
					/>
					{META[visibility].label}
					<ChevronDownIcon className="size-3.5 opacity-60" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-72">
					{VISIBILITIES.map((option) => (
						<DropdownMenuItem key={option} onClick={() => choose(option)}>
							{/* The menu's `*:whitespace-nowrap` sizes it to its longest
							 * line and is inherited by every descendant; without an
							 * explicit override here the description below inherits
							 * nowrap too and gets clipped instead of wrapping. */}
							<div className="flex w-full flex-col gap-0.5 py-0.5">
								<span className="flex items-center gap-1.5 whitespace-nowrap font-medium text-sm">
									<span
										aria-hidden="true"
										className={cn(
											"size-2 rounded-full",
											META[option].dotClassName
										)}
									/>
									{META[option].label}
								</span>
								<span className="whitespace-normal text-muted-foreground text-xs">
									{META[option].description}
								</span>
							</div>
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
			<AlertDialog
				onOpenChange={(next) => {
					if (!next) {
						setPending(null);
					}
				}}
				open={pending !== null}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{pending === "draft"
								? "Unpublish this form?"
								: "Close this form?"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{pending === "draft"
								? "The form will be hidden from respondents and stop accepting new submissions until you publish it again."
								: "The form will stop accepting new submissions. The public page stays reachable, showing your closed message if you set one."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (pending) {
									patch({ visibility: pending });
								}
								setPending(null);
							}}
						>
							{pending === "draft" ? "Unpublish" : "Close form"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
