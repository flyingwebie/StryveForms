import { fieldOptions } from "@StryveForms/forms/types";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@StryveForms/ui/components/command";
import {
	NativeSelect,
	NativeSelectOption,
} from "@StryveForms/ui/components/native-select";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@StryveForms/ui/components/popover";
import {
	RadioGroup,
	RadioGroupItem,
} from "@StryveForms/ui/components/radio-group";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { ChoiceOption, optionLetter } from "../choice-option";
import { choiceOptionTheme, compositeInputClass } from "../theme";
import type { FieldComponentProps } from "../types";
import { toText } from "../value-utils";

const MOD = 2_147_483_647;

function seededHash(seed: string): number {
	let h = 0;
	for (const char of seed) {
		h = (h * 31 + (char.codePointAt(0) ?? 0)) % MOD;
	}
	return h || 1;
}

/** Deterministic shuffle keyed by the field id, so the order is stable across re-renders. */
function shuffled<T>(items: T[], seed: string): T[] {
	let h = seededHash(seed);
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i -= 1) {
		h = (h * 1_103_515_245 + 12_345) % MOD;
		const j = h % (i + 1);
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

interface ComboboxOption {
	id: string;
	name: string;
}

interface CreatableComboboxProps {
	allowCreation: boolean;
	borderRadius: FieldComponentProps["borderRadius"];
	disabled: boolean;
	error?: string;
	id: string;
	onChange: (value: unknown) => void;
	options: ComboboxOption[];
	placeholder?: string;
	size: FieldComponentProps["size"];
	value: unknown;
}

/** Searchable single-select dropdown with a "Create …" entry, used for `select` + `allow_creation`. */
function CreatableCombobox({
	allowCreation,
	borderRadius,
	disabled,
	error,
	id,
	onChange,
	options,
	placeholder,
	size,
	value,
}: CreatableComboboxProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const current = toText(value);
	const normalizedQuery = query.trim().toLowerCase();
	const filtered = normalizedQuery
		? options.filter((o) => o.name.toLowerCase().includes(normalizedQuery))
		: options;
	const exactMatch = options.some(
		(o) => o.name.toLowerCase() === normalizedQuery
	);

	function pick(name: string) {
		onChange(name);
		setQuery("");
		setOpen(false);
	}

	return (
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
				<span className={current ? "truncate" : "truncate text-neutral-400"}>
					{current || placeholder || "Select an option"}
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
							{filtered.map((option) => (
								<CommandItem
									data-checked={current === option.name}
									key={option.id}
									onSelect={() => pick(option.name)}
								>
									{option.name}
								</CommandItem>
							))}
						</CommandGroup>
						{allowCreation && query.trim() && !exactMatch ? (
							<CommandGroup>
								<CommandItem onSelect={() => pick(query.trim())}>
									Create “{query.trim()}”
								</CommandItem>
							</CommandGroup>
						) : null}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

/** Dropdown (`select`), searchable+creatable dropdown (`select` + `allow_creation`), or single-choice radio (`without_dropdown`). */
export function SelectField({
	borderRadius,
	disabled,
	error,
	field,
	id,
	onChange,
	presentation,
	required,
	size,
	value,
}: FieldComponentProps) {
	const options = useMemo(() => {
		const base = fieldOptions(field);
		return field.shuffle_options ? shuffled(base, field.id) : base;
	}, [field]);
	const current = toText(value);
	const useImages =
		field.option_display_mode === "text_and_image" ||
		field.option_display_mode === "image_only";

	if (!field.without_dropdown) {
		if (field.allow_creation) {
			return (
				<CreatableCombobox
					allowCreation
					borderRadius={borderRadius}
					disabled={disabled}
					error={error}
					id={id}
					onChange={onChange}
					options={options}
					placeholder={field.placeholder}
					size={size}
					value={value}
				/>
			);
		}
		return (
			<NativeSelect
				aria-invalid={Boolean(error)}
				disabled={disabled}
				id={id}
				onChange={(e) => onChange(e.target.value || undefined)}
				required={required}
				value={current}
			>
				<NativeSelectOption value="">
					{field.placeholder || "Select an option"}
				</NativeSelectOption>
				{options.map((option) => (
					<NativeSelectOption key={option.id} value={option.name}>
						{option.name}
					</NativeSelectOption>
				))}
			</NativeSelect>
		);
	}

	if (field.use_focused_selector) {
		return (
			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2" id={id}>
				{options.map((option, index) => {
					const selected = current === option.name;
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
							onClick={() => onChange(option.name)}
							selected={selected}
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

	return (
		<RadioGroup
			aria-required={required}
			className="flex flex-col gap-2"
			id={id}
			onValueChange={(v) => onChange(v)}
			value={current}
		>
			{options.map((option) => {
				const imageOnly =
					field.option_display_mode === "image_only" && Boolean(option.image);
				const selected = current === option.name;
				return (
					<label
						className={choiceOptionTheme({ selected })}
						htmlFor={`${id}-${option.id}`}
						key={option.id}
					>
						<span className="flex min-w-0 items-center gap-3">
							<RadioGroupItem
								disabled={disabled}
								id={`${id}-${option.id}`}
								value={option.name}
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
		</RadioGroup>
	);
}
