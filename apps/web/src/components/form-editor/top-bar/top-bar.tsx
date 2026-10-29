import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@StryveForms/ui/components/tooltip";
import { cn } from "@StryveForms/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	CheckIcon,
	CircleIcon,
	Loader2Icon,
	PanelLeftIcon,
	PanelRightIcon,
	RedoIcon,
	SettingsIcon,
	Share2Icon,
	SparklesIcon,
	TriangleAlertIcon,
	UndoIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import InstanceLogo from "@/components/app/instance-logo";
import ShareDialog from "@/components/app/share/share-dialog";
import { CanvasToolbar } from "../canvas/canvas-toolbar";
import { useEditor } from "../state/editor-context";
import type { SaveStatus } from "../types";
import { StatusControl } from "./status-control";
import { VersionHistorySheet } from "./version-history-sheet";

const STATUS_META: Record<
	SaveStatus,
	{ className: string; icon: React.ReactNode; label: string }
> = {
	error: {
		className: "text-destructive",
		icon: <TriangleAlertIcon className="size-3" />,
		label: "Couldn't save",
	},
	saved: {
		className: "text-subtle-foreground",
		icon: <CheckIcon className="size-3" />,
		label: "Saved",
	},
	saving: {
		className: "text-subtle-foreground",
		icon: <Loader2Icon className="size-3 animate-spin" />,
		label: "Saving…",
	},
	unsaved: {
		className: "text-warning",
		icon: <CircleIcon className="size-3" />,
		label: "Unsaved changes",
	},
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
	const statusMeta = STATUS_META[status];
	const isLive = state.settings.visibility === "public";

	// Publish/Update always gives feedback. Publishing a draft or closed form
	// flips it live, then saves on the next render (once the patched settings
	// are in state); "Update" saves pending edits right away, or confirms the
	// live form is already current when autosave got there first.
	const saveAfterPatchRef = useRef<boolean>(false);
	const awaitingSaveRef = useRef<{
		kind: "published" | "updated";
		started: boolean;
	} | null>(null);
	useEffect(() => {
		if (saveAfterPatchRef.current) {
			saveAfterPatchRef.current = false;
			save();
		}
	}, [save]);
	useEffect(() => {
		const awaiting = awaitingSaveRef.current;
		if (!awaiting) {
			return;
		}
		if (status === "saving") {
			awaiting.started = true;
			return;
		}
		if (!awaiting.started) {
			return;
		}
		if (status === "saved") {
			toast.success(
				awaiting.kind === "published" ? "Form published" : "Changes are live",
				{ description: "Respondents now see the latest version." }
			);
		}
		awaitingSaveRef.current = null;
	}, [status]);

	function publishOrUpdate() {
		if (!isLive) {
			awaitingSaveRef.current = { kind: "published", started: false };
			saveAfterPatchRef.current = true;
			patch({ visibility: "public" });
			return;
		}
		if (status === "saved") {
			toast.success("Everything is up to date", {
				description: "Your live form already has the latest changes.",
			});
			return;
		}
		awaitingSaveRef.current = { kind: "updated", started: false };
		save();
	}

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
			<div className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b bg-background px-3 py-1.5">
				{/* Left cluster: identity + status. */}
				<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
					<Button
						aria-label="Back to dashboard"
						render={
							<Link
								params={{ formId: meta.id }}
								to="/dashboard/forms/$formId"
							/>
						}
						size="icon-sm"
						type="button"
						variant="ghost"
					>
						<ArrowLeftIcon />
					</Button>
					<div className="h-5 w-px bg-border" />
					<InstanceLogo mode="icon" size="md" />
					<Input
						className="h-7 min-w-24 max-w-64 border-transparent font-semibold text-[15px] hover:border-input focus-visible:border-ring max-[1280px]:max-w-40"
						disabled={readOnly}
						onChange={(e) => patch({ title: e.target.value })}
						value={state.settings.title}
					/>
					<StatusControl />
					<span
						className={cn(
							"flex items-center gap-1 text-xs",
							statusMeta.className
						)}
					>
						{statusMeta.icon}
						{statusMeta.label}
					</span>
				</div>
				{/* Centre cluster: Edit/Preview + Desktop/Mobile mode. */}
				<CanvasToolbar />
				{/* Right cluster: actions. Wraps to its own row as a unit (instead of
				    one stray button at a time) and stays right-aligned either way. */}
				<div className="flex flex-1 flex-wrap items-center justify-end gap-1">
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
					<VersionHistorySheet />
					<IconButton
						icon={<SettingsIcon />}
						label="Form settings"
						onClick={onOpenSettings}
					/>
					<IconButton
						active={!leftPanelCollapsed}
						icon={<PanelLeftIcon />}
						label={leftPanelCollapsed ? "Show build panel" : "Hide build panel"}
						onClick={onToggleLeftPanel}
						shortcut={`${CMD_KEY}+[`}
					/>
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
					<div className="mx-1 h-5 w-px bg-border" />
					<Button onClick={askAi} size="sm" type="button" variant="soft">
						<SparklesIcon /> Ask AI
					</Button>
					<Button
						onClick={() => setShareOpen(true)}
						size="sm"
						type="button"
						variant="outline"
					>
						<Share2Icon /> Share
					</Button>
					<ShareDialog
						formId={meta.id}
						onOpenChange={setShareOpen}
						open={shareOpen}
					/>
					{readOnly ? null : (
						<Button
							disabled={status === "saving"}
							onClick={publishOrUpdate}
							size="sm"
							type="button"
						>
							{isLive ? "Update" : "Publish"}
						</Button>
					)}
				</div>
			</div>
		</TooltipProvider>
	);
}
