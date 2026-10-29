import { mergeAttributes, Node } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";

export interface MentionItem {
	id: string;
	label: string;
}

export interface FieldMentionOptions {
	/** Returns the fields that can be mentioned (read lazily so the list stays fresh). */
	getItems: () => MentionItem[];
	suggestion: Omit<SuggestionOptions<MentionItem>, "editor">;
}

export const fieldMentionKey = new PluginKey("fieldMention");

/**
 * Inline reference to a form answer. Serialises to the OpnForm-compatible
 * `<span mention="true" mention-field-id=… mention-field-name=… mention-fallback=…>`.
 */
export const FieldMention = Node.create<FieldMentionOptions>({
	name: "fieldMention",
	group: "inline",
	inline: true,
	atom: true,
	selectable: true,

	addOptions() {
		return {
			getItems: () => [],
			suggestion: { char: "@", pluginKey: fieldMentionKey },
		};
	},

	addAttributes() {
		return {
			fallback: { default: "" },
			id: { default: null },
			label: { default: "" },
		};
	},

	parseHTML() {
		return [
			{
				tag: "span[mention]",
				getAttrs: (element) => {
					if (!(element instanceof HTMLElement)) {
						return false;
					}
					return {
						fallback: element.getAttribute("mention-fallback") ?? "",
						id: element.getAttribute("mention-field-id"),
						label:
							element.getAttribute("mention-field-name") ??
							element.textContent ??
							"",
					};
				},
			},
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		const { fallback, id, label } = node.attrs as {
			fallback: string;
			id: string;
			label: string;
		};
		return [
			"span",
			mergeAttributes(
				{ class: "mention" },
				{
					contenteditable: "false",
					mention: "true",
					"mention-fallback": fallback,
					"mention-field-id": id,
					"mention-field-name": label,
				},
				// Drop the raw node attributes; only the OpnForm attributes are serialised.
				Object.fromEntries(
					Object.entries(HTMLAttributes).filter(([k]) => k === "class")
				)
			),
			label,
		];
	},

	renderText({ node }) {
		return `@${String(node.attrs.label)}`;
	},

	addProseMirrorPlugins() {
		return [
			Suggestion<MentionItem>({
				editor: this.editor,
				...this.options.suggestion,
				command: ({ editor, props, range }) => {
					editor
						.chain()
						.focus()
						.insertContentAt(range, [
							{
								attrs: { fallback: "", id: props.id, label: props.label },
								type: this.name,
							},
							{ text: " ", type: "text" },
						])
						.run();
				},
				items: ({ query }) => {
					const q = query.toLowerCase();
					return this.options
						.getItems()
						.filter((item) => item.label.toLowerCase().includes(q))
						.slice(0, 20);
				},
			}),
		];
	},
});
