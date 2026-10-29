import { FormRenderer } from "@/components/form-renderer/form-renderer";
import { useEditor } from "../state/editor-context";
import { usePreviewForm } from "../utils/preview-form";

// Desktop is wide enough for split question images to show side by side,
// like on the public page (they switch to a banner below 48rem).
const WIDTH_CLASS: Record<"desktop" | "mobile", string> = {
	desktop: "max-w-5xl",
	mobile: "max-w-sm",
};

/**
 * The form as a respondent sees it, framed as a page: it fills the canvas
 * height so background and wallpaper images cover the whole page instead
 * of stopping at the bottom of the form.
 */
export function PreviewPane() {
	const { state } = useEditor();
	const form = usePreviewForm();

	return (
		<div className="flex h-full justify-center overflow-y-auto bg-muted/30 px-6 pt-20 pb-6">
			<div
				className={`flex w-full flex-col ${WIDTH_CLASS[state.previewWidth]}`}
			>
				<FormRenderer
					className="flex-1 overflow-hidden rounded-xl px-4 py-8 ring-1 ring-border"
					form={form}
					mode="preview"
				/>
			</div>
		</div>
	);
}
