import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import { Input } from "@StryveForms/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@StryveForms/ui/components/popover";
import { Separator } from "@StryveForms/ui/components/separator";
import { Toggle } from "@StryveForms/ui/components/toggle";
import { cn } from "@StryveForms/ui/lib/utils";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
	AtSign,
	Bold,
	Code,
	Eraser,
	Heading1,
	Heading2,
	Heading3,
	Highlighter,
	ImageIcon,
	Italic,
	Link2,
	List,
	ListChecks,
	ListOrdered,
	Loader2,
	Minus,
	MousePointerClick,
	Palette,
	Quote,
	Redo2,
	SparklesIcon,
	SquareCode,
	SquarePlay,
	Strikethrough,
	Subscript,
	Superscript,
	Table,
	Underline,
	Undo2,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

import type { MentionItem } from "./field-mention";

export type ToolbarVariant = "full" | "basic";

/** Quick AI writing actions offered from the toolbar's "AI" menu. */
export type AiAction =
	| "write"
	| "improve"
	| "shorten"
	| "friendlier"
	| "formal"
	| "grammar"
	| "translate";

export interface AiToolbarConfig {
	/** Whether a workspace AI provider is configured; `false` shows `hint` instead of the action menu. */
	available: boolean;
	/** Shown (as a popover) instead of the menu when `available` is false, e.g. a link to Settings. */
	hint?: ReactNode;
	/** Runs the action and returns the new HTML to replace the editor's content with. */
	onAction: (input: {
		action: AiAction;
		html: string;
		/** Free prompt for "write"; target language for "translate". */
		instruction?: string;
	}) => Promise<string>;
}

interface ToolbarProps {
	ai?: AiToolbarConfig;
	editor: Editor;
	mentions?: MentionItem[];
	onImageUpload?: (file: File) => Promise<string>;
	variant: ToolbarVariant;
}

function ToolButton({
	active,
	children,
	disabled,
	label,
	onClick,
}: {
	active?: boolean;
	children: ReactNode;
	disabled?: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<Toggle
			aria-label={label}
			disabled={disabled}
			onPressedChange={onClick}
			pressed={Boolean(active)}
			size="sm"
			title={label}
		>
			{children}
		</Toggle>
	);
}

function Divider() {
	return <Separator className="mx-0.5 h-5" orientation="vertical" />;
}

function UrlButton({
	active,
	children,
	initialUrl,
	label,
	onApply,
	placeholder = "https://example.com",
}: {
	active?: boolean;
	children: ReactNode;
	initialUrl?: () => string;
	label: string;
	onApply: (url: string) => void;
	placeholder?: string;
}) {
	const [url, setUrl] = useState("");
	const [open, setOpen] = useState(false);
	return (
		<Popover
			onOpenChange={(next) => {
				setOpen(next);
				if (next) {
					setUrl(initialUrl?.() ?? "");
				}
			}}
			open={open}
		>
			<PopoverTrigger
				render={
					<Button
						aria-label={label}
						className={cn(active && "bg-muted")}
						size="icon-sm"
						title={label}
						variant="ghost"
					/>
				}
			>
				{children}
			</PopoverTrigger>
			<PopoverContent className="w-72 p-2">
				<form
					className="flex gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						onApply(url.trim());
						setOpen(false);
					}}
				>
					<Input
						aria-label={`${label} URL`}
						onChange={(event) => setUrl(event.target.value)}
						placeholder={placeholder}
						value={url}
					/>
					<Button size="sm" type="submit">
						Apply
					</Button>
				</form>
			</PopoverContent>
		</Popover>
	);
}

function LinkButton({ editor }: { editor: Editor }) {
	return (
		<UrlButton
			active={editor.isActive("link")}
			initialUrl={() => editor.getAttributes("link").href ?? ""}
			label="Link"
			onApply={(url) => {
				const chain = editor.chain().focus().extendMarkRange("link");
				if (url === "") {
					chain.unsetLink().run();
				} else {
					chain.setLink({ href: url }).run();
				}
			}}
		>
			<Link2 />
		</UrlButton>
	);
}

