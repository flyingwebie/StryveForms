import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemMedia,
	ItemTitle,
} from "@StryveForms/ui/components/item";
import { Switch } from "@StryveForms/ui/components/switch";
import {
	MoreHorizontalIcon,
	PencilIcon,
	ScrollTextIcon,
	SendIcon,
	Trash2Icon,
} from "lucide-react";

import { IntegrationBadge } from "./brand-icons";

const RECIPIENT_SPLIT = /[\n,;]+/;
const TAG = /<[^>]+>/g;
const URL_KEYS = [
	"webhook_url",
	"hook_url",
	"slack_webhook_url",
	"discord_webhook_url",
];

/** Strips mention/other HTML tags for a plain-text summary. */
function plainText(html: string | undefined): string {
	return (html ?? "").replace(TAG, "").trim();
}

/** A short "where this goes" summary, read straight from the integration's own data. */
function targetSummary(
	integrationId: string,
	data: Record<string, unknown>
): string | null {
	if (integrationId === "email") {
		const sendTo = plainText(
			typeof data.send_to === "string" ? data.send_to : ""
		);
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
					{integration.logic ? <Badge variant="info">Conditional</Badge> : null}
					{needsReconnect ? (
						<Badge variant="warning">Needs reconnecting</Badge>
					) : null}
				</ItemTitle>
				<p className="line-clamp-1 text-muted-foreground text-xs">
					{needsReconnect
						? "Its secret wasn't included in the workspace it was imported from — re-enter it to turn this back on."
						: (target ?? "No destination set yet")}
				</p>
			</ItemContent>
			{lastRun ? (
				<div className="hidden shrink-0 flex-col text-xs sm:flex">
					<span className="text-subtle-foreground">Last run</span>
					<span
						className={
							lastRun.type === "success"
								? "text-muted-foreground"
								: "text-destructive"
						}
					>
						{lastRun.type === "success" ? "Sent " : "Failed "}
						{new Date(lastRun.createdAt).toLocaleString()}
					</span>
				</div>
			) : null}
			<ItemActions>
				<Button onClick={onTest} size="sm" variant="ghost">
					<SendIcon /> Send test
				</Button>
				<Button onClick={onViewEvents} size="sm" variant="ghost">
					<ScrollTextIcon /> Delivery log
				</Button>
				<Switch
					checked={integration.status === "active"}
					onCheckedChange={onToggle}
				/>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button size="icon-sm" variant="ghost" />}
					>
						<MoreHorizontalIcon />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onEdit}>
							<PencilIcon /> Edit
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onDelete} variant="destructive">
							<Trash2Icon /> Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</ItemActions>
		</Item>
	);
}
