import type { FormSettings } from "@StryveForms/forms/settings";

import type { CanvasMode, LeftPanelTab, PreviewWidth } from "../types";

const HISTORY_LIMIT = 50;

/** `insertIndex: null` means "after the selected field, or at the end". */
export interface AddBlockPanelState {
	insertIndex: number | null;
	open: boolean;
}

export interface EditorState {
	addBlockPanel: AddBlockPanelState;
	canvasMode: CanvasMode;
	future: FormSettings[];
	leftTab: LeftPanelTab;
	/** Field ids whose "Field ID" box was hand-edited — stops label→id auto-sync for that field. Ephemeral: not persisted, not undoable. */
	manualIdFieldIds: string[];
	past: FormSettings[];
	previewWidth: PreviewWidth;
	savedVersion: number;
	selectedFieldId: string | null;
	settings: FormSettings;
	version: number;
}

export type EditorAction =
	| { patch: Partial<FormSettings>; type: "patch" }
	| { settings: FormSettings; type: "reset" }
	| { type: "undo" }
	| { type: "redo" }
	| { fieldId: string | null; type: "select" }
	| { tab: LeftPanelTab; type: "setLeftTab" }
	| { type: "markSaved"; version: number }
	| { width: PreviewWidth; type: "setPreviewWidth" }
	| { mode: CanvasMode; type: "setCanvasMode" }
	| { insertIndex: number | null; type: "openAddBlockPanel" }
	| { type: "closeAddBlockPanel" }
	| { fieldId: string; type: "markIdManual" };

export function initEditorState(settings: FormSettings): EditorState {
	return {
		addBlockPanel: { insertIndex: null, open: false },
		canvasMode: "edit",
		future: [],
		leftTab: "build",
		manualIdFieldIds: [],
		past: [],
		previewWidth: "desktop",
		savedVersion: 0,
		selectedFieldId: null,
		settings,
		version: 0,
	};
}

/** True when applying the patch would leave every value as it is. */
function changesNothing(
	settings: FormSettings,
	patch: Partial<FormSettings>
): boolean {
	for (const [key, value] of Object.entries(patch)) {
		const current = settings[key as keyof FormSettings];
		if (
			current !== value &&
			JSON.stringify(current) !== JSON.stringify(value)
		) {
			return false;
		}
	}
	return true;
}

function applyPatch(
	state: EditorState,
	patch: Partial<FormSettings>
): EditorState {
	// Editors that echo their value on mount mustn't mark the form unsaved.
	if (changesNothing(state.settings, patch)) {
		return state;
	}
	const past = [...state.past, state.settings].slice(-HISTORY_LIMIT);
	return {
		...state,
		future: [],
		past,
		settings: { ...state.settings, ...patch },
		version: state.version + 1,
	};
}

function undo(state: EditorState): EditorState {
	const previous = state.past.at(-1);
	if (!previous) {
		return state;
	}
	return {
		...state,
		future: [state.settings, ...state.future],
		past: state.past.slice(0, -1),
		settings: previous,
		version: state.version + 1,
	};
}

function redo(state: EditorState): EditorState {
	const next = state.future.at(0);
	if (!next) {
		return state;
	}
	return {
		...state,
		future: state.future.slice(1),
		past: [...state.past, state.settings],
		settings: next,
		version: state.version + 1,
	};
}

export function editorReducer(
	state: EditorState,
	action: EditorAction
): EditorState {
	switch (action.type) {
		case "patch":
			return applyPatch(state, action.patch);
		case "reset":
			// Keep looking at whatever the user was looking at (e.g. the AI
			// tab, or a selected field) across a server reload — only the
			// settings/history/dirty-tracking parts of state are fresh.
			return {
				...initEditorState(action.settings),
				leftTab: state.leftTab,
				selectedFieldId: state.selectedFieldId,
			};
		case "undo":
			return undo(state);
		case "redo":
			return redo(state);
		case "select":
			return { ...state, selectedFieldId: action.fieldId };
		case "setLeftTab":
			return { ...state, leftTab: action.tab };
		case "setPreviewWidth":
			return { ...state, previewWidth: action.width };
		case "setCanvasMode":
			return { ...state, canvasMode: action.mode };
		case "markSaved":
			return { ...state, savedVersion: action.version };
		case "openAddBlockPanel":
			return {
				...state,
				addBlockPanel: { insertIndex: action.insertIndex, open: true },
			};
		case "closeAddBlockPanel":
			return {
				...state,
				addBlockPanel: { ...state.addBlockPanel, open: false },
			};
		case "markIdManual":
			return state.manualIdFieldIds.includes(action.fieldId)
				? state
				: {
						...state,
						manualIdFieldIds: [...state.manualIdFieldIds, action.fieldId],
					};
		default:
			return state;
	}
}
