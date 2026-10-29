import { cn } from "@StryveForms/ui/lib/utils";
import type { ComponentProps } from "react";
import PhoneNumberInput, {
	type Country,
	getCountries,
	getCountryCallingCode,
} from "react-phone-number-input";
import en from "react-phone-number-input/locale/en";

export interface PhoneInputProps {
	"aria-describedby"?: string;
	"aria-label"?: string;
	className?: string;
	/** ISO country preselected when the field is empty, e.g. "US". */
	defaultCountry?: string;
	disabled?: boolean;
	id?: string;
	invalid?: boolean;
	name?: string;
	onBlur?: () => void;
	onChange: (value?: string) => void;
	placeholder?: string;
	/** ISO codes hidden from the country list. */
	unavailableCountries?: string[];
	/** E.164 value, e.g. "+12025550142". */
	value?: string;
}

const ALL_COUNTRIES = getCountries();
const REGIONAL_INDICATOR_OFFSET = 127_397;

function flagEmoji(country: string): string {
	return String.fromCodePoint(
		...[...country.toUpperCase()].map(
			(c) => (c.codePointAt(0) ?? 0) + REGIONAL_INDICATOR_OFFSET
		)
	);
}

interface CountrySelectProps {
	disabled?: boolean;
	onChange: (value?: Country) => void;
	options: { label: string; value?: Country }[];
	value?: Country;
}

function CountrySelect({
	disabled,
	onChange,
	options,
	value,
}: CountrySelectProps) {
	return (
		<div className="relative flex shrink-0 items-center border-input border-r bg-muted/40 px-2">
			<span
				aria-hidden="true"
				className="pointer-events-none text-base leading-none"
			>
				{value ? flagEmoji(value) : "🌐"}
			</span>
			<span
				aria-hidden="true"
				className="pointer-events-none ml-1 text-muted-foreground text-xs"
			>
				{value ? `+${getCountryCallingCode(value)}` : ""}
			</span>
			<select
				aria-label="Country"
				className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
				disabled={disabled}
				onChange={(event) =>
					onChange((event.target.value || undefined) as Country | undefined)
				}
				value={value ?? ""}
			>
				{options.map((option) => (
					<option
						key={option.value ?? "international"}
						value={option.value ?? ""}
					>
						{option.value
							? `${option.label} (+${getCountryCallingCode(option.value)})`
							: option.label}
					</option>
				))}
			</select>
		</div>
	);
}

function NumberInput({ className, ...props }: ComponentProps<"input">) {
	return (
		<input
			{...props}
			className={cn(
				"h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
				className
			)}
		/>
	);
}

/** International phone number input (react-phone-number-input) styled for shadcn. */
export function PhoneInput({
	"aria-describedby": describedBy,
	"aria-label": ariaLabel,
	className,
	defaultCountry,
	disabled,
	id,
	invalid,
	name,
	onBlur,
	onChange,
	placeholder,
	unavailableCountries,
	value,
}: PhoneInputProps) {
	const blocked = new Set(
		(unavailableCountries ?? []).map((c) => c.toUpperCase())
	);
	const countries = ALL_COUNTRIES.filter((c) => !blocked.has(c));
	const initialCountry = countries.find(
		(c) => c === defaultCountry?.toUpperCase()
	);
	return (
		<PhoneNumberInput
			aria-describedby={describedBy}
			aria-invalid={invalid || undefined}
			aria-label={ariaLabel}
			className={cn(
				"flex h-8 w-full items-stretch overflow-hidden border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/25",
				invalid && "border-destructive ring-1 ring-destructive/20",
				disabled && "opacity-50",
				className
			)}
			countries={countries}
			countrySelectComponent={CountrySelect}
			defaultCountry={initialCountry}
			disabled={disabled}
			id={id}
			inputComponent={NumberInput}
			international
			labels={en}
			name={name}
			onBlur={onBlur}
			onChange={(next) => onChange(next ?? undefined)}
			placeholder={placeholder}
			value={value || undefined}
		/>
	);
}
