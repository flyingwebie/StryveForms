import { Button } from "@StryveForms/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { UploadIcon } from "lucide-react";
import { useState } from "react";

import { useTRPC } from "@/utils/trpc";

import DestinationsCard from "./destinations-card";
import HistoryCard from "./history-card";
import RestoreDialog from "./restore-dialog";
import ScheduleCard from "./schedule-card";

/**
 * Admin → Backups: destination, schedule & retention, the unattended
 * passphrase, manual backups + history, and (behind a clearly destructive
 * confirmation dialog) restoring the whole instance from a backup.
 */
export default function AdminBackupsTab() {
	const trpc = useTRPC();
	const instance = useQuery(trpc.instance.get.queryOptions());
	const [restoreOpen, setRestoreOpen] = useState(false);

	return (
		<div className="max-w-3xl space-y-10 pb-16">
			<DestinationsCard />
			<ScheduleCard />
			<div className="space-y-4">
				<HistoryCard />
				<Button
					onClick={() => setRestoreOpen(true)}
					type="button"
					variant="outline"
				>
					<UploadIcon /> Restore from a backup
				</Button>
			</div>

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
