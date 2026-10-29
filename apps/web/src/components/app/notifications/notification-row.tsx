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
	CopyIcon,
	MailIcon,
	MoreHorizontalIcon,
	PencilIcon,
	Trash2Icon,
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
				<span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
					<MailIcon className="size-4" />
				</span>
			</ItemMedia>
			<ItemContent>
				<ItemTitle>
					<button className="hover:underline" onClick={onEdit} type="button">
						{recipients.length > 0
							? recipients.join(", ")
							: "No recipients set"}
					</button>
					{notification.logic ? (
						<Badge variant="info">Conditional</Badge>
					) : null}
				</ItemTitle>
				<p className="line-clamp-1 text-muted-foreground text-xs">
					{subject || "(no subject yet)"}
				</p>
			</ItemContent>
			<ItemActions>
				{lastRun ? (
					<span
						className={
							lastRun.type === "success"
								? "text-muted-foreground text-xs"
								: "text-destructive text-xs"
						}
					>
						{lastRun.type === "success" ? "Sent " : "Failed "}
						{new Date(lastRun.createdAt).toLocaleString()}
					</span>
				) : null}
				<Switch
					checked={notification.status === "active"}
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
						<DropdownMenuItem onClick={onDuplicate}>
							<CopyIcon /> Duplicate
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
