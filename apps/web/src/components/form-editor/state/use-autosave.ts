import { findDuplicateFieldIds } from "@StryveForms/forms/field-ids";
import type { FormField } from "@StryveForms/forms/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";
import type { SaveStatus } from "../types";
import { useEditor } from "./editor-context";

const AUTOSAVE_DELAY_MS = 2000;

/**
 * Debounced autosave plus an explicit `save()` for the Save button / ⌘S.
 * Tracks dirty state via the editor's version counter so a save in flight
 * doesn't get clobbered by a stale success callback.
 */
export function useAutosave() {
	const { markSaved, meta, readOnly, state } = useEditor();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [status, setStatus] = useState<SaveStatus>("saved");
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const savingVersionRef = useRef(0);

	const mutation = useMutation(
		trpc.form.update.mutationOptions({
			onError: (error) => {
				setStatus("error");
				toast.error("Couldn't save your changes", {
					description: error.message,
				});
			},
			onSuccess: () => {
				markSaved();
				setStatus("saved");
				queryClient.invalidateQueries({
					queryKey: trpc.form.get.queryKey({ id: meta.id }),
				});
			},
		})
	);

	const dirty = state.version !== state.savedVersion;
	const duplicateIds = findDuplicateFieldIds(
		state.settings.properties as FormField[]
	);
	const hasDuplicateIds = duplicateIds.length > 0;

	// Toast once per time duplicates appear (not on every debounce tick).
	useEffect(() => {
		if (!(dirty && hasDuplicateIds)) {
			return;
		}
		toast.error("Can't save: duplicate field id", {
			description: `"${duplicateIds[0]}" is used by more than one field. Give each field a unique id in its settings.`,
		});
	}, [dirty, hasDuplicateIds, duplicateIds[0]]);

	const saveRef = useRef(() => {
		/* assigned below */
	});
	saveRef.current = () => {
		if (readOnly || !dirty || mutation.isPending) {
			return;
		}
		if (hasDuplicateIds) {
			setStatus("error");
			return;
		}
		savingVersionRef.current = state.version;
		setStatus("saving");
		mutation.mutate({ data: state.settings, id: meta.id });
	};

	useEffect(() => {
		if (readOnly || !dirty) {
			setStatus((current) => (dirty ? current : "saved"));
			return;
		}
		if (hasDuplicateIds) {
			setStatus("error");
			return;
		}
		setStatus("unsaved");
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}
		timeoutRef.current = setTimeout(() => {
			saveRef.current();
		}, AUTOSAVE_DELAY_MS);
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [dirty, readOnly, hasDuplicateIds]);

	return {
		dirty,
		save: () => saveRef.current(),
		status,
	};
}
