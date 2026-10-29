import { Button } from "@StryveForms/ui/components/button";
import { Textarea } from "@StryveForms/ui/components/textarea";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import { useState } from "react";

interface ChatComposerProps {
	disabled?: boolean;
	isStreaming: boolean;
	onSend: (text: string) => void;
	onStop: () => void;
	placeholder?: string;
}

/** The message input bar: grows with content, Enter sends, Shift+Enter adds a line, Stop while streaming. */
export function ChatComposer({
	disabled,
	isStreaming,
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
		<div className="flex items-end gap-2 border-t p-3">
			<Textarea
				className="max-h-40 flex-1 resize-none"
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
			{isStreaming ? (
				<Button aria-label="Stop generating" onClick={onStop} size="icon">
					<SquareIcon />
				</Button>
			) : (
				<Button
					aria-label="Send message"
					disabled={disabled || !value.trim()}
					onClick={send}
					size="icon"
				>
					<ArrowUpIcon />
				</Button>
			)}
		</div>
	);
}
