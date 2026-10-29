/** Everything the editor needs about the form it's editing, beyond its settings. */
export interface EditorFormMeta {
	createdAt: string;
	hasPassword: boolean;
	id: string;
	role: "admin" | "user" | "readonly";
	shareUrl: string;
	slug: string;
	/** Completed submissions so far — gates whether a field id is safe to freely rename. */
	submissionsCount: number;
	updatedAt: string;
	workspaceId: string;
}

export type SaveStatus = "error" | "saved" | "saving" | "unsaved";

export type PreviewWidth = "desktop" | "mobile";

export type LeftPanelTab = "ai" | "build" | "design" | "pages";

/** "edit": WYSIWYG drag/resize canvas. "preview": the real interactive FormRenderer. */
export type CanvasMode = "edit" | "preview";

/** A form value kept only for the purposes of the editor, never persisted. */
export interface EditorUiState {
	leftTab: LeftPanelTab;
	previewWidth: PreviewWidth;
	selectedFieldId: string | null;
}