function ColorButton({
	editor,
	kind,
}: {
	editor: Editor;
	kind: "text" | "highlight";
}) {
	const isText = kind === "text";
	const label = isText ? "Text colour" : "Highlight";
	return (
		<label
			className="relative inline-flex size-7 cursor-pointer items-center justify-center hover:bg-muted"
			title={label}
		>
			{isText ? (
				<Palette className="size-3.5" />
			) : (
				<Highlighter className="size-3.5" />
			)}
			<input
				aria-label={label}
				className="absolute inset-0 cursor-pointer opacity-0"
				onChange={(event) => {
					const color = event.target.value;
					if (isText) {
						editor.chain().focus().setColor(color).run();
					} else {
						editor.chain().focus().setHighlight({ color }).run();
					}
				}}
				type="color"
			/>
		</label>
	);
}

function ImageButton({
	editor,
	onImageUpload,
}: {
	editor: Editor;
	onImageUpload?: (file: File) => Promise<string>;
}) {
	const fileRef = useRef<HTMLInputElement>(null);
	if (!onImageUpload) {
		return (
			<UrlButton
				label="Image"
				onApply={(src) => src && editor.chain().focus().setImage({ src }).run()}
				placeholder="https://example.com/image.png"
			>
				<ImageIcon />
			</UrlButton>
		);
	}
	return (
		<>
			<ToolButton label="Image" onClick={() => fileRef.current?.click()}>
				<ImageIcon />
			</ToolButton>
			<input
				accept="image/*"
				aria-label="Upload image"
				className="hidden"
				onChange={async (event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) {
						const src = await onImageUpload(file);
						editor.chain().focus().setImage({ src, alt: file.name }).run();
					}
				}}
				ref={fileRef}
				type="file"
			/>
		</>
	);
}

