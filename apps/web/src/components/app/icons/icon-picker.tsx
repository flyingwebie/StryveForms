import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@StryveForms/ui/components/popover";
import { ScrollArea } from "@StryveForms/ui/components/scroll-area";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@StryveForms/ui/components/tabs";
import { cn } from "@StryveForms/ui/lib/utils";
import { SearchIcon, SmileIcon } from "lucide-react";
import { iconNames } from "lucide-react/dynamic";
import { useEffect, useMemo, useState } from "react";
import { type EmojiDataset, loadEmojiData } from "./emoji-data";
import EntityIcon from "./entity-icon";
import {
	isLucideIconValue,
	parseIconValue,
	toLucideIconValue,
} from "./icon-value";

const MAX_ICON_RESULTS = 160;

/** A broad starter set shown before the user searches — common, generic icons. */
const DEFAULT_ICON_NAMES = [
	"folder",
	"briefcase",
	"rocket",
	"star",
	"heart",
	"zap",
	"target",
	"sparkles",
	"settings",
	"users",
	"home",
	"calendar",
	"inbox",
	"flag",
	"bookmark",
	"globe",
	"shield",
	"bell",
	"camera",
	"music",
	"gift",
	"trophy",
	"lightbulb",
	"book",
	"map",
	"pin",
	"clock",
	"mail",
	"phone",
	"chart-bar",
	"chart-pie",
	"layers",
	"box",
	"package",
	"tag",
	"palette",
	"wand",
	"puzzle",
	"gem",
	"crown",
	"compass",
	"anchor",
	"feather",
	"leaf",
	"sun",
	"moon",
	"cloud",
	"umbrella",
	"shapes",
	"smile",
] as const;

export interface IconPickerProps {
	/** Tints a chosen Lucide icon; the colour picked alongside it (workspace/folder colour). */
	color?: string | null;
	disabled?: boolean;
	/** Used in the trigger's accessible label, e.g. "workspace icon". */
	label?: string;
	onChange: (value: string | null) => void;
	triggerClassName?: string;
	/** Current stored icon value: a plain emoji, "lucide:<name>", or null for none. */
	value: string | null;
}

/**
 * Icon picker with two tabs: the full emoji set (searchable, grouped by
 * category) and every Lucide icon (searchable, tinted with `color`). Stores
 * the choice as a plain emoji or "lucide:<name>" via onChange.
 */
