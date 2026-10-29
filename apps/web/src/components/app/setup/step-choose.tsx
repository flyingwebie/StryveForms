import { DatabaseBackupIcon, SparklesIcon } from "lucide-react";

/** Step 0 on a brand-new instance: start fresh, or restore from an existing instance's backup. */
export default function SetupStepChoose({
	onRestore,
	onStartFresh,
}: {
	onRestore: () => void;
	onStartFresh: () => void;
}) {
	return (
		<div className="space-y-3">
			<button
				className="flex w-full items-start gap-3 rounded-xl border border-border p-4 text-left hover:bg-muted/50"
				onClick={onStartFresh}
				type="button"
			>
				<SparklesIcon className="mt-0.5 size-5 shrink-0 text-primary" />
				<span>
					<span className="block font-medium">Set up a new instance</span>
					<span className="block text-muted-foreground text-sm">
						Create an admin account and start with a blank instance.
					</span>
				</span>
			</button>
			<button
				className="flex w-full items-start gap-3 rounded-xl border border-border p-4 text-left hover:bg-muted/50"
				onClick={onRestore}
				type="button"
			>
				<DatabaseBackupIcon className="mt-0.5 size-5 shrink-0 text-primary" />
				<span>
					<span className="block font-medium">Restore from a backup</span>
					<span className="block text-muted-foreground text-sm">
						Bring in every workspace, user and setting from a full-instance
						backup file (.stryve-backup) made on this or another instance.
					</span>
				</span>
			</button>
		</div>
	);
}