function MentionButton({
	editor,
	mentions,
}: {
	editor: Editor;
	mentions: MentionItem[];
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label="Insert field"
						size="sm"
						title="Insert field"
						variant="ghost"
					/>
				}
			>
				<AtSign />
				<span className="hidden sm:inline">Field</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="max-h-72 overflow-y-auto">
				{mentions.length === 0 ? (
					<DropdownMenuItem disabled>No fields yet</DropdownMenuItem>
				) : (
					mentions.map((item) => (
						<DropdownMenuItem
							key={item.id}
							onClick={() =>
								editor
									.chain()
									.focus()
									.insertContent([
										{
											attrs: { fallback: "", id: item.id, label: item.label },
											type: "fieldMention",
										},
										{ text: " ", type: "text" },
									])
									.run()
							}
						>
							{item.label}
						</DropdownMenuItem>
					))
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function TableMenu({ editor }: { editor: Editor }) {
	const inTable = editor.isActive("table");
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label="Table"
						className={cn(inTable && "bg-muted")}
						size="icon-sm"
						title="Table"
						variant="ghost"
					/>
				}
			>
				<Table />
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem
					onClick={() =>
						editor
							.chain()
							.focus()
							.insertTable({ cols: 3, rows: 3, withHeaderRow: true })
							.run()
					}
				>
					Insert table
				</DropdownMenuItem>
				<DropdownMenuItem
					disabled={!inTable}
					onClick={() => editor.chain().focus().addRowAfter().run()}
				>
					Add row
				</DropdownMenuItem>
				<DropdownMenuItem
					disabled={!inTable}
					onClick={() => editor.chain().focus().addColumnAfter().run()}
				>
					Add column
				</DropdownMenuItem>
				<DropdownMenuItem
					disabled={!inTable}
					onClick={() => editor.chain().focus().deleteRow().run()}
				>
					Delete row
				</DropdownMenuItem>
				<DropdownMenuItem
					disabled={!inTable}
					onClick={() => editor.chain().focus().deleteColumn().run()}
				>
					Delete column
				</DropdownMenuItem>
				<DropdownMenuItem
					disabled={!inTable}
					onClick={() => editor.chain().focus().deleteTable().run()}
				>
					Delete table
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Inserts a call-to-action button (a styled link) — asks for the button text and URL. */
function CtaButtonTool({ editor }: { editor: Editor }) {
	const [label, setLabel] = useState("");
	const [url, setUrl] = useState("");
	const [open, setOpen] = useState(false);
	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger
				render={
					<Button
						aria-label="Button"
						size="icon-sm"
						title="Button (call-to-action link)"
						variant="ghost"
					/>
				}
			>
				<MousePointerClick />
			</PopoverTrigger>
			<PopoverContent className="w-72 space-y-2 p-2">
				<form
					className="space-y-2"
					onSubmit={(event) => {
						event.preventDefault();
						if (!url.trim()) {
							return;
						}
						editor
							.chain()
							.focus()
							.insertContent({
								attrs: {
									href: url.trim(),
									label: label.trim() || "Click here",
								},
								type: "ctaButton",
							})
							.run();
						setOpen(false);
						setLabel("");
						setUrl("");
					}}
				>
					<Input
						aria-label="Button text"
						onChange={(event) => setLabel(event.target.value)}
						placeholder="Button text"
						value={label}
					/>
					<Input
						aria-label="Button URL"
						onChange={(event) => setUrl(event.target.value)}
						placeholder="https://example.com"
						value={url}
					/>
					<Button className="w-full" size="sm" type="submit">
						Insert button
					</Button>
				</form>
			</PopoverContent>
		</Popover>
	);
}

const AI_ACTIONS: { action: AiAction; label: string; needsInput?: string }[] = [
	{ action: "improve", label: "Improve writing" },
	{ action: "shorten", label: "Shorten" },
	{ action: "friendlier", label: "Make friendlier" },
	{ action: "formal", label: "Make more formal" },
	{ action: "grammar", label: "Fix grammar" },
	{
		action: "translate",
		label: "Translate…",
		needsInput: "Target language",
	},
];

/** "AI" toolbar menu: write from a prompt, improve/shorten/tone/grammar, or translate. */
function AiMenu({ ai, editor }: { ai: AiToolbarConfig; editor: Editor }) {
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState<AiAction | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [inputFor, setInputFor] = useState<AiAction | null>(null);
	const [inputValue, setInputValue] = useState("");

	if (!ai.available) {
		return (
			<Popover onOpenChange={setOpen} open={open}>
				<PopoverTrigger
					render={
						<Button
							aria-label="AI writing help"
							size="sm"
							title="AI writing help"
							variant="ghost"
						/>
					}
				>
					<SparklesIcon /> <span className="hidden sm:inline">AI</span>
				</PopoverTrigger>
				<PopoverContent className="w-64 p-3 text-muted-foreground text-sm">
					{ai.hint ?? "No AI provider is configured for this workspace."}
				</PopoverContent>
			</Popover>
		);
	}

	const run = async (action: AiAction, instruction?: string) => {
		setPending(action);
		setError(null);
		try {
			const html = await ai.onAction({
				action,
				html: editor.getHTML(),
				instruction,
			});
			editor.commands.setContent(html, { emitUpdate: true });
			setOpen(false);
			setInputFor(null);
			setInputValue("");
		} catch (err) {
			setError(err instanceof Error ? err.message : "AI request failed");
		} finally {
			setPending(null);
		}
	};

	return (
		<Popover
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) {
					setInputFor(null);
					setError(null);
				}
			}}
			open={open}
		>
			<PopoverTrigger
				render={
					<Button
						aria-label="AI writing help"
						size="sm"
						title="AI writing help"
						variant="ghost"
					/>
				}
			>
				{pending ? <Loader2 className="animate-spin" /> : <SparklesIcon />}
				<span className="hidden sm:inline">AI</span>
			</PopoverTrigger>
			<PopoverContent className="w-64 space-y-1 p-2">
				{inputFor ? (
					<form
						className="space-y-2 p-1"
						onSubmit={(event) => {
							event.preventDefault();
							run(inputFor, inputValue.trim());
						}}
					>
						<Input
							autoFocus
							onChange={(event) => setInputValue(event.target.value)}
							placeholder={
								AI_ACTIONS.find((a) => a.action === inputFor)?.needsInput ??
								"What should it say?"
							}
							value={inputValue}
						/>
						<Button
							className="w-full"
							disabled={Boolean(pending)}
							size="sm"
							type="submit"
						>
							{pending ? "Working…" : "Go"}
						</Button>
					</form>
				) : (
					<>
						<DropdownMenuItem
							className="w-full"
							onClick={() => setInputFor("write")}
						>
							Write from a prompt…
						</DropdownMenuItem>
						<Separator />
						{AI_ACTIONS.map((item) =>
							item.needsInput ? (
								<DropdownMenuItem
									key={item.action}
									onClick={() => setInputFor(item.action)}
								>
									{item.label}
								</DropdownMenuItem>
							) : (
								<DropdownMenuItem
									disabled={Boolean(pending)}
									key={item.action}
									onClick={() => run(item.action)}
								>
									{item.label}
								</DropdownMenuItem>
							)
						)}
					</>
				)}
				{error ? (
					<p className="px-1 text-destructive text-xs">{error}</p>
				) : null}
			</PopoverContent>
		</Popover>
	);
}

