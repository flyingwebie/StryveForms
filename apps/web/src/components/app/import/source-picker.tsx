import { Badge } from "@StryveForms/ui/components/badge";
import { cn } from "@StryveForms/ui/lib/utils";
import { ArrowRightIcon } from "lucide-react";

export type ImportSourceId = "opnform" | "jotform" | "stryveforms";

interface SourceInfo {
	description: string;
	id: ImportSourceId;
	initial: string;
	name: string;
	popular?: boolean;
	/** Tailwind classes for the logo tile. */
	tile: string;
}

export const SOURCES: SourceInfo[] = [
	{
		description:
			"Connect your OpnForm account and bring over forms, submissions and files.",
		id: "opnform",
		initial: "O",
		name: "OpnForm",
		popular: true,
		tile: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
	},
	{
		description:
			"Connect with an API key and import your JotForm forms and responses.",
		id: "jotform",
		initial: "J",
		name: "JotForm",
		tile: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
	},
	{
		description: "Upload a .stryve.zip workspace export to restore it here.",
		id: "stryveforms",
		initial: "S",
		name: "StryveForms file",
		tile: "bg-primary-soft text-primary-soft-foreground",
	},
];

export function SourceLogo({
	className = "size-10 text-sm",
	source,
}: {
	className?: string;
	source: ImportSourceId;
}) {
	const info = SOURCES.find((s) => s.id === source);
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex shrink-0 items-center justify-center rounded-lg font-semibold",
				info?.tile,
				className
			)}
		>
			{info?.initial}
		</span>
	);
}

export default function SourcePicker({
	onPick,
}: {
	onPick: (source: ImportSourceId) => void;
}) {
	return (
		<div className="grid gap-4 md:grid-cols-3">
			{SOURCES.map((source) => (
				<button
					className="flex flex-col gap-4 rounded-2xl border bg-card p-5 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
					key={source.id}
					onClick={() => onPick(source.id)}
					type="button"
				>
					<div className="flex items-start justify-between gap-3">
						<SourceLogo source={source.id} />
						{source.popular ? (
							<Badge variant="soft">
								<span
									aria-hidden="true"
									className="size-1.5 rounded-full bg-current"
								/>
								Most popular
							</Badge>
						) : null}
					</div>
					<div>
						<h3 className="font-semibold text-base">{source.name}</h3>
						<p className="mt-1 text-muted-foreground text-sm">
							{source.description}
						</p>
					</div>
					<span className="mt-auto flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-input bg-background font-medium text-sm shadow-xs">
						<ArrowRightIcon className="size-4" />
						Connect
					</span>
				</button>
			))}
		</div>
	);
}
