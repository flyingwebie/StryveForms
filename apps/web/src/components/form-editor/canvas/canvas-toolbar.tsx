import { Button } from "@StryveForms/ui/components/button";
import {
	MonitorIcon,
	PencilIcon,
	PlayIcon,
	SmartphoneIcon,
} from "lucide-react";

import { useEditor } from "../state/editor-context";

export function CanvasToolbar() {
	const { setPreviewWidth, setCanvasMode, state } = useEditor();
	const { canvasMode, previewWidth } = state;

	return (
		<div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
			<div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 rounded-full border bg-background/95 p-1 shadow-md backdrop-blur">
				<div className="flex items-center rounded-full border border-transparent p-0.5">
					<Button
						className="rounded-full"
						onClick={() => setCanvasMode("edit")}
						size="sm"
						type="button"
						variant={canvasMode === "edit" ? "secondary" : "ghost"}
					>
						<PencilIcon /> <span className="hidden sm:inline">Edit</span>
					</Button>
					<Button
						className="rounded-full"
						onClick={() => setCanvasMode("preview")}
						size="sm"
						type="button"
						variant={canvasMode === "preview" ? "secondary" : "ghost"}
					>
						<PlayIcon /> <span className="hidden sm:inline">Preview</span>
					</Button>
				</div>
				<div className="h-5 w-px bg-border" />
				<div className="flex items-center rounded-full border border-transparent p-0.5">
					<Button
						className="rounded-full"
						onClick={() => setPreviewWidth("desktop")}
						size="icon-sm"
						title="Desktop width"
						type="button"
						variant={previewWidth === "desktop" ? "secondary" : "ghost"}
					>
						<MonitorIcon />
					</Button>
					<Button
						className="rounded-full"
						onClick={() => setPreviewWidth("mobile")}
						size="icon-sm"
						title="Mobile width"
						type="button"
						variant={previewWidth === "mobile" ? "secondary" : "ghost"}
					>
						<SmartphoneIcon />
					</Button>
				</div>
			</div>
		</div>
	);
}
