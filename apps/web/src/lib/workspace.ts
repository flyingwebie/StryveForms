/**
 * Tracks which workspace the user is currently viewing. The choice is
 * persisted in localStorage so it survives reloads and new tabs, and falls
 * back to the user's first workspace (usually their personal one).
 */
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { useTRPC } from "@/utils/trpc";

const STORAGE_KEY = "stryveforms.currentWorkspaceId";

function readStoredWorkspaceId(): string | null {
	if (typeof window === "undefined") {
		return null;
	}
	try {
		return window.localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

function writeStoredWorkspaceId(id: string) {
	try {
		window.localStorage.setItem(STORAGE_KEY, id);
	} catch {
		// Storage can be unavailable (private browsing); ignore.
	}
}

export interface WorkspaceSummary {
	/** The workspace's own brand colour (hex), if it has set one. Falls back to the instance colour. */
	brandColor?: string | null;
	createdAt: Date | string;
	formsCount: number;
	icon: string | null;
	id: string;
	name: string;
	role: "admin" | "user" | "readonly";
}

/**
 * Loads the user's workspaces and resolves the active one: the stored id if
 * it still exists, otherwise the first workspace. Call `setWorkspaceId` to
 * switch; it persists immediately.
 */
export function useWorkspaces() {
	const trpc = useTRPC();
	const query = useQuery(trpc.workspace.list.queryOptions());
	const [storedId, setStoredId] = useState<string | null>(null);

	useEffect(() => {
		setStoredId(readStoredWorkspaceId());
	}, []);

	const workspaces = query.data ?? [];
	const activeId =
		(storedId && workspaces.some((w) => w.id === storedId) ? storedId : null) ??
		workspaces[0]?.id ??
		null;
	const active = workspaces.find((w) => w.id === activeId) ?? null;

	const setWorkspaceId = useCallback((id: string) => {
		writeStoredWorkspaceId(id);
		setStoredId(id);
	}, []);

	return {
		activeWorkspace: active,
		activeWorkspaceId: activeId,
		isLoading: query.isLoading,
		setWorkspaceId,
		workspaces,
	};
}
