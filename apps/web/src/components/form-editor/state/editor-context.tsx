import {
	renameFieldIdReferences,
	slugifyFieldId,
	uniqueFieldId,
} from "@StryveForms/forms/field-ids";
import { removePageBreak } from "@StryveForms/forms/presentation";
import type { FormSettings } from "@StryveForms/forms/settings";
import type { BlockImage, FormField } from "@StryveForms/forms/types";
import {
	createContext,
	type Dispatch,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useReducer,
	useRef,
} from "react";
import { toast } from "sonner";
import { insertionIndex } from "../dnd/drop-position";
import type {
	CanvasMode,
	EditorFormMeta,
	LeftPanelTab,
	PreviewScheme,
	PreviewWidth,
} from "../types";
import { createFieldFromBlock } from "../utils/create-field";
import { type EditorState, editorReducer, initEditorState } from "./reducer";

type PatchFn = (patch: Partial<FormSettings>) => void;

interface EditorContextValue {
	addBlock: (blockId: string) => FormField | null;
	addBlockAt: (blockId: string, index: number) => FormField | null;
	canRedo: boolean;
	canUndo: boolean;
	/** Closes the Add Block slide-out panel (Esc / click-outside / after inserting). */
	closeAddBlockPanel: () => void;
	dirty: boolean;
	dispatch: Dispatch<Parameters<typeof editorReducer>[1]>;
	duplicateField: (fieldId: string) => void;
	/** True once a field is "settled": present when the editor loaded, so its id is editable-with-a-warning instead of auto-synced from the label. */
	isExistingField: (fieldId: string) => boolean;
	markSaved: () => void;
	meta: EditorFormMeta;
	moveField: (
		fieldId: string,
		overFieldId: string,
		position?: "after" | "before"
	) => void;
	moveFieldBy: (fieldId: string, delta: 1 | -1) => void;
	moveFieldToEnd: (fieldId: string) => void;
	/** Opens the Add Block slide-out panel. `insertIndex: null` inserts after the selected field, or at the end. */
	openAddBlockPanel: (insertIndex: number | null) => void;
	patch: PatchFn;
	readOnly: boolean;
	redo: () => void;
	/**
	 * Re-fetches this form's settings from the server and resets the editor
	 * to them — for an outside change, such as the AI assistant editing the
	 * form through its own tools while this tab is open. Contract: if there
	 * are no unsaved local edits (`dirty` is false), it fetches, replaces
	 * `state.settings` and clears undo history, but keeps the current left
	 * tab and selected field; it resolves `true`. If there ARE unsaved local
	 * edits, it does nothing but show a warning toast and resolves `false` —
	 * callers don't need to check `dirty` themselves first.
	 */
	reloadFromServer: () => Promise<boolean>;
	removeField: (fieldId: string) => void;
	/**
	 * Hand-edits a field's id (the "Field ID" box): slugifies `rawId`, stops
	 * future label→id auto-sync for it, and propagates the rename to every
	 * logic condition / mention / formula reference. Does NOT dedupe against
	 * other ids — the caller shows the collision and blocks save instead.
	 */
	renameFieldId: (fieldId: string, rawId: string) => void;
	select: (fieldId: string | null) => void;
	selectedField: FormField | null;
	setCanvasMode: (mode: CanvasMode) => void;
	setLeftTab: (tab: LeftPanelTab) => void;
	setPreviewScheme: (scheme: PreviewScheme) => void;
	setPreviewWidth: (width: PreviewWidth) => void;
	state: EditorState;
	undo: () => void;
	updateField: (fieldId: string, fieldPatch: Partial<FormField>) => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({
	children,
	initialSettings,
	meta,
	reload,
}: {
	children: ReactNode;
	initialSettings: EditorState["settings"];
	meta: EditorFormMeta;
	/**
	 * Fetches this form's latest settings from the server, e.g. by refetching
	 * the `form.get` query. Returns `null` if the fetch failed or came back
	 * empty, in which case `reloadFromServer` leaves the editor untouched.
	 */
	reload: () => Promise<FormSettings | null>;
}) {
	const [state, dispatch] = useReducer(
		editorReducer,
		initialSettings,
		initEditorState
	);

	// Fields present when the editor mounted ("existing") vs. added this
	// session ("new") — only new fields get their id auto-slugged from the
	// label; this set is stable for the component's lifetime.
	const initialFieldIdsRef = useRef<Set<string>>(
		new Set(initialSettings.properties.map((f) => f.id))
	);

	const isExistingField = useCallback(
		(fieldId: string) => initialFieldIdsRef.current.has(fieldId),
		[]
	);

	const patch = useCallback<PatchFn>(
		(settingsPatch) => dispatch({ patch: settingsPatch, type: "patch" }),
		[]
	);

	const updateField = useCallback(
		(fieldId: string, fieldPatch: Partial<FormField>) => {
			const properties = state.settings.properties as FormField[];
			const current = properties.find((f) => f.id === fieldId);
			if (!current) {
				return;
			}
			const canAutoSyncId =
				typeof fieldPatch.name === "string" &&
				fieldPatch.id === undefined &&
				!initialFieldIdsRef.current.has(fieldId) &&
				!state.manualIdFieldIds.includes(fieldId);
			if (!canAutoSyncId) {
				patch({
					properties: properties.map((field) =>
						field.id === fieldId ? { ...field, ...fieldPatch } : field
					),
				});
				return;
			}
			const otherIds = properties
				.filter((f) => f.id !== fieldId)
				.map((f) => f.id);
			const nextId = uniqueFieldId(
				fieldPatch.name as string,
				otherIds,
				fieldId
			);
			const patchedProperties = properties.map((field) =>
				field.id === fieldId ? { ...field, ...fieldPatch, id: nextId } : field
			);
			if (nextId === fieldId) {
				patch({ properties: patchedProperties });
				return;
			}
			const renamed = renameFieldIdReferences(
				{ ...state.settings, properties: patchedProperties },
				fieldId,
				nextId
			);
			patch(renamed);
			if (state.selectedFieldId === fieldId) {
				dispatch({ fieldId: nextId, type: "select" });
			}
		},
		[
			patch,
			state.manualIdFieldIds,
			state.selectedFieldId,
			state.settings,
			state.settings.properties,
		]
	);

	const renameFieldId = useCallback(
		(fieldId: string, rawId: string) => {
			const properties = state.settings.properties as FormField[];
			const current = properties.find((f) => f.id === fieldId);
			if (!current) {
				return;
			}
			const nextId = slugifyFieldId(rawId);
			// Mark the (new) id manual either way, so a later label edit never
			// silently overwrites a deliberately hand-picked id.
			dispatch({ fieldId: nextId, type: "markIdManual" });
			if (nextId === fieldId) {
				return;
			}
			const patchedProperties = properties.map((field) =>
				field.id === fieldId ? { ...field, id: nextId } : field
			);
			const renamed = renameFieldIdReferences(
				{ ...state.settings, properties: patchedProperties },
				fieldId,
				nextId
			);
			patch(renamed);
			if (state.selectedFieldId === fieldId) {
				dispatch({ fieldId: nextId, type: "select" });
			}
		},
		[patch, state.selectedFieldId, state.settings]
	);

	// Applies the form's default question-image layout to every
	// newly-added question (see `createFieldFromBlock`).
	const focusedImageLayoutDefault = state.settings.settings
		?.focusedImageLayoutDefault as string | undefined;

	const addBlock = useCallback(
		(blockId: string) => {
			const field = createFieldFromBlock(
				blockId,
				state.settings.properties as FormField[],
				focusedImageLayoutDefault
			);
			if (!field) {
				return null;
			}
			patch({ properties: [...state.settings.properties, field] });
			dispatch({ fieldId: field.id, type: "select" });
			return field;
		},
		[patch, state.settings.properties, focusedImageLayoutDefault]
	);

	const addBlockAt = useCallback(
		(blockId: string, index: number) => {
			const properties = state.settings.properties as FormField[];
			const field = createFieldFromBlock(
				blockId,
				properties,
				focusedImageLayoutDefault
			);
			if (!field) {
				return null;
			}
			const next = [...properties];
			next.splice(Math.max(0, Math.min(index, next.length)), 0, field);
			patch({ properties: next });
			dispatch({ fieldId: field.id, type: "select" });
			return field;
		},
		[patch, state.settings.properties, focusedImageLayoutDefault]
	);

	const reloadFromServer = useCallback(async () => {
		if (state.version !== state.savedVersion) {
			toast.warning("Didn't refresh: you have unsaved changes", {
				description:
					"Save or undo your edits first, then try again to pick up the latest version.",
			});
			return false;
		}
		const next = await reload();
		if (!next) {
			return false;
		}
		dispatch({ settings: next, type: "reset" });
		return true;
	}, [reload, state.savedVersion, state.version]);

	const removeField = useCallback(
		(fieldId: string) => {
			const { properties, settings: nested } = state.settings;
			const removed = properties.find((f) => f.id === fieldId);
			if (removed?.type === "nf-page-break") {
				// Keep page images with their questions instead of orphaning them.
				const next = removePageBreak(
					properties,
					nested.pageImages as Record<string, BlockImage> | undefined,
					fieldId
				);
				patch({
					properties: next.properties,
					settings: { ...nested, pageImages: next.pageImages },
				});
			} else {
				patch({ properties: properties.filter((f) => f.id !== fieldId) });
			}
			if (state.selectedFieldId === fieldId) {
				dispatch({ fieldId: null, type: "select" });
			}
		},
		[patch, state.selectedFieldId, state.settings]
	);

	const duplicateField = useCallback(
		(fieldId: string) => {
			const properties = state.settings.properties as FormField[];
			const index = properties.findIndex((f) => f.id === fieldId);
			const source = properties[index];
			if (!source) {
				return;
			}
			const name = `${source.name} (copy)`;
			const copy: FormField = {
				...structuredClone(source),
				id: uniqueFieldId(
					name,
					properties.map((f) => f.id)
				),
				name,
			};
			const next = [...properties];
			next.splice(index + 1, 0, copy);
			patch({ properties: next });
			dispatch({ fieldId: copy.id, type: "select" });
		},
		[patch, state.settings.properties]
	);

	const moveField = useCallback(
		(
			fieldId: string,
			overFieldId: string,
			position: "after" | "before" = "after"
		) => {
			const properties = state.settings.properties as FormField[];
			const from = properties.findIndex((f) => f.id === fieldId);
			const overIndex = properties.findIndex((f) => f.id === overFieldId);
			if (from === -1 || overIndex === -1) {
				return;
			}
			const to = insertionIndex(overIndex, position, from);
			if (to === from) {
				return;
			}
			const next = [...properties];
			const [moved] = next.splice(from, 1);
			if (moved) {
				next.splice(to, 0, moved);
			}
			patch({ properties: next });
		},
		[patch, state.settings.properties]
	);

	const moveFieldBy = useCallback(
		(fieldId: string, delta: 1 | -1) => {
			const properties = state.settings.properties as FormField[];
			const from = properties.findIndex((f) => f.id === fieldId);
			const to = from + delta;
			if (from === -1 || to < 0 || to >= properties.length) {
				return;
			}
			const next = [...properties];
			const [moved] = next.splice(from, 1);
			if (moved) {
				next.splice(to, 0, moved);
			}
			patch({ properties: next });
		},
		[patch, state.settings.properties]
	);

	const moveFieldToEnd = useCallback(
		(fieldId: string) => {
			const properties = state.settings.properties as FormField[];
			const from = properties.findIndex((f) => f.id === fieldId);
			if (from === -1 || from === properties.length - 1) {
				return;
			}
			const next = [...properties];
			const [moved] = next.splice(from, 1);
			if (moved) {
				next.push(moved);
			}
			patch({ properties: next });
		},
		[patch, state.settings.properties]
	);

	const selectedField = useMemo(
		() =>
			(state.settings.properties as FormField[]).find(
				(f) => f.id === state.selectedFieldId
			) ?? null,
		[state.settings.properties, state.selectedFieldId]
	);

	const contextValue = useMemo<EditorContextValue>(
		() => ({
			addBlock,
			addBlockAt,
			canRedo: state.future.length > 0,
			canUndo: state.past.length > 0,
			closeAddBlockPanel: () => dispatch({ type: "closeAddBlockPanel" }),
			dirty: state.version !== state.savedVersion,
			dispatch,
			duplicateField,
			isExistingField,
			markSaved: () => dispatch({ type: "markSaved", version: state.version }),
			meta,
			moveField,
			moveFieldBy,
			moveFieldToEnd,
			openAddBlockPanel: (insertIndex) =>
				dispatch({ insertIndex, type: "openAddBlockPanel" }),
			patch,
			readOnly: meta.role === "readonly",
			redo: () => dispatch({ type: "redo" }),
			reloadFromServer,
			removeField,
			renameFieldId,
			select: (fieldId) => dispatch({ fieldId, type: "select" }),
			selectedField,
			setCanvasMode: (mode) => dispatch({ mode, type: "setCanvasMode" }),
			setLeftTab: (tab) => dispatch({ tab, type: "setLeftTab" }),
			setPreviewScheme: (scheme) =>
				dispatch({ scheme, type: "setPreviewScheme" }),
			setPreviewWidth: (width) => dispatch({ type: "setPreviewWidth", width }),
			state,
			undo: () => dispatch({ type: "undo" }),
			updateField,
		}),
		[
			addBlock,
			addBlockAt,
			duplicateField,
			isExistingField,
			meta,
			moveFieldBy,
			moveFieldToEnd,
			moveField,
			patch,
			reloadFromServer,
			removeField,
			renameFieldId,
			selectedField,
			state,
			updateField,
		]
	);

	return (
		<EditorContext.Provider value={contextValue}>
			{children}
		</EditorContext.Provider>
	);
}

export function useEditor(): EditorContextValue {
	const ctx = useContext(EditorContext);
	if (!ctx) {
		throw new Error("useEditor must be used within an EditorProvider");
	}
	return ctx;
}
