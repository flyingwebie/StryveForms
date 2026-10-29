import { Button } from "@StryveForms/ui/components/button";
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
import { cn } from "@StryveForms/ui/lib/utils";
import { CheckIcon, ChevronsUpDownIcon, ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";

import {
	ensureStylesheet,
	FONT_CATEGORIES,
	fontFamilyValue,
	GOOGLE_FONTS,
	googleFontsPreviewCssUrl,
	isLoadableFontName,
	useGoogleFont,
} from "@/lib/google-fonts";

const PREVIEW_CSS = googleFontsPreviewCssUrl(GOOGLE_FONTS.map((f) => f.family));
const SAMPLE = "The quick brown fox jumps over the lazy form. 0123456789";

/**
 * Google Fonts picker: search, grouped suggestions shown in their own
 * typeface, any other Google Fonts family by name, and a live sample of the
 * chosen font. `null` means the theme's default font.
 */
export default function FontPicker({
	defaultLabel = "Default",
	id,
	onChange,
	value,
}: {
	defaultLabel?: string;
	id?: string;
	onChange: (family: string | null) => void;
	value: string | null;
}) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	useGoogleFont(value);

	useEffect(() => {
		if (open) {
			ensureStylesheet(PREVIEW_CSS);
		}
	}, [open]);

	const typed = search.trim();
	// Offer "use this name" only when no suggestion matches, so Enter after a
	// partial name ("Fraun") picks the real font, not a typo.
	const matchesSuggestion = GOOGLE_FONTS.some((font) =>
		font.family.toLowerCase().includes(typed.toLowerCase())
	);
	const canUseTyped =
		typed.length > 1 && !matchesSuggestion && isLoadableFontName(typed);

	function choose(family: string | null) {
		onChange(family);
		setOpen(false);
		setSearch("");
	}

	return (
		<div className="flex flex-col gap-2">
			<Popover onOpenChange={setOpen} open={open}>
				<PopoverTrigger
					render={
						<Button
							className="w-full justify-between font-normal"
							id={id}
							type="button"
							variant="outline"
						/>
					}
				>
					<span
						className="truncate"
						style={value ? { fontFamily: fontFamilyValue(value) } : undefined}
					>
						{value ?? defaultLabel}
					</span>
					<ChevronsUpDownIcon className="text-muted-foreground" />
				</PopoverTrigger>
				<PopoverContent align="start" className="w-72 p-0">
					<Command>
						<CommandInput
							onValueChange={setSearch}
							placeholder="Search Google Fonts…"
							value={search}
						/>
						<CommandList className="max-h-80">
							<CommandEmpty>
								{canUseTyped
									? null
									: "No match. Type a Google Fonts family name to use it."}
							</CommandEmpty>
							<CommandGroup>
								<CommandItem onSelect={() => choose(null)} value="default">
									{defaultLabel}
									{value ? null : <CheckIcon className="ml-auto" />}
								</CommandItem>
							</CommandGroup>
							{FONT_CATEGORIES.map((category) => (
								<CommandGroup heading={category} key={category}>
									{GOOGLE_FONTS.filter(
										(font) => font.category === category
									).map((font) => (
										<CommandItem
											key={font.family}
											onSelect={() => choose(font.family)}
											value={font.family}
										>
											<span
												className="truncate text-[15px]"
												style={{ fontFamily: fontFamilyValue(font.family) }}
											>
												{font.family}
											</span>
											{value === font.family ? (
												<CheckIcon className="ml-auto" />
											) : null}
										</CommandItem>
									))}
								</CommandGroup>
							))}
							{canUseTyped ? (
								<CommandGroup heading="Any Google Font">
									<CommandItem
										onSelect={() => choose(typed)}
										value={`use-${typed}`}
									>
										Use “{typed}” from Google Fonts
									</CommandItem>
								</CommandGroup>
							) : null}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
			<p
				className={cn(
					"rounded-lg border border-border bg-subtle px-3 py-2 text-[15px] leading-snug",
					!value && "text-muted-foreground"
				)}
				style={value ? { fontFamily: fontFamilyValue(value) } : undefined}
			>
				{SAMPLE}
			</p>
			<a
				className="inline-flex w-fit items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
				href="https://fonts.google.com"
				rel="noopener"
				target="_blank"
			>
				Browse all Google Fonts <ExternalLinkIcon className="size-3" />
			</a>
		</div>
	);
}
