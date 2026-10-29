import { useEffect } from "react";

import { useEditor } from "./editor-context";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

type ShortcutAction =
	| "delete"
	| "deselect"
	| "duplicate"
	| "moveDown"
	| "moveUp";

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	return EDITABLE_TAGS.has(target.tagName) || target.isContentEditable;
}

/** Pure key → action mapping, kept outside the hook to stay easy to reason about. */
function matchShortcut(e: KeyboardEvent): ShortcutAction | null {
	if (e.key === "Escape") {
		return "deselect";
	}
	if (e.key === "Delete" || e.key === "Backspace") {
		return "delete";
	}
	if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
		return "duplicate";
	}
	if (e.altKey && e.key === "ArrowUp") {
		return "moveUp";
	}
	if (e.altKey && e.key === "ArrowDown") {
		return "moveDown";
	}
	return null;
}

/**
 * Delete/Backspace removes the selected block, Cmd/Ctrl+D duplicates it,
 * Alt+ArrowUp/Down reorders it, Esc deselects. Only active in Edit mode, and
 * never while the user is typing in a text field.
 */
export function useCanvasShortcuts(): void {
	const { duplicateField, moveFieldBy, readOnly, removeField, select, state } =
		useEditor();
	const { canvasMode, selectedFieldId } = state;

	useEffect(() => {
		if (canvasMode !== "edit" || readOnly) {
			return;
		}

		function runAction(action: ShortcutAction) {
			if (action === "deselect") {
				select(null);
				return;
			}
			if (!selectedFieldId) {
				return;
			}
			const handlers: Record<
				Exclude<ShortcutAction, "deselect">,
				() => void
			> = {
				delete: () => removeField(selectedFieldId),
				duplicate: () => duplicateField(selectedFieldId),
				moveDown: () => moveFieldBy(selectedFieldId, 1),
				moveUp: () => moveFieldBy(selectedFieldId, -1),
			};
			handlers[action]();
		}

		function onKeyDown(e: KeyboardEvent) {
			if (isTypingTarget(e.target)) {
				return;
			}
			const action = matchShortcut(e);
			if (!action) {
				return;
			}
			e.preventDefault();
			runAction(action);
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		canvasMode,
		duplicateField,
		moveFieldBy,
		readOnly,
		removeField,
		select,
		selectedFieldId,
	]);
}
