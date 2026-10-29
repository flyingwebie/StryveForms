import { Fragment, type ReactNode } from "react";

/**
 * Minimal, safe markdown renderer for assistant replies: paragraphs,
 * headings, fenced code blocks, inline code, bold/italic, links, and
 * (un)ordered lists. Deliberately not a full CommonMark implementation —
 * just enough for chat replies — and it never uses
 * dangerouslySetInnerHTML: every bit of text reaches React as a plain
 * string, which escapes it automatically.
 */

const INLINE_PATTERN = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\)|_[^_]+_)/;
const LINK_PATTERN = /^\[([^\]]+)\]\(([^)\s]+)\)$/;
const SAFE_HREF = /^(https?:\/\/|\/)/;
const FENCE_LINE = /^```/;
const HEADING_LINE = /^(#{1,3})\s+(.*)/;
const QUOTE_LINE = /^>\s?/;
const BULLET_LINE = /^[-*]\s+/;
const ORDERED_LINE = /^\d+\.\s+/;
const OPENING_FENCE = /^```(\w*)/;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
	return text
		.split(INLINE_PATTERN)
		.filter((part) => part.length > 0)
		.map((part, index) => {
			const key = `${keyPrefix}-${index}`;
			if (part.startsWith("`") && part.endsWith("`")) {
				return (
					<code className="rounded bg-muted px-1 py-0.5 text-xs" key={key}>
						{part.slice(1, -1)}
					</code>
				);
			}
			if (part.startsWith("**") && part.endsWith("**")) {
				return <strong key={key}>{part.slice(2, -2)}</strong>;
			}
			if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
				return <em key={key}>{part.slice(1, -1)}</em>;
			}
			const link = part.match(LINK_PATTERN);
			if (link) {
				const [, label, href] = link;
				if (href && SAFE_HREF.test(href)) {
					return (
						<a
							className="underline underline-offset-4 hover:text-primary"
							href={href}
							key={key}
							rel="noopener noreferrer"
							target="_blank"
						>
							{label}
						</a>
					);
				}
				return <Fragment key={key}>{label}</Fragment>;
			}
			return <Fragment key={key}>{part}</Fragment>;
		});
}

interface Cursor {
	i: number;
	lines: string[];
}

type Block =
	| { content: string[]; type: "p" | "h1" | "h2" | "h3" | "quote" }
	| { content: string[]; lang: string; type: "code" }
	| { items: string[]; type: "ul" | "ol" };

function headingType(level: number): "h1" | "h2" | "h3" {
	if (level === 1) {
		return "h1";
	}
	if (level === 2) {
		return "h2";
	}
	return "h3";
}

/** Consumes a fenced code block; `cursor.i` must already be on the opening fence. */
function readCodeBlock(cursor: Cursor): Block {
	const fence = (cursor.lines[cursor.i] ?? "").match(OPENING_FENCE);
	const lang = fence?.[1] ?? "";
	const content: string[] = [];
	cursor.i += 1;
	while (
		cursor.i < cursor.lines.length &&
		!FENCE_LINE.test(cursor.lines[cursor.i] ?? "")
	) {
		content.push(cursor.lines[cursor.i] ?? "");
		cursor.i += 1;
	}
	cursor.i += 1; // skip the closing fence
	return { content, lang, type: "code" };
}

/** Consumes consecutive lines matching `pattern`, stripping it from each. */
function readRunOf(cursor: Cursor, pattern: RegExp): string[] {
	const items: string[] = [];
	while (
		cursor.i < cursor.lines.length &&
		pattern.test(cursor.lines[cursor.i] ?? "")
	) {
		items.push((cursor.lines[cursor.i] ?? "").replace(pattern, ""));
		cursor.i += 1;
	}
	return items;
}

function readParagraph(cursor: Cursor): Block {
	const content: string[] = [];
	while (
		cursor.i < cursor.lines.length &&
		(cursor.lines[cursor.i] ?? "").trim() !== "" &&
		!FENCE_LINE.test(cursor.lines[cursor.i] ?? "")
	) {
		content.push(cursor.lines[cursor.i] ?? "");
		cursor.i += 1;
	}
	return { content: [content.join(" ")], type: "p" };
}

function readNextBlock(cursor: Cursor): Block {
	const line = cursor.lines[cursor.i] ?? "";
	if (FENCE_LINE.test(line)) {
		return readCodeBlock(cursor);
	}
	const heading = line.match(HEADING_LINE);
	if (heading) {
		cursor.i += 1;
		return {
			content: [heading[2] ?? ""],
			type: headingType((heading[1] ?? "#").length),
		};
	}
	if (QUOTE_LINE.test(line)) {
		return { content: readRunOf(cursor, QUOTE_LINE), type: "quote" };
	}
	if (BULLET_LINE.test(line)) {
		return { items: readRunOf(cursor, BULLET_LINE), type: "ul" };
	}
	if (ORDERED_LINE.test(line)) {
		return { items: readRunOf(cursor, ORDERED_LINE), type: "ol" };
	}
	return readParagraph(cursor);
}

function parseBlocks(markdown: string): Block[] {
	const cursor: Cursor = {
		i: 0,
		lines: markdown.replace(/\r\n/g, "\n").split("\n"),
	};
	const blocks: Block[] = [];
	while (cursor.i < cursor.lines.length) {
		if ((cursor.lines[cursor.i] ?? "").trim() === "") {
			cursor.i += 1;
			continue;
		}
		blocks.push(readNextBlock(cursor));
	}
	return blocks;
}

function BlockView({ block, blockKey }: { block: Block; blockKey: string }) {
	switch (block.type) {
		case "h1":
			return (
				<h3 className="font-semibold text-base">
					{renderInline(block.content[0] ?? "", blockKey)}
				</h3>
			);
		case "h2":
			return (
				<h4 className="font-semibold text-sm">
					{renderInline(block.content[0] ?? "", blockKey)}
				</h4>
			);
		case "h3":
			return (
				<h5 className="font-medium text-sm">
					{renderInline(block.content[0] ?? "", blockKey)}
				</h5>
			);
		case "code":
			return (
				<pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
					<code>{block.content.join("\n")}</code>
				</pre>
			);
		case "quote":
			return (
				<blockquote className="border-muted-foreground/30 border-l-2 pl-3 text-muted-foreground">
					{block.content.join(" ")}
				</blockquote>
			);
		case "ul":
			return (
				<ul className="list-disc space-y-1 pl-5">
					{block.items.map((item) => (
						<li key={item}>{renderInline(item, blockKey)}</li>
					))}
				</ul>
			);
		case "ol":
			return (
				<ol className="list-decimal space-y-1 pl-5">
					{block.items.map((item) => (
						<li key={item}>{renderInline(item, blockKey)}</li>
					))}
				</ol>
			);
		default:
			return <p>{renderInline(block.content[0] ?? "", blockKey)}</p>;
	}
}

export function Markdown({ text }: { text: string }) {
	const blocks = parseBlocks(text);
	return (
		<div className="space-y-2 text-sm leading-relaxed">
			{blocks.map((block, index) => {
				const key = `b-${index}-${block.type}`;
				return <BlockView block={block} blockKey={key} key={key} />;
			})}
		</div>
	);
}