function useActiveMarks(editor: Editor) {
	return useEditorState({
		editor,
		selector: ({ editor: e }) => ({
			blockquote: e.isActive("blockquote"),
			bold: e.isActive("bold"),
			bulletList: e.isActive("bulletList"),
			code: e.isActive("code"),
			codeBlock: e.isActive("codeBlock"),
			h1: e.isActive("heading", { level: 1 }),
			h2: e.isActive("heading", { level: 2 }),
			h3: e.isActive("heading", { level: 3 }),
			italic: e.isActive("italic"),
			orderedList: e.isActive("orderedList"),
			strike: e.isActive("strike"),
			subscript: e.isActive("subscript"),
			superscript: e.isActive("superscript"),
			taskList: e.isActive("taskList"),
			underline: e.isActive("underline"),
			align: (["left", "center", "right", "justify"] as const).find((a) =>
				e.isActive({ textAlign: a })
			),
			canRedo: e.can().redo(),
			canUndo: e.can().undo(),
		}),
	});
}

function FullTools({
	editor,
	onImageUpload,
}: {
	editor: Editor;
	onImageUpload?: ToolbarProps["onImageUpload"];
}) {
	const s = useActiveMarks(editor);
	const chain = () => editor.chain().focus();
	return (
		<>
			<ToolButton
				disabled={!s.canUndo}
				label="Undo"
				onClick={() => chain().undo().run()}
			>
				<Undo2 />
			</ToolButton>
			<ToolButton
				disabled={!s.canRedo}
				label="Redo"
				onClick={() => chain().redo().run()}
			>
				<Redo2 />
			</ToolButton>
			<Divider />
			<ToolButton
				active={s.h1}
				label="Heading 1"
				onClick={() => chain().toggleHeading({ level: 1 }).run()}
			>
				<Heading1 />
			</ToolButton>
			<ToolButton
				active={s.h2}
				label="Heading 2"
				onClick={() => chain().toggleHeading({ level: 2 }).run()}
			>
				<Heading2 />
			</ToolButton>
			<ToolButton
				active={s.h3}
				label="Heading 3"
				onClick={() => chain().toggleHeading({ level: 3 }).run()}
			>
				<Heading3 />
			</ToolButton>
			<Divider />
			<ToolButton
				active={s.strike}
				label="Strikethrough"
				onClick={() => chain().toggleStrike().run()}
			>
				<Strikethrough />
			</ToolButton>
			<ToolButton
				active={s.code}
				label="Inline code"
				onClick={() => chain().toggleCode().run()}
			>
				<Code />
			</ToolButton>
			<ToolButton
				active={s.subscript}
				label="Subscript"
				onClick={() => chain().toggleSubscript().run()}
			>
				<Subscript />
			</ToolButton>
			<ToolButton
				active={s.superscript}
				label="Superscript"
				onClick={() => chain().toggleSuperscript().run()}
			>
				<Superscript />
			</ToolButton>
			<ColorButton editor={editor} kind="text" />
			<ColorButton editor={editor} kind="highlight" />
			<Divider />
			<ToolButton
				active={s.align === "left"}
				label="Align left"
				onClick={() => chain().setTextAlign("left").run()}
			>
				<AlignLeft />
			</ToolButton>
			<ToolButton
				active={s.align === "center"}
				label="Align centre"
				onClick={() => chain().setTextAlign("center").run()}
			>
				<AlignCenter />
			</ToolButton>
			<ToolButton
				active={s.align === "right"}
				label="Align right"
				onClick={() => chain().setTextAlign("right").run()}
			>
				<AlignRight />
			</ToolButton>
			<ToolButton
				active={s.align === "justify"}
				label="Justify"
				onClick={() => chain().setTextAlign("justify").run()}
			>
				<AlignJustify />
			</ToolButton>
			<Divider />
			<ToolButton
				active={s.taskList}
				label="Checklist"
				onClick={() => chain().toggleTaskList().run()}
			>
				<ListChecks />
			</ToolButton>
			<ToolButton
				active={s.blockquote}
				label="Quote"
				onClick={() => chain().toggleBlockquote().run()}
			>
				<Quote />
			</ToolButton>
			<ToolButton
				active={s.codeBlock}
				label="Code block"
				onClick={() => chain().toggleCodeBlock().run()}
			>
				<SquareCode />
			</ToolButton>
			<ToolButton
				label="Divider"
				onClick={() => chain().setHorizontalRule().run()}
			>
				<Minus />
			</ToolButton>
			<ImageButton editor={editor} onImageUpload={onImageUpload} />
			<TableMenu editor={editor} />
			<CtaButtonTool editor={editor} />
			<UrlButton
				label="Video"
				onApply={(src) => src && chain().setYoutubeVideo({ src }).run()}
				placeholder="https://www.youtube.com/watch?v=…"
			>
				<SquarePlay />
			</UrlButton>
			<ToolButton
				label="Clear formatting"
				onClick={() => chain().unsetAllMarks().clearNodes().run()}
			>
				<Eraser />
			</ToolButton>
		</>
	);
}

