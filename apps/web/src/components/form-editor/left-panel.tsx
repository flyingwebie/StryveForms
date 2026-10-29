import { usesPages } from "@StryveForms/forms/presentation";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@StryveForms/ui/components/tabs";
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
			<TabsList className="m-3">
				<TabsTrigger value="build">Build</TabsTrigger>
				{showPages ? <TabsTrigger value="pages">Pages</TabsTrigger> : null}
				<TabsTrigger value="design">Design</TabsTrigger>
				<TabsTrigger value="ai">AI</TabsTrigger>
			</TabsList>
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