export default function IconPicker({
	color,
	disabled,
	label = "icon",
	onChange,
	triggerClassName,
	value,
}: IconPickerProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [emojiData, setEmojiData] = useState<EmojiDataset | null>(null);
	const [loadingEmoji, setLoadingEmoji] = useState(false);

	// Load the emoji dataset once, the first time the picker opens.
	useEffect(() => {
		if (!(open && !emojiData) || loadingEmoji) {
			return;
		}
		setLoadingEmoji(true);
		loadEmojiData().then((data) => {
			setEmojiData(data);
			setLoadingEmoji(false);
		});
	}, [open, emojiData, loadingEmoji]);

	const normalizedQuery = query.trim().toLowerCase();

	const emojiGroups = useMemo(() => {
		if (!emojiData) {
			return [];
		}
		const filtered = normalizedQuery
			? emojiData.emoji.filter(
					(entry) =>
						entry.l.includes(normalizedQuery) ||
						entry.k.some((keyword) => keyword.includes(normalizedQuery))
				)
			: emojiData.emoji;
		const byGroup = new Map<number, typeof filtered>();
		for (const entry of filtered) {
			const list = byGroup.get(entry.g) ?? [];
			list.push(entry);
			byGroup.set(entry.g, list);
		}
		return [...byGroup.entries()]
			.sort(([a], [b]) => a - b)
			.map(([group, entries]) => ({
				entries,
				name: emojiData.groups[String(group)] ?? "Other",
			}));
	}, [emojiData, normalizedQuery]);

	const iconResults = useMemo(() => {
		const pool = normalizedQuery
			? iconNames.filter((name) => name.includes(normalizedQuery))
			: DEFAULT_ICON_NAMES;
		return pool.slice(0, MAX_ICON_RESULTS);
	}, [normalizedQuery]);

	function pick(next: string | null) {
		onChange(next);
		setOpen(false);
		setQuery("");
	}

	const initialTab = isLucideIconValue(value) ? "icons" : "emoji";
	const currentIcon = parseIconValue(value);

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger
				render={
					<button
						aria-label={`Choose ${label}`}
						className={cn(
							"flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-base transition-colors hover:bg-muted disabled:opacity-50",
							triggerClassName
						)}
						disabled={disabled}
						type="button"
					/>
				}
			>
				<EntityIcon
					color={color}
					fallback={<SmileIcon className="size-5 text-muted-foreground" />}
					icon={value}
					size={20}
				/>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80 gap-0 p-0">
				<Tabs className="gap-0" defaultValue={initialTab} key={open ? 1 : 0}>
					<div className="flex items-center justify-between gap-2 border-b p-2">
						<TabsList>
							<TabsTrigger value="emoji">Emoji</TabsTrigger>
							<TabsTrigger value="icons">Icons</TabsTrigger>
						</TabsList>
						{currentIcon.kind === "none" ? null : (
							<Button
								className="h-7 px-2 text-xs"
								onClick={() => pick(null)}
								size="sm"
								type="button"
								variant="ghost"
							>
								Clear
							</Button>
						)}
					</div>

					<div className="p-2">
						<div className="relative">
							<SearchIcon className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
							<Input
								className="h-8 pl-7"
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Search…"
								value={query}
							/>
						</div>
					</div>

					<TabsContent value="emoji">
						<ScrollArea className="h-64 px-2 pb-2">
							{loadingEmoji ? (
								<p className="p-4 text-center text-muted-foreground text-xs">
									Loading emoji…
								</p>
							) : null}
							{!loadingEmoji && emojiGroups.length === 0 ? (
								<p className="p-4 text-center text-muted-foreground text-xs">
									No emoji match "{query}".
								</p>
							) : null}
							{emojiGroups.map((group) => (
								<div
									className="mb-3"
									key={group.name}
									style={{ contentVisibility: "auto" }}
								>
									<p className="px-1 pb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
										{group.name}
									</p>
									<div className="grid grid-cols-8 gap-0.5">
										{group.entries.map((entry) => (
											<button
												aria-label={entry.l}
												className="flex size-8 items-center justify-center rounded-lg text-lg hover:bg-muted"
												key={entry.e}
												onClick={() => pick(entry.e)}
												title={entry.l}
												type="button"
											>
												{entry.e}
											</button>
										))}
									</div>
								</div>
							))}
						</ScrollArea>
					</TabsContent>

					<TabsContent value="icons">
						<ScrollArea className="h-64 px-2 pb-2">
							{normalizedQuery ? null : (
								<p className="px-1 pb-2 text-[11px] text-muted-foreground">
									Common icons — search for more.
								</p>
							)}
							{iconResults.length === 0 ? (
								<p className="p-4 text-center text-muted-foreground text-xs">
									No icons match "{query}".
								</p>
							) : (
								<div className="grid grid-cols-8 gap-0.5">
									{iconResults.map((name) => (
										<button
											aria-label={name}
											className="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
											key={name}
											onClick={() => pick(toLucideIconValue(name))}
											title={name}
											type="button"
										>
											<EntityIcon
												color={color}
												icon={toLucideIconValue(name)}
												size={16}
											/>
										</button>
									))}
								</div>
							)}
							{normalizedQuery && iconResults.length === MAX_ICON_RESULTS ? (
								<p className="px-1 pt-2 text-[11px] text-muted-foreground">
									Showing the first {MAX_ICON_RESULTS} matches — refine your
									search for more.
								</p>
							) : null}
						</ScrollArea>
					</TabsContent>
				</Tabs>
			</PopoverContent>
		</Popover>
	);
}