export function RichTextToolbar({
	ai,
	editor,
	mentions,
	onImageUpload,
	variant,
}: ToolbarProps) {
	const s = useActiveMarks(editor);
	const chain = () => editor.chain().focus();
	return (
		<div
			className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1"
			role="toolbar"
		>
			<ToolButton
				active={s.bold}
				label="Bold"
				onClick={() => chain().toggleBold().run()}
			>
				<Bold />
			</ToolButton>
			<ToolButton
				active={s.italic}
				label="Italic"
				onClick={() => chain().toggleItalic().run()}
			>
				<Italic />
			</ToolButton>
			<ToolButton
				active={s.underline}
				label="Underline"
				onClick={() => chain().toggleUnderline().run()}
			>
				<Underline />
			</ToolButton>
			<LinkButton editor={editor} />
			<ToolButton
				active={s.bulletList}
				label="Bullet list"
				onClick={() => chain().toggleBulletList().run()}
			>
				<List />
			</ToolButton>
			<ToolButton
				active={s.orderedList}
				label="Numbered list"
				onClick={() => chain().toggleOrderedList().run()}
			>
				<ListOrdered />
			</ToolButton>
			{variant === "full" ? (
				<>
					<Divider />
					<FullTools editor={editor} onImageUpload={onImageUpload} />
				</>
			) : null}
			{mentions ? (
				<>
					<Divider />
					<MentionButton editor={editor} mentions={mentions} />
				</>
			) : null}
			{ai ? (
				<>
					<Divider />
					<AiMenu ai={ai} editor={editor} />
				</>
			) : null}
		</div>
	);
}
