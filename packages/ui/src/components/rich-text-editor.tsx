import { cn } from "@StryveForms/ui/lib/utils";
import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color, FontFamily, TextStyle } from "@tiptap/extension-text-style";
import { Typography } from "@tiptap/extension-typography";
import { Youtube } from "@tiptap/extension-youtube";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { EditorContent, type Extensions, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CtaButton } from "./rich-text/cta-button";
import { FieldMention, type MentionItem } from "./rich-text/field-mention";
import { renderMentionSuggestion } from "./rich-text/suggestion-render";
import type { AiToolbarConfig } from "./rich-text/toolbar";
import { RichTextToolbar } from "./rich-text/toolbar";

export type { MentionItem } from "./rich-text/field-mention";
export type { AiAction, AiToolbarConfig } from "./rich-text/toolbar";

export interface RichTextEditorProps {
	/** Shows an "AI" button in the toolbar (write/improve/shorten/tone/grammar/translate). */
	ai?: AiToolbarConfig;
	"aria-label"?: string;
	className?: string;
	disabled?: boolean;
	/** Shows a red border (form validation). */
	invalid?: boolean;
	/** Tallest the content area can be dragged to. Default 640px. */
	maxHeight?: number;
	maxLength?: number;
	/** Fields that can be inserted with "@" (stored as OpnForm-compatible mention spans). */
	mentions?: MentionItem[];
	minHeight?: number;
	onBlur?: () => void;
	onChange: (html: string) => void;
	onImageUpload?: (file: File) => Promise<string>;
	placeholder?: string;
	/** Lets the user drag the content area taller/shorter. Default on for multi-line editors. */
	resizable?: boolean;
	/** One line only (email subjects, redirect URLs): Enter does nothing, no block formatting. */
	singleLine?: boolean;
	toolbar?: "full" | "basic" | "none";
	value: string;
}

const EMPTY_DOC = "<p></p>";
const DEFAULT_MAX_HEIGHT = 640;

/** Auto-grow (just a floor) until the user drags the handle, then a fixed, scrollable height. */
function contentStyle(
	singleLine: boolean,
	customHeight: number | undefined,
	minHeight: number
): React.CSSProperties | undefined {
	if (singleLine) {
		return;
	}
	if (customHeight) {
		return { height: customHeight, overflowY: "auto" };
	}
	return { minHeight };
}

function buildExtensions(options: {
	getMentions: () => MentionItem[];
	maxLength?: number;
	placeholder?: string;
	singleLine: boolean;
	withMentions: boolean;
}): Extensions {
	const extensions: Extensions = [
		StarterKit.configure({
			heading: options.singleLine ? false : { levels: [1, 2, 3] },
			link: {
				autolink: true,
				openOnClick: false,
				HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
			},
		}),
		Placeholder.configure({ placeholder: options.placeholder ?? "" }),
		CharacterCount.configure({ limit: options.maxLength ?? null }),
	];
	if (!options.singleLine) {
		extensions.push(
			TextStyle,
			Color,
			FontFamily,
			Highlight.configure({ multicolor: true }),
			TextAlign.configure({ types: ["heading", "paragraph"] }),
			Image.configure({ inline: false }),
			TableKit.configure({ table: { resizable: false } }),
			TaskList,
			TaskItem.configure({ nested: true }),
			Typography,
			Subscript,
			Superscript,
			Youtube.configure({ nocookie: true }),
			CtaButton
		);
	}
	if (options.withMentions) {
		extensions.push(
			FieldMention.configure({
				getItems: options.getMentions,
				suggestion: { char: "@", render: renderMentionSuggestion },
			})
		);
	}
	return extensions;
}

/**
 * TipTap rich-text editor used across StryveForms: rich-text answers, text
 * blocks, success messages and email bodies (with "@" field mentions).
 */
