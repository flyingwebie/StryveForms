import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@StryveForms/ui/components/tooltip";
import { Link } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	PanelLeftIcon,
	PanelRightIcon,
	RedoIcon,
	SaveIcon,
	Share2Icon,
	SparklesIcon,
	UndoIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import ShareDialog from "@/components/app/share/share-dialog";
import { useEditor } from "../state/editor-context";
import type { SaveStatus } from "../types";
import { StatusControl } from "./status-control";
import { VersionHistorySheet } from "./version-history-sheet";

const STATUS_LABEL: Record<SaveStatus, string> = {
	error: "Couldn't save",
	saved: "Saved",
	saving: "Saving…",
	unsaved: "Unsaved changes",
};

const CMD_KEY =
	typeof navigator !== "undefined" && navigator.platform.includes("Mac")
		? "⌘"
		: "Ctrl";

/** Icon-only button with a tooltip spelling out its label and shortcut. */
function IconButton({
	active,
	disabled,
	icon,
	label,
	onClick,
	shortcut,
}: {
	active?: boolean;
	disabled?: boolean;
	icon: React.ReactNode;
	label: string;
	onClick: () => void;
	shortcut?: string;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						aria-label={label}
						disabled={disabled}
						onClick={onClick}
						size="icon-sm"
						type="button"
						variant={active ? "secondary" : "ghost"}
					/>
				}
			>
				{icon}
			</TooltipTrigger>
			<TooltipContent>
				{label}
				{shortcut ? ` (${shortcut})` : ""}
			</TooltipContent>
		</Tooltip>
	);
}

export function TopBar({
	leftPanelCollapsed,
	onOpenSettings,
	onToggleLeftPanel,
	onToggleRightPanel,
	rightPanelCollapsed,
	save,
	status,
}: {
	leftPanelCollapsed: boolean;
	onOpenSettings: () => void;
	onToggleLeftPanel: () => void;
	onToggleRightPanel: () => void;
	rightPanelCollapsed: boolean;
	save: () => void;
	status: SaveStatus;
}) {
	const {
		canRedo,
		canUndo,
		meta,
		patch,
		readOnly,
		redo,
		setLeftTab,
		state,
		undo,
	} = useEditor();
	const [shareOpen, setShareOpen] = useState(false);

	// "Ask AI" switches to the editor's own AI tab instead of navigating to
	// the standalone assistant page, opening the left panel first if it's
	// collapsed.
	function askAi() {
		if (leftPanelCollapsed) {
			onToggleLeftPanel();
		}
		setLeftTab("ai");
	}

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === "s") {
				e.preventDefault();
				save();
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [save]);

	return (
		<TooltipProvider delay={300}>
			<div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-1.5">
				{/* Left cluster: identity + status. Shrinks/wraps as one group. */}
				<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
					<Button
						render={
							<Link
								params={{ formId: meta.id }}
								to="/dashboard/forms/$formId"
							/>
						}
						size="sm"
						type="button"
						variant="ghost"
					>
						<ArrowLeftIcon /> Back
					</Button>
					<IconButton
						active={!leftPanelCollapsed}
						icon={<PanelLeftIcon />}
						label={leftPanelCollapsed ? "Show build panel" : "Hide build panel"}
						onClick={onToggleLeftPanel}
						shortcut={`${CMD_KEY}+[`}
					/>
					<Input
						className="h-7 min-w-24 max-w-64 border-transparent font-medium hover:border-input focus-visible:border-ring max-[1280px]:max-w-40"
						disabled={readOnly}
						onChange={(e) => patch({ title: e.target.value })}
						value={state.settings.title}
					/>
					<StatusControl />
					<span className="text-muted-foreground text-xs">
						{STATUS_LABEL[status]}
					</span>
				</div>
				{/* Right cluster: actions. Wraps to its own row as a unit (instead of
				    one stray button at a time) and stays right-aligned either way.
				    The AI engineer's "Ask AI" button belongs in here, e.g. before
				    History — there's a gap reserved for it. */}
				<div className="flex flex-wrap items-center justify-end gap-2">
					<IconButton
						disabled={!canUndo}
						icon={<UndoIcon />}
						label="Undo"
						onClick={undo}
						shortcut={`${CMD_KEY}+Z`}
					/>
					<IconButton
						disabled={!canRedo}
						icon={<RedoIcon />}
						label="Redo"
						onClick={redo}
						shortcut={`${CMD_KEY}+Shift+Z`}
					/>
					<Button
						onClick={() => setShareOpen(true)}
						size="sm"
						type="button"
						variant="ghost"
					>
						<Share2Icon /> Share
					</Button>
					<ShareDialog
						formId={meta.id}
						onOpenChange={setShareOpen}
						open={shareOpen}
					/>
					<Button onClick={askAi} size="sm" type="button" variant="ghost">
						<SparklesIcon /> Ask AI
					</Button>
					<VersionHistorySheet />
					<Button
						onClick={onOpenSettings}
						size="sm"
						type="button"
						variant="outline"
					>
						Settings
					</Button>
					<IconButton
						active={!rightPanelCollapsed}
						icon={<PanelRightIcon />}
						label={
							rightPanelCollapsed
								? "Show field settings"
								: "Hide field settings"
						}
						onClick={onToggleRightPanel}
						shortcut={`${CMD_KEY}+]`}
					/>
					{readOnly ? null : (
						<Button onClick={save} size="sm" type="button">
							<SaveIcon /> Save
						</Button>
					)}
				</div>
			</div>
		</TooltipProvider>
	);
}
