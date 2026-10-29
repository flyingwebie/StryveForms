import type { ReactNode } from "react";
import { choiceLetterTheme, choiceOptionTheme, kbdHintTheme } from "./theme";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** A/B/C… for a focused-mode choice option's index, wrapping past 26 options. */
export function optionLetter(index: number): string {
	return LETTERS[index % LETTERS.length] ?? "";
}

export interface ChoiceOptionProps {
	children: ReactNode;
	disabled?: boolean;
	/** Shows the lettered indicator + keyboard-shortcut hint (focused mode's `use_focused_selector` cards only). */
	letter?: string;
	onClick: () => void;
	selected: boolean;
}

/** A bordered, selectable option card — optionally with a focused-mode letter badge (left) and keyboard hint (right). */
export function ChoiceOption({
	children,
	disabled,
	letter,
	onClick,
	selected,
}: ChoiceOptionProps) {
	return (
		<button
			aria-pressed={selected}
			className={choiceOptionTheme({ selected })}
			data-option-letter={letter}
			disabled={disabled}
			onClick={onClick}
			type="button"
		>
			<span className="flex min-w-0 items-center gap-3">
				{letter ? (
					<span aria-hidden="true" className={choiceLetterTheme({ selected })}>
						{letter}
					</span>
				) : null}
				<span className="min-w-0 truncate">{children}</span>
			</span>
			{letter ? (
				<span aria-hidden="true" className={kbdHintTheme}>
					{letter}
				</span>
			) : null}
		</button>
	);
}
