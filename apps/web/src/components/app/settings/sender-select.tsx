import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { useQuery } from "@tanstack/react-query";

import { Link } from "@tanstack/react-router";
import { useTRPC } from "@/utils/trpc";

const WORKSPACE_DEFAULT = "__workspace_default__";

/**
 * Picks one of the workspace's sender addresses (Settings → Email sending).
 * `value` null means "use the workspace default sender".
 */
export default function SenderSelect({
	onChange,
	value,
	workspaceId,
}: {
	onChange: (senderId: string | null) => void;
	value: string | null;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const detail = useQuery(trpc.workspace.get.queryOptions({ id: workspaceId }));
	const settings = detail.data?.settings as
		| {
				defaultSenderId?: string | null;
				senders?: { address: string; id: string; name: string }[];
		  }
		| undefined;
	const senders = settings?.senders ?? [];
	const defaultSender = senders.find((s) => s.id === settings?.defaultSenderId);
	const defaultLabel = defaultSender
		? `Workspace default (${defaultSender.address})`
		: "Workspace default";

	return (
		<div className="space-y-1.5">
			<Select
				items={[
					{ label: defaultLabel, value: WORKSPACE_DEFAULT },
					...senders.map((sender) => ({
						label: `${sender.name} (${sender.address})`,
						value: sender.id,
					})),
				]}
				onValueChange={(next) =>
					onChange(!next || next === WORKSPACE_DEFAULT ? null : next)
				}
				value={value ?? WORKSPACE_DEFAULT}
			>
				<SelectTrigger className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={WORKSPACE_DEFAULT}>{defaultLabel}</SelectItem>
					{senders.map((sender) => (
						<SelectItem key={sender.id} value={sender.id}>
							{sender.name} ({sender.address})
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Link
				className="text-muted-foreground text-xs underline underline-offset-4 hover:text-foreground"
				search={{ tab: "email" }}
				to="/dashboard/settings"
			>
				Manage senders
			</Link>
		</div>
	);
}
