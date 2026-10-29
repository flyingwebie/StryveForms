import { cn } from "@StryveForms/ui/lib/utils";
import type {
	SuggestionKeyDownProps,
	SuggestionProps,
} from "@tiptap/suggestion";
import { type Ref, useImperativeHandle, useState } from "react";

import type { MentionItem } from "./field-mention";

export interface MentionListHandle {
	onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

type MentionListProps = SuggestionProps<MentionItem> & {
	ref?: Ref<MentionListHandle>;
};

/** Popup shown while typing "@" to pick a field to mention. */
export function MentionList({ command, items, query, ref }: MentionListProps) {
	const [selection, setSelection] = useState({ index: 0, query });
	// Reset the highlight whenever the search text changes.
	const active = selection.query === query ? selection.index : 0;
	const setActive = (index: number) => setSelection({ index, query });

	const pick = (index: number) => {
		const item = items[index];
		if (item) {
			command(item);
		}
	};

	useImperativeHandle(ref, () => ({
		onKeyDown: ({ event }) => {
			const total = Math.max(items.length, 1);
			if (event.key === "ArrowDown") {
				setActive((active + 1) % total);
				return true;
			}
			if (event.key === "ArrowUp") {
				setActive((active - 1 + total) % total);
				return true;
			}
			if (event.key === "Enter" || event.key === "Tab") {
				pick(active);
				return true;
			}
			return false;
		},
	}));

	if (items.length === 0) {
		return (
			<div className="rounded-md border bg-popover p-2 text-muted-foreground text-xs shadow-md">
				No matching fields
			</div>
		);
	}
	return (
		<div
			aria-label="Fields"
			className="max-h-64 min-w-48 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
			role="listbox"
		>
			{items.map((item, index) => (
				<button
					aria-selected={index === active}
					className={cn(
						"flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs",
						index === active
							? "bg-accent text-accent-foreground"
							: "hover:bg-muted"
					)}
					key={item.id}
					onClick={() => pick(index)}
					onMouseEnter={() => setActive(index)}
					role="option"
					type="button"
				>
					{item.label}
				</button>
			))}
		</div>
	);
}
