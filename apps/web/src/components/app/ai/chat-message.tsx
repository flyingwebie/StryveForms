import type { UIMessage } from "@tanstack/ai-react";

import { Markdown } from "./markdown";
import { ToolCallCard } from "./tool-call-card";

/** Renders one message's parts: text as markdown, tool calls as cards, thinking as a muted aside. */
export function ChatMessage({
	compact,
	message,
}: {
	/** Smaller bubbles/text — for the narrow editor AI tab. */
	compact?: boolean;
	message: UIMessage;
}) {
	if (message.role === "activity") {
		// A local-only note (e.g. "Context switched to …") from FormContextPicker —
		// never sent to the model, shown as a small centered divider.
		const text = message.parts
			.filter((part) => part.type === "text")
			.map((part) => part.content)
			.join(" ");
		return (
			<div className="flex justify-center">
				<span className="rounded-full bg-muted px-3 py-1 text-muted-foreground text-xs">
					{text}
				</span>
			</div>
		);
	}

	if (message.role === "user") {
		return (
			<div className="flex justify-end">
				<div
					className={`whitespace-pre-wrap rounded-xl bg-primary text-primary-foreground ${compact ? "max-w-[90%] px-3 py-2 text-xs" : "max-w-[85%] px-4 py-2.5 text-sm"}`}
				>
					{message.parts.map((part, index) =>
						part.type === "text" ? (
							// Message parts are appended in order and never reordered; text
							// parts carry no id of their own, so the index is a stable key here.
							// biome-ignore lint/suspicious/noArrayIndexKey: see above
							<span key={`${message.id}-${index}`}>{part.content}</span>
						) : null
					)}
				</div>
			</div>
		);
	}

	return (
		<div
			className={`flex flex-col gap-2 ${compact ? "max-w-[95%]" : "max-w-[85%]"}`}
		>
			{message.parts.map((part, index) => {
				const key = `${message.id}-${index}`;
				if (part.type === "text") {
					return <Markdown key={key} text={part.content} />;
				}
				if (part.type === "tool-call") {
					return (
						<ToolCallCard
							compact={compact}
							input={part.input}
							key={key}
							name={part.name}
							output={part.output}
							state={part.state}
						/>
					);
				}
				if (part.type === "thinking") {
					return (
						<p className="text-muted-foreground text-xs italic" key={key}>
							{part.content}
						</p>
					);
				}
				return null;
			})}
		</div>
	);
}
