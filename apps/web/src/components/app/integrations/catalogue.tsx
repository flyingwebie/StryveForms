import { PlusIcon } from "lucide-react";

import { IntegrationBadge } from "./brand-icons";

/** One-line, plain-language description of what each integration does. */
export const DESCRIPTIONS: Record<string, string> = {
	activepieces: "Trigger an Activepieces flow with the submission data.",
	albato: "Trigger an Albato automation with the submission data.",
	discord: "Post new submissions to a Discord channel.",
	email: "Email a notification to one or more addresses on every submission.",
	make: "Trigger a Make (Integromat) scenario.",
	n8n: "Trigger an n8n workflow with the submission data.",
	pabbly: "Trigger a Pabbly Connect workflow.",
	slack: "Post new submissions to a Slack channel.",
	telegram: "Send new submissions to a Telegram chat.",
	webhook: "POST a JSON payload to any URL you control.",
	zapier: "Trigger a Zap with the submission data.",
};

/** Grouped "add an integration" catalogue: icon, name, one-liner, hover state. */
export function IntegrationCatalogue({
	items,
	note,
	onAdd,
	title,
}: {
	items: { id: string; name: string }[];
	/** A small note + link shown next to the title, e.g. pointing at a moved feature. */
	note?: { href: string; label: string };
	onAdd: (integrationId: string) => void;
	title: string;
}) {
	if (items.length === 0 && !note) {
		return null;
	}
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="font-medium text-subtle-foreground text-xs uppercase tracking-wide">
					{title}
				</h3>
				{note ? (
					<a
						className="text-muted-foreground text-xs hover:text-foreground hover:underline"
						href={note.href}
					>
						{note.label} →
					</a>
				) : null}
			</div>
			<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{items.map((item) => (
					<button
						className="group flex items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-foreground/20 hover:bg-muted"
						key={item.id}
						onClick={() => onAdd(item.id)}
						type="button"
					>
						<IntegrationBadge id={item.id} />
						<div className="flex-1 space-y-0.5">
							<div className="flex items-center justify-between gap-2">
								<span className="font-medium text-sm">{item.name}</span>
								<PlusIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
							</div>
							<p className="line-clamp-2 text-muted-foreground text-xs">
								{DESCRIPTIONS[item.id] ??
									`Automate this form with ${item.name}.`}
							</p>
						</div>
					</button>
				))}
			</div>
		</div>
	);
}
