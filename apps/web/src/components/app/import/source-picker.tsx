import { Badge } from "@StryveForms/ui/components/badge";
import { ArrowRightIcon, CheckIcon } from "lucide-react";

export type ImportSourceId = "opnform" | "jotform" | "stryveforms";

interface SourceInfo {
	badge: string;
	description: string;
	id: ImportSourceId;
	includes: string[];
	initials: string;
	name: string;
	/** Tailwind classes for the logo tile. */
	tile: string;
}

export const SOURCES: SourceInfo[] = [
	{
		badge: "Cloud or self-hosted",
		description:
			"Move everything over from OpnForm, keeping your links working.",
		id: "opnform",
		includes: [
			"Workspaces and members",
			"Forms, logic and design",
			"Submissions and uploaded files",
			"Integrations",
		],
		initials: "Op",
		name: "OpnForm",
		tile: "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900",
	},
	{
		badge: "US · EU · HIPAA · Enterprise",
		description:
			"Copy forms and every response from your JotForm account with an API key.",
		id: "jotform",
		includes: [
			"Forms and questions",
			"Submissions and uploaded files",
			"Email notifications and autoresponders",
			"Webhooks",
		],
		initials: "Jf",
		name: "JotForm",
		tile: "bg-orange-500 text-white",
	},
	{
		badge: "Workspace export file",
		description:
			"Load a .stryve.zip file exported from this or another StryveForms instance as a new workspace.",
		id: "stryveforms",
		includes: [
			"Forms, submissions and files",
			"Integrations and PDF templates",
			"Brand and workspace settings",
			"Members and pending invites",
		],
		initials: "Sf",
		name: "StryveForms file",
		tile: "bg-primary text-primary-foreground",
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
			className={`flex shrink-0 items-center justify-center rounded-xl font-bold ${info?.tile ?? ""} ${className}`}
		>
			{info?.initials}
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
					className="group flex flex-col gap-4 rounded-2xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
					key={source.id}
					onClick={() => onPick(source.id)}
					type="button"
				>
					<div className="flex items-start justify-between gap-3">
						<SourceLogo source={source.id} />
						<Badge variant="outline">{source.badge}</Badge>
					</div>
					<div>
						<h3 className="font-semibold text-base">
							Import from {source.name}
						</h3>
						<p className="mt-1 text-muted-foreground text-sm">
							{source.description}
						</p>
					</div>
					<ul className="grid gap-1.5 text-sm">
						{source.includes.map((item) => (
							<li className="flex items-center gap-2" key={item}>
								<CheckIcon className="size-3.5 text-primary" />
								{item}
							</li>
						))}
					</ul>
					<span className="mt-auto flex items-center gap-1 font-medium text-primary text-sm">
						Start
						<ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
					</span>
				</button>
			))}
		</div>
	);
}
