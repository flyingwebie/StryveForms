import { Button } from "@StryveForms/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "@/utils/trpc";

import DestinationsCard from "./destinations-card";
import HistoryCard from "./history-card";
import RestoreDialog from "./restore-dialog";
import ScheduleCard from "./schedule-card";

/**
 * Admin → Backups: destinations, schedule & retention, the unattended
 * passphrase, manual backups + history, and (in a separate, clearly
 * destructive dialog) restoring from a backup.
 */
export default function AdminBackupsTab() {
	const trpc = useTRPC();
	const instance = useQuery(trpc.instance.get.queryOptions());
	const [restoreOpen, setRestoreOpen] = useState(false);

	return (
		<div className="max-w-3xl space-y-6 pb-24">
			<DestinationsCard />
			<ScheduleCard />
			<HistoryCard />

			<Card className="rounded-xl border-destructive/30">
				<CardHeader>
					<CardTitle className="text-destructive">Restore</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<p className="text-muted-foreground text-sm">
						Replace everything on this instance — every workspace, user and
						setting — with the contents of a backup file. A safety backup is
						taken automatically first.
					</p>
					<Button
						onClick={() => setRestoreOpen(true)}
						type="button"
						variant="destructive"
					>
						Restore from a backup
					</Button>
				</CardContent>
			</Card>

			{instance.data ? (
				<RestoreDialog
					instanceName={instance.data.name}
					onOpenChange={setRestoreOpen}
					open={restoreOpen}
				/>
			) : null}
		</div>
	);
}
