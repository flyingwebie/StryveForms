import type { PanelImperativeHandle } from "@StryveForms/ui/components/resizable";
import { useCallback, useEffect, useRef, useState } from "react";

export interface PanelToggle {
	collapsed: boolean;
	onResize: (percentage: number) => void;
	ref: React.RefObject<PanelImperativeHandle | null>;
	/** Sets collapsed state directly — used by a Sheet's `onOpenChange` on narrow screens, where no resizable Panel is mounted. */
	setCollapsed: (collapsed: boolean) => void;
	toggle: () => void;
}

/**
 * Wraps a resizable Panel's imperative collapse/expand API with a boolean
 * for toggle buttons. On narrow screens the panel isn't mounted (it becomes
 * a Sheet instead), so `ref.current` is null; `toggle`/`setCollapsed` then
 * just flip the boolean directly, which the Sheet's `open` prop reads.
 */
export function usePanelToggle(initiallyCollapsed = false): PanelToggle {
	const ref = useRef<PanelImperativeHandle | null>(null);
	const [collapsed, setCollapsed] = useState(initiallyCollapsed);

	const onResize = useCallback((percentage: number) => {
		setCollapsed(percentage <= 0);
	}, []);

	const toggle = useCallback(() => {
		const panel = ref.current;
		if (!panel) {
			setCollapsed((c) => !c);
			return;
		}
		if (panel.isCollapsed()) {
			panel.expand();
		} else {
			panel.collapse();
		}
	}, []);

	return { collapsed, onResize, ref, setCollapsed, toggle };
}

/** Cmd/Ctrl+[ toggles the left panel, Cmd/Ctrl+] toggles the right panel. */
export function usePanelToggleShortcuts(
	toggleLeft: () => void,
	toggleRight: () => void
): void {
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (!(e.metaKey || e.ctrlKey)) {
				return;
			}
			if (e.key === "[") {
				e.preventDefault();
				toggleLeft();
			} else if (e.key === "]") {
				e.preventDefault();
				toggleRight();
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [toggleLeft, toggleRight]);
}
