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
	CopyIcon,
	MailIcon,
	Trash2Icon,
	XCircleIcon,
} from "lucide-react";

const RECIPIENT_SPLIT = /[\n,;]+/;
const TAG = /<[^>]+>/g;

/** Strips mention/other HTML tags for a plain-text list preview. */
function plainText(html: string | undefined): string {
	return (html ?? "").replace(TAG, "").trim();
}

export interface NotificationRecord {
	data: Record<string, unknown>;
	id: string;
	logic: Record<string, unknown> | null;
	status: "active" | "inactive";
}

export function NotificationRow({
	notification,
	lastRun,
	onDelete,
	onDuplicate,
	onEdit,
	onToggle,
}: {
	lastRun?: { createdAt: string | Date; type: string };
	notification: NotificationRecord;
	onDelete: () => void;
	onDuplicate: () => void;
	onEdit: () => void;
	onToggle: (checked: boolean) => void;
}) {
	const subject = plainText(notification.data.subject as string | undefined);
	const sendTo = plainText(notification.data.send_to as string | undefined);
	const recipients = sendTo
		.split(RECIPIENT_SPLIT)
		.map((r) => r.trim())
		.filter(Boolean);

	return (
		<Item variant="outline">
			<ItemMedia>
				<span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
					<MailIcon className="size-4" />
				</span>
			</ItemMedia>
			<ItemContent>
				<ItemTitle>
					<button className="hover:underline" onClick={onEdit} type="button">
						{subject || "(no subject yet)"}
					</button>
					{notification.logic ? (
						<Badge variant="outline">Conditional</Badge>
					) : null}
				</ItemTitle>
				<p className="line-clamp-1 text-muted-foreground text-xs">
					{recipients.length > 0 ? recipients.join(", ") : "No recipients set"}
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
					checked={notification.status === "active"}
					onCheckedChange={onToggle}
				/>
				<Button
					onClick={onDuplicate}
					size="icon-sm"
					title="Duplicate"
					variant="ghost"
				>
					<CopyIcon />
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
