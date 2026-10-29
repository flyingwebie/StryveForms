import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";

import type { MentionItem } from "./field-mention";
import { MentionList, type MentionListHandle } from "./mention-list";

const OFFSET_PX = 6;

function place(element: HTMLElement, props: SuggestionProps<MentionItem>) {
	const rect = props.clientRect?.();
	if (!rect) {
		return;
	}
	element.style.left = `${rect.left}px`;
	element.style.top = `${rect.bottom + OFFSET_PX}px`;
}

/** Renders the "@" suggestion popup in a floating container on the page. */
export const renderMentionSuggestion: SuggestionOptions<MentionItem>["render"] =
	() => {
		let renderer: ReactRenderer<
			MentionListHandle,
			SuggestionProps<MentionItem>
		> | null = null;
		let container: HTMLDivElement | null = null;

		return {
			onStart: (props) => {
				renderer = new ReactRenderer(MentionList, {
					editor: props.editor,
					props,
				});
				container = document.createElement("div");
				container.style.position = "fixed";
				container.style.zIndex = "60";
				container.appendChild(renderer.element);
				document.body.appendChild(container);
				place(container, props);
			},
			onUpdate: (props) => {
				renderer?.updateProps(props);
				if (container) {
					place(container, props);
				}
			},
			onKeyDown: (props) => {
				if (props.event.key === "Escape") {
					container?.remove();
					return true;
				}
				return renderer?.ref?.onKeyDown(props) ?? false;
			},
			onExit: () => {
				container?.remove();
				renderer?.destroy();
				container = null;
				renderer = null;
			},
		};
	};
