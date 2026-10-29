import { usesPages } from "@StryveForms/forms/presentation";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@StryveForms/ui/components/tabs";
import { FilesIcon, LayersIcon, PaletteIcon, SparklesIcon } from "lucide-react";
import EditorAiPanel from "@/components/app/ai/editor-ai-panel";
import { BuildTab } from "./build-panel/build-tab";
import { DesignTab } from "./design/design-tab";
import { PagesTab } from "./pages-panel/pages-tab";
import { useEditor } from "./state/editor-context";
import type { LeftPanelTab } from "./types";

export function LeftPanel() {
	const { meta, setLeftTab, state } = useEditor();
	// Classic has no pages, so its Pages tab is hidden. If it was open when the
	// form switched to Classic, fall back to Build.
	const showPages = usesPages(state.settings.presentationStyle);
	const tab = !showPages && state.leftTab === "pages" ? "build" : state.leftTab;

	return (
		<Tabs
			className="h-full"
			onValueChange={(value) => setLeftTab(value as LeftPanelTab)}
			value={tab}
		>
			<div className="border-b px-3">
				<TabsList className="w-full justify-start gap-4 p-0" variant="line">
					<TabsTrigger
						className="flex-none gap-1 px-0.5 py-3 text-[13px] [&_svg]:size-3.5"
						value="build"
					>
						<LayersIcon /> Build
					</TabsTrigger>
					{showPages ? (
						<TabsTrigger
							className="flex-none gap-1 px-0.5 py-3 text-[13px] [&_svg]:size-3.5"
							value="pages"
						>
							<FilesIcon /> Pages
						</TabsTrigger>
					) : null}
					<TabsTrigger
						className="flex-none gap-1 px-0.5 py-3 text-[13px] [&_svg]:size-3.5"
						value="design"
					>
						<PaletteIcon /> Design
					</TabsTrigger>
					<TabsTrigger
						className="flex-none gap-1 px-0.5 py-3 text-[13px] [&_svg]:size-3.5"
						value="ai"
					>
						<SparklesIcon /> AI
					</TabsTrigger>
				</TabsList>
			</div>
			<TabsContent
				className="h-[calc(100%-3rem)] overflow-y-auto"
				value="build"
			>
				<BuildTab />
			</TabsContent>
			{showPages ? (
				<TabsContent
					className="h-[calc(100%-3rem)] overflow-y-auto"
					value="pages"
				>
					<PagesTab />
				</TabsContent>
			) : null}
			<TabsContent
				className="h-[calc(100%-3rem)] overflow-y-auto"
				value="design"
			>
				<DesignTab />
			</TabsContent>
			{/* No overflow here, unlike the other tabs: the AI panel is a chat
			 * with its own internal scroll area and a composer pinned to the
			 * bottom, and it needs the full column height to lay that out. */}
			<TabsContent className="h-[calc(100%-3rem)]" value="ai">
				<EditorAiPanel formId={meta.id} />
			</TabsContent>
		</Tabs>
	);
}
