import { Button } from "@StryveForms/ui/components/button";
import { cn } from "@StryveForms/ui/lib/utils";
import { CheckIcon, CopyIcon, WrapTextIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** Matches quoted strings, tag names, and attribute names so we can tint them lightly. */
const TOKEN_RE =
	/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|([a-zA-Z-]+(?==))|(<\/?[a-zA-Z][\w-]*|\/?>)/g;

/**
 * Light syntax tint for HTML-ish snippets: quoted attribute values, attribute
 * names, and tag names each get a subtle colour. Plain React text nodes only
 * (no dangerouslySetInnerHTML), so it's safe even if the snippet ever includes
 * untrusted text.
 */
function HighlightedCode({ code }: { code: string }) {
	const nodes: React.ReactNode[] = [];
	let lastIndex = 0;
	for (const match of code.matchAll(TOKEN_RE)) {
		const index = match.index ?? 0;
		const keyBase = `t${index}`;
		if (index > lastIndex) {
			nodes.push(
				<span key={`${keyBase}-plain`}>{code.slice(lastIndex, index)}</span>
			);
		}
		const [, str, attr, tag] = match;
		if (str) {
			nodes.push(
				<span className="text-emerald-400" key={keyBase}>
					{str}
				</span>
			);
		} else if (attr) {
			nodes.push(
				<span className="text-sky-400" key={keyBase}>
					{attr}
				</span>
			);
		} else if (tag) {
			nodes.push(
				<span className="text-rose-400" key={keyBase}>
					{tag}
				</span>
			);
		}
		lastIndex = index + match[0].length;
	}
	if (lastIndex < code.length) {
		nodes.push(<span key="tail">{code.slice(lastIndex)}</span>);
	}
	return <>{nodes}</>;
}

/**
 * A terminal-style code box: a title bar with traffic-light dots and a
 * filename/language label, a monospace body that wraps long lines by default
 * (toggle to scroll instead), and a prominent copy button. Used for every
 * snippet in the share UI so long embed codes never force the page to scroll
 * sideways.
 */
export function CodeBlock({
	className,
	code,
	filename,
	language,
}: {
	className?: string;
	code: string;
	/** Shown in the title bar, e.g. "embed.html". */
	filename?: string;
	/** Shown in the title bar when no filename is given, e.g. "HTML". */
	language?: string;
}) {
	const [copied, setCopied] = useState(false);
	const [wrap, setWrap] = useState(true);

	function handleCopy() {
		navigator.clipboard.writeText(code);
		toast.success("Copied to clipboard");
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}

	return (
		<div
			className={cn(
				"min-w-0 overflow-hidden rounded-xl bg-neutral-950 ring-1 ring-white/10",
				className
			)}
		>
			<div className="flex items-center justify-between gap-2 border-white/10 border-b px-3 py-2">
				<div className="flex min-w-0 items-center gap-2">
					<div aria-hidden="true" className="flex shrink-0 gap-1.5">
						<span className="size-2.5 rounded-full bg-red-500/80" />
						<span className="size-2.5 rounded-full bg-amber-500/80" />
						<span className="size-2.5 rounded-full bg-emerald-500/80" />
					</div>
					<span className="truncate font-mono text-neutral-400 text-xs">
						{filename ?? language ?? "snippet"}
					</span>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<Button
						className="text-neutral-400 hover:bg-white/10 hover:text-white"
						onClick={() => setWrap((w) => !w)}
						size="icon-sm"
						title={wrap ? "Don't wrap long lines" : "Wrap long lines"}
						type="button"
						variant="ghost"
					>
						<WrapTextIcon className={wrap ? "text-sky-400" : undefined} />
					</Button>
					<Button
						className="gap-1.5 text-neutral-100 hover:bg-white/10 hover:text-white"
						onClick={handleCopy}
						size="sm"
						type="button"
						variant="ghost"
					>
						{copied ? (
							<>
								<CheckIcon className="text-emerald-400" /> Copied
							</>
						) : (
							<>
								<CopyIcon /> Copy code
							</>
						)}
					</Button>
				</div>
			</div>
			<pre
				className={cn(
					"min-w-0 p-3 font-mono text-neutral-100 text-xs leading-relaxed",
					wrap
						? "whitespace-pre-wrap break-all"
						: "overflow-x-auto whitespace-pre"
				)}
			>
				<HighlightedCode code={code} />
			</pre>
		</div>
	);
}
