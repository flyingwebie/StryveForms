import { fieldOptions } from "@StryveForms/forms/types";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@StryveForms/ui/components/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@StryveForms/ui/components/popover";
import { ChevronDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ChoiceOption, optionLetter } from "../choice-option";
import { choiceOptionTheme, compositeInputClass } from "../theme";
import type { FieldComponentProps } from "../types";
import { toStringArray } from "../value-utils";

/** Dropdown multi-select: search, chips for the current selection, optional "Create …", `max_selection`. */
function DropdownMultiSelect({
	borderRadius,
	disabled,
	error,
	field,
	id,
	onChange,
	options,
	size,
	value,
}: FieldComponentProps & { options: { id: string; name: string }[] }) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const selected = toStringArray(value);
	const max = field.max_selection ?? null;
	const atMax = max !== null && selected.length >= max;
	const normalizedQuery = query.trim().toLowerCase();
	const filtered = normalizedQuery
		? options.filter((o) => o.name.toLowerCase().includes(normalizedQuery))
		: options;
	const exactMatch = options.some(
		(o) => o.name.toLowerCase() === normalizedQuery
	);

	function toggle(name: string) {
		if (selected.includes(name)) {
			onChange(selected.filter((item) => item !== name));
			return;
		}
		if (max !== null && selected.length >= max) {
			return;
		}
		onChange([...selected, name]);
	}

	return (
		<div className="flex flex-col gap-2">
			<Popover onOpenChange={setOpen} open={open}>
				<PopoverTrigger
					render={
						<button
							aria-invalid={Boolean(error)}
							className={`flex w-full items-center justify-between gap-2 border border-neutral-300 bg-white px-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-75 dark:border-neutral-600 dark:bg-neutral-800 ${compositeInputClass(size, borderRadius)}`}
							disabled={disabled}
							id={id}
							type="button"
						/>
					}
				>
					<span
						className={
							selected.length > 0 ? "truncate" : "truncate text-neutral-400"
						}
					>
						{selected.length > 0
							? `${selected.length} selected`
							: field.placeholder || "Select options"}
					</span>
					<ChevronDown className="size-4 shrink-0 opacity-50" />
				</PopoverTrigger>
				<PopoverContent className="w-(--anchor-width) min-w-56 p-0">
					<Command shouldFilter={false}>
						<CommandInput
							onValueChange={setQuery}
							placeholder="Search…"
							value={query}
						/>
						<CommandList>
							<CommandEmpty>No results.</CommandEmpty>
							<CommandGroup>
								{filtered.map((option) => {
									const checked = selected.includes(option.name);
									return (
										<CommandItem
											aria-disabled={!checked && atMax}
											data-checked={checked}
											key={option.id}
											onSelect={() => {
												if (checked || !atMax) {
													toggle(option.name);
												}
											}}
										>
											{option.name}
										</CommandItem>
									);
								})}
							</CommandGroup>
							{field.allow_creation && query.trim() && !exactMatch && !atMax ? (
								<CommandGroup>
									<CommandItem
										onSelect={() => {
											toggle(query.trim());
											setQuery("");
										}}
									>
										Create “{query.trim()}”
									</CommandItem>
								</CommandGroup>
							) : null}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
			{selected.length > 0 ? (
				<div className="flex flex-wrap gap-1">
					{selected.map((name) => (
						<span
							className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--bg-form-color)_15%,transparent)] px-2 py-0.5 text-xs"
							key={name}
						>
							{name}
							<button
								aria-label={`Remove ${name}`}
								disabled={disabled}
								onClick={() => toggle(name)}
								type="button"
							>
								<X className="size-3" />
							</button>
						</span>
					))}
				</div>
			) : null}
		</div>
	);
}

/** Multi-select: dropdown with chips by default, checkbox list when `without_dropdown`, card grid when focused-mode. */
export function MultiSelectField(props: FieldComponentProps) {
	const { disabled, error, field, id, onChange, presentation, value } = props;
	const options = useMemo(() => fieldOptions(field), [field]);
	const selected = toStringArray(value);
	const max = field.max_selection ?? null;
	const useImages =
		field.option_display_mode === "text_and_image" ||
		field.option_display_mode === "image_only";

	function toggle(name: string, checked: boolean) {
		if (checked) {
			if (max !== null && selected.length >= max) {
				return;
			}
			onChange([...selected, name]);
		} else {
			onChange(selected.filter((item) => item !== name));
		}
	}

	if (field.use_focused_selector) {
		return (
			<div
				aria-invalid={Boolean(error)}
				className="grid grid-cols-1 gap-2 sm:grid-cols-2"
				id={id}
			>
				{options.map((option, index) => {
					const checked = selected.includes(option.name);
					// "image_only" shows just the picture; the label still reaches
					// screen readers as visually-hidden text instead of a visible span.
					const imageOnly =
						field.option_display_mode === "image_only" && Boolean(option.image);
					return (
						<ChoiceOption
							disabled={disabled}
							key={option.id}
							letter={
								presentation === "focused" ? optionLetter(index) : undefined
							}
							onClick={() => toggle(option.name, !checked)}
							selected={checked}
						>
							{useImages && option.image ? (
								<img
									alt={imageOnly ? option.name : ""}
									className="size-10 rounded object-cover"
									height={40}
									src={option.image}
									width={40}
								/>
							) : null}
							<span className={imageOnly ? "sr-only" : undefined}>
								{option.name}
							</span>
						</ChoiceOption>
					);
				})}
			</div>
		);
	}

	if (field.without_dropdown) {
		return (
			<div
				aria-invalid={Boolean(error)}
				className="flex flex-col gap-2"
				id={id}
			>
				{options.map((option) => {
					const imageOnly =
						field.option_display_mode === "image_only" && Boolean(option.image);
					const checked = selected.includes(option.name);
					return (
						<label
							className={choiceOptionTheme({ selected: checked })}
							htmlFor={`${id}-${option.id}`}
							key={option.id}
						>
							<span className="flex min-w-0 items-center gap-3">
								<Checkbox
									checked={checked}
									disabled={disabled}
									id={`${id}-${option.id}`}
									onCheckedChange={(next) => toggle(option.name, next === true)}
								/>
								{useImages && option.image ? (
									<img
										alt={imageOnly ? option.name : ""}
										className="size-8 rounded object-cover"
										height={32}
										src={option.image}
										width={32}
									/>
								) : null}
								<span className={imageOnly ? "sr-only" : "min-w-0 truncate"}>
									{option.name}
								</span>
							</span>
						</label>
					);
				})}
			</div>
		);
	}

	return <DropdownMultiSelect {...props} options={options} />;
}
