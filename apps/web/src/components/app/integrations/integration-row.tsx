import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemMedia,
	ItemTitle,
} from "@StryveForms/ui/components/item";
import { Switch } from "@StryveForms/ui/components/switch";
import {
	CheckCircle2Icon,
	ScrollTextIcon,
	SendIcon,
	Trash2Icon,
	XCircleIcon,
} from "lucide-react";

import { IntegrationBadge } from "./brand-icons";

const RECIPIENT_SPLIT = /[\n,;]+/;
const URL_KEYS = [
	"webhook_url",
	"hook_url",
	"slack_webhook_url",
	"discord_webhook_url",
];

/** A short "where this goes" summary, read straight from the integration's own data. */
function targetSummary(
	integrationId: string,
	data: Record<string, unknown>
): string | null {
	if (integrationId === "email") {
		const sendTo = typeof data.send_to === "string" ? data.send_to : "";
		const recipients = sendTo
			.split(RECIPIENT_SPLIT)
			.map((r) => r.trim())
			.filter(Boolean);
		return recipients.length > 0 ? recipients.join(", ") : null;
	}
	if (integrationId === "telegram") {
		return typeof data.chat_id === "string" && data.chat_id
			? `Chat ${data.chat_id}`
			: null;
	}
	for (const key of URL_KEYS) {
		const value = data[key];
		if (typeof value === "string" && value) {
			try {
				return new URL(value).host;
			} catch {
				return value;
			}
		}
	}
	return null;
}

export interface IntegrationRowData {
	data: Record<string, unknown>;
	id: string;
	integrationId: string;
	logic: Record<string, unknown> | null;
	/** Set by a workspace import when this integration lost its secret. */
	settings?: Record<string, unknown> | null;
	status: "active" | "inactive";
}

/** One row in the "Active integrations" list: icon, target, status, last run, actions. */
export function IntegrationRow({
	integration,
	lastRun,
	name,
	onDelete,
	onEdit,
	onTest,
	onToggle,
	onViewEvents,
}: {
	integration: IntegrationRowData;
	lastRun?: { createdAt: string | Date; type: string };
	name: string;
	onDelete: () => void;
	onEdit: () => void;
	onTest: () => void;
	onToggle: (checked: boolean) => void;
	onViewEvents: () => void;
}) {
	const target = targetSummary(integration.integrationId, integration.data);
	const needsReconnect = Boolean(integration.settings?.needsReconnect);

	return (
		<Item variant="outline">
			<ItemMedia>
				<IntegrationBadge id={integration.integrationId} />
			</ItemMedia>
			<ItemContent>
				<ItemTitle>
					<button className="hover:underline" onClick={onEdit} type="button">
						{name}
					</button>
					{integration.logic ? (
						<Badge variant="outline">Conditional</Badge>
					) : null}
					{needsReconnect ? (
						<Badge
							className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
							variant="outline"
						>
							Needs reconnecting
						</Badge>
					) : null}
				</ItemTitle>
				<p className="line-clamp-1 text-muted-foreground text-xs">
					{needsReconnect
						? "Its secret wasn't included in the workspace it was imported from — re-enter it to turn this back on."
						: (target ?? "No destination set yet")}
					{lastRun ? (
						<span className="ml-2 inline-flex items-center gap-1">
							{lastRun.type === "success" ? (
								<CheckCircle2Icon className="size-3 text-green-600" />
							) : (
								<XCircleIcon className="size-3 text-destructive" />
							)}
							{new Date(lastRun.createdAt).toLocaleString()}
						</span>
					) : null}
				</p>
			</ItemContent>
			<ItemActions>
				<Switch
					checked={integration.status === "active"}
					onCheckedChange={onToggle}
				/>
				<Button
					onClick={onTest}
					size="icon-sm"
					title="Send test"
					variant="ghost"
				>
					<SendIcon />
				</Button>
				<Button
					onClick={onViewEvents}
					size="icon-sm"
					title="View delivery log"
					variant="ghost"
				>
					<ScrollTextIcon />
				</Button>
				<Button
					className="text-destructive"
					onClick={onDelete}
					size="icon-sm"
					title="Delete"
					variant="ghost"
				>
					<Trash2Icon />
				</Button>
			</ItemActions>
		</Item>
	);
}