export function RichTextEditor({
	ai,
	"aria-label": ariaLabel,
	className,
	disabled = false,
	invalid = false,
	maxHeight = DEFAULT_MAX_HEIGHT,
	maxLength,
	mentions,
	minHeight = 120,
	onBlur,
	onChange,
	onImageUpload,
	placeholder,
	resizable = true,
	singleLine = false,
	toolbar = "basic",
	value,
}: RichTextEditorProps) {
	const mentionsRef = useRef<MentionItem[]>(mentions ?? []);
	mentionsRef.current = mentions ?? [];
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const withMentions = mentions !== undefined;

	// Once the user drags the resize handle we switch from "auto-grow" to a
	// fixed, scrollable height; undefined keeps the original auto-grow look.
	const [customHeight, setCustomHeight] = useState<number | undefined>(
		undefined
	);
	const dragRef = useRef<{ startHeight: number; startY: number } | null>(null);

	const handleResizeStart = useCallback(
		(event: React.PointerEvent) => {
			event.preventDefault();
			dragRef.current = {
				startHeight: customHeight ?? minHeight,
				startY: event.clientY,
			};
			const onMove = (moveEvent: PointerEvent) => {
				if (!dragRef.current) {
					return;
				}
				const delta = moveEvent.clientY - dragRef.current.startY;
				const next = Math.min(
					maxHeight,
					Math.max(minHeight, dragRef.current.startHeight + delta)
				);
				setCustomHeight(next);
			};
			const onUp = () => {
				dragRef.current = null;
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
			};
			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
		},
		[customHeight, minHeight, maxHeight]
	);

	const extensions = useMemo(
		() =>
			buildExtensions({
				getMentions: () => mentionsRef.current,
				maxLength,
				placeholder,
				singleLine,
				withMentions,
			}),
		[maxLength, placeholder, singleLine, withMentions]
	);

	const editor = useEditor(
		{
			content: value || "",
			editable: !disabled,
			editorProps: {
				attributes: {
					"aria-label": ariaLabel ?? placeholder ?? "Rich text",
					"aria-multiline": singleLine ? "false" : "true",
					class: cn(
						"prose prose-sm dark:prose-invert max-w-none px-3 py-2 outline-none",
						"[&_.mention]:rounded [&_.mention]:bg-primary/10 [&_.mention]:px-1 [&_.mention]:font-medium [&_.mention]:text-primary",
						"[&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:text-muted-foreground [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
						"[&_table]:w-full [&_td]:border [&_td]:p-1 [&_th]:border [&_th]:bg-muted [&_th]:p-1",
						"[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:gap-2"
					),
					role: "textbox",
				},
				handleKeyDown: (_view, event) => singleLine && event.key === "Enter",
			},
			extensions,
			immediatelyRender: false,
			onBlur: () => onBlur?.(),
			onUpdate: ({ editor: e }) => {
				const html = e.getHTML();
				onChangeRef.current(html === EMPTY_DOC ? "" : html);
			},
		},
		[extensions]
	);

	// Keep the editor in sync when the value changes from outside (undo, reset…).
	useEffect(() => {
		if (!editor || editor.isDestroyed) {
			return;
		}
		const current = editor.getHTML();
		if ((value || "") !== (current === EMPTY_DOC ? "" : current)) {
			editor.commands.setContent(value || "", { emitUpdate: false });
		}
	}, [editor, value]);

	useEffect(() => {
		editor?.setEditable(!disabled);
	}, [editor, disabled]);

	const count = editor?.storage.characterCount?.characters?.() as
		| number
		| undefined;

	return (
		<div
			aria-invalid={invalid || undefined}
			className={cn(
				"overflow-hidden border border-input bg-background text-sm transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/25",
				invalid && "border-destructive ring-1 ring-destructive/20",
				disabled && "cursor-not-allowed opacity-60",
				className
			)}
		>
			{editor && toolbar !== "none" && !disabled ? (
				<RichTextToolbar
					ai={ai}
					editor={editor}
					mentions={mentions}
					onImageUpload={onImageUpload}
					variant={singleLine ? "basic" : toolbar}
				/>
			) : null}
			<EditorContent
				editor={editor}
				style={contentStyle(singleLine, customHeight, minHeight)}
			/>
			{!(singleLine || disabled) && resizable ? (
				<div
					aria-hidden="true"
					className="flex h-3 cursor-row-resize items-center justify-center border-t bg-muted/30 hover:bg-muted"
					onPointerDown={handleResizeStart}
					style={{ touchAction: "none" }}
					title="Drag to resize"
				>
					<div className="h-0.5 w-8 rounded-full bg-border" />
				</div>
			) : null}
			{maxLength && count !== undefined ? (
				<div className="px-3 pb-1 text-right text-muted-foreground text-xs">
					{count}/{maxLength}
				</div>
			) : null}
		</div>
	);
}
