import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { WorkspaceSummary } from "@/lib/workspace";

import CommandMenu from "./command-menu";
import NewFormDialog from "./new-form-dialog";

interface ShellActions {
	openCommandMenu: () => void;
	openNewForm: () => void;
}

const ShellContext = createContext<ShellActions>({
	openCommandMenu: () => undefined,
	openNewForm: () => undefined,
});

/** Opens the ⌘K palette or the New form dialog from anywhere in the signed-in app. */
export function useShell() {
	return useContext(ShellContext);
}

/**
 * Owns the app-wide dialogs (command palette, New form) so the sidebar search
 * button, the header and any page can open them, and binds ⌘K / Ctrl+K.
 */
export function ShellProvider({
	activeWorkspaceId,
	children,
	setWorkspaceId,
	workspaces,
}: {
	activeWorkspaceId: string | null;
	children: ReactNode;
	setWorkspaceId: (id: string) => void;
	workspaces: WorkspaceSummary[];
}) {
	const [commandOpen, setCommandOpen] = useState(false);
	const [newFormOpen, setNewFormOpen] = useState(false);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				setCommandOpen((open) => !open);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	const actions = useMemo<ShellActions>(
		() => ({
			openCommandMenu: () => setCommandOpen(true),
			openNewForm: () => setNewFormOpen(true),
		}),
		[]
	);

	return (
		<ShellContext.Provider value={actions}>
			{children}
			{activeWorkspaceId ? (
				<NewFormDialog
					onOpenChange={setNewFormOpen}
					open={newFormOpen}
					workspaceId={activeWorkspaceId}
				/>
			) : null}
			<CommandMenu
				activeWorkspaceId={activeWorkspaceId}
				onNewForm={() => {
					setCommandOpen(false);
					setNewFormOpen(true);
				}}
				onOpenChange={setCommandOpen}
				open={commandOpen}
				setWorkspaceId={setWorkspaceId}
				workspaces={workspaces}
			/>
		</ShellContext.Provider>
	);
}
