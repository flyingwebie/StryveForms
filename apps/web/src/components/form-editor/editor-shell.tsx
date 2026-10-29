import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	useDefaultLayout,
} from "@StryveForms/ui/components/resizable";
import {
	Sheet,
	SheetContent,
	SheetTitle,
} from "@StryveForms/ui/components/sheet";
import { useEffect, useState } from "react";

import { AddBlockPanel } from "./build-panel/add-block-panel";
import { CanvasToolbar } from "./canvas/canvas-toolbar";
import { EditCanvas } from "./canvas/edit-canvas";
import { EditorDndProvider } from "./dnd/editor-dnd-provider";
import { FieldSettingsPanel } from "./field-settings/field-settings-panel";
import { LeftPanel } from "./left-panel";
import { PreviewPane } from "./preview/preview-pane";
import { SettingsDialog } from "./settings-dialog/settings-dialog";
import { useEditor } from "./state/editor-context";
import { useAutosave } from "./state/use-autosave";
import { useCanvasShortcuts } from "./state/use-canvas-shortcuts";
import { useNarrowEditor } from "./state/use-media-query";
import {
	type PanelToggle,
	usePanelToggle,
	usePanelToggleShortcuts,
} from "./state/use-panel-toggle";
import { TopBar } from "./top-bar/top-bar";

const LAYOUT_ID = "form-editor-layout";
const LEFT_PANEL_ID = "editor-left";
const CENTER_PANEL_ID = "editor-center";
const RIGHT_PANEL_ID = "editor-right";

function useLeaveWarning(dirty: boolean) {
	useEffect(() => {
		function onBeforeUnload(e: BeforeUnloadEvent) {
			if (dirty) {
				e.preventDefault();
			}
		}
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, [dirty]);
}

function EditorCanvasArea({
	state,
}: {
	state: ReturnType<typeof useEditor>["state"];
}) {
	return (
		<div className="relative h-full">
			<CanvasToolbar />
			{state.canvasMode === "edit" ? <EditCanvas /> : <PreviewPane />}
		</div>
	);
}

/** Tablet/phone (<1024px): side panels become slide-over sheets instead of taking up fixed width. */
function NarrowEditorBody({
	left,
	right,
}: {
	left: PanelToggle;
	right: PanelToggle;
}) {
	const { state } = useEditor();

	return (
		<EditorDndProvider>
			<div className="relative min-h-0 flex-1">
				{/* Starts flush with the body's left edge, same as the wide layout. */}
				<AddBlockPanel />
				<EditorCanvasArea state={state} />
			</div>
			<Sheet
				onOpenChange={(open) => left.setCollapsed(!open)}
				open={!left.collapsed}
			>
				<SheetContent className="w-80 p-0" side="left">
					<SheetTitle className="sr-only">Build &amp; design</SheetTitle>
					<LeftPanel />
				</SheetContent>
			</Sheet>
			<Sheet
				onOpenChange={(open) => right.setCollapsed(!open)}
				open={!right.collapsed}
			>
				<SheetContent className="w-80 p-0" side="right">
					<SheetTitle className="sr-only">Field settings</SheetTitle>
					<FieldSettingsPanel />
				</SheetContent>
			</Sheet>
		</EditorDndProvider>
	);
}

/** Desktop (≥1024px): the three resizable panels. */
function WideEditorBody({
	left,
	right,
}: {
	left: PanelToggle;
	right: PanelToggle;
}) {
	const { state } = useEditor();

	// This route renders client-only (`ssr: false`), so `localStorage` is
	// always safe here — no server render ever reaches this component.
	const { defaultLayout, onLayoutChanged } = useDefaultLayout({
		id: LAYOUT_ID,
		panelIds: [LEFT_PANEL_ID, CENTER_PANEL_ID, RIGHT_PANEL_ID],
		storage: window.localStorage,
	});

	return (
		<EditorDndProvider>
			<div className="relative flex min-h-0 flex-1">
				<AddBlockPanel />
				<ResizablePanelGroup
					className="min-h-0 flex-1"
					defaultLayout={defaultLayout}
					onLayoutChanged={onLayoutChanged}
				>
					<ResizablePanel
						collapsedSize={0}
						collapsible
						defaultSize={288}
						id={LEFT_PANEL_ID}
						maxSize={480}
						minSize={220}
						onResize={({ asPercentage }) => left.onResize(asPercentage)}
						panelRef={left.ref}
					>
						{/* `overflow-hidden`, not `-auto`: LeftPanel's own tab content
						 * already scrolls internally (so its header stays put); a
						 * second scrollbar here would double up with it. */}
						<div className="h-full overflow-hidden border-r">
							<LeftPanel />
						</div>
					</ResizablePanel>
					<ResizableHandle withHandle />
					<ResizablePanel id={CENTER_PANEL_ID} minSize={360}>
						<EditorCanvasArea state={state} />
					</ResizablePanel>
					<ResizableHandle withHandle />
					<ResizablePanel
						collapsedSize={0}
						collapsible
						defaultSize={320}
						id={RIGHT_PANEL_ID}
						maxSize={480}
						minSize={260}
						onResize={({ asPercentage }) => right.onResize(asPercentage)}
						panelRef={right.ref}
					>
						<div className="h-full border-l">
							<FieldSettingsPanel />
						</div>
					</ResizablePanel>
				</ResizablePanelGroup>
			</div>
		</EditorDndProvider>
	);
}

function EditorBody({
	left,
	right,
}: {
	left: PanelToggle;
	right: PanelToggle;
}) {
	useCanvasShortcuts();
	const narrow = useNarrowEditor();

	return narrow ? (
		<NarrowEditorBody left={left} right={right} />
	) : (
		<WideEditorBody left={left} right={right} />
	);
}

export function EditorShell() {
	const { readOnly } = useEditor();
	const { dirty, save, status } = useAutosave();
	const [settingsOpen, setSettingsOpen] = useState(false);
	// On a narrow screen the panels render as Sheets, which should start
	// closed (so the canvas isn't covered on load) instead of the desktop
	// default of "expanded".
	const narrow = useNarrowEditor();
	const left = usePanelToggle(narrow);
	const right = usePanelToggle(narrow);
	usePanelToggleShortcuts(left.toggle, right.toggle);
	useLeaveWarning(dirty);

	return (
		<div className="flex h-svh flex-col">
			<TopBar
				leftPanelCollapsed={left.collapsed}
				onOpenSettings={() => setSettingsOpen(true)}
				onToggleLeftPanel={left.toggle}
				onToggleRightPanel={right.toggle}
				rightPanelCollapsed={right.collapsed}
				save={save}
				status={status}
			/>
			{readOnly ? (
				<div className="border-b bg-amber-50 px-3 py-1.5 text-amber-800 text-xs dark:bg-amber-950 dark:text-amber-200">
					You have read-only access to this form. Changes can't be saved.
				</div>
			) : null}
			<EditorBody left={left} right={right} />
			<SettingsDialog onOpenChange={setSettingsOpen} open={settingsOpen} />
		</div>
	);
}
