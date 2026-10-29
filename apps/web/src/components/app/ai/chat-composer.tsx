import { Button } from "@StryveForms/ui/components/button";
import { Textarea } from "@StryveForms/ui/components/textarea";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

interface ChatComposerProps {
	disabled?: boolean;
	/** Rendered left of the model label (e.g. `ComposerAttachFormButton`) — omitted in compact mode. */
	formContext?: ReactNode;
	isStreaming: boolean;
	/** The workspace's configured chat model (e.g. "gpt-4o"), shown as "Using <model>". */
	modelLabel?: string | null;
	onSend: (text: string) => void;
	onStop: () => void;
	placeholder?: string;
}

/** The message input bar: grows with content, Enter sends, Shift+Enter adds a line, Stop while streaming. */
export function ChatComposer({
	disabled,
	formContext,
	isStreaming,
	modelLabel,
	onSend,
	onStop,
	placeholder,
}: ChatComposerProps) {
	const [value, setValue] = useState("");

	const send = () => {
		const trimmed = value.trim();
		if (!trimmed || isStreaming) {
			return;
		}
		onSend(trimmed);
		setValue("");
	};

	return (
		<div className="p-3 sm:p-4">
			<div className="flex flex-col gap-2 rounded-2xl border border-input bg-background p-2 shadow-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
				<Textarea
					className="max-h-40 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
					disabled={disabled}
					onChange={(event) => setValue(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.shiftKey) {
							event.preventDefault();
							send();
						}
					}}
					placeholder={
						placeholder ??
						"Ask the assistant to build a form, or ask about this form's responses…"
					}
					rows={2}
					value={value}
				/>
				<div className="flex items-center justify-between gap-2 px-1 pb-1">
					<div className="flex min-w-0 items-center gap-2">
						{formContext}
						{modelLabel ? (
							<span className="truncate text-muted-foreground text-xs">
								Using {modelLabel}
							</span>
						) : null}
					</div>
					{isStreaming ? (
						<Button aria-label="Stop generating" onClick={onStop} size="sm">
							<SquareIcon /> Stop generating
						</Button>
					) : (
						<Button
							aria-label="Send message"
							disabled={disabled || !value.trim()}
							onClick={send}
							size="sm"
						>
							Send <ArrowUpIcon />
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
