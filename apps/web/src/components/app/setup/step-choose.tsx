import { ArrowRightIcon, DatabaseBackupIcon, SparklesIcon } from "lucide-react";

/** Step 0 on a brand-new instance: start fresh, or restore from an existing instance's backup. */
export default function SetupStepChoose({
	onRestore,
	onStartFresh,
}: {
	onRestore: () => void;
	onStartFresh: () => void;
}) {
	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<button
				className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-primary bg-card p-5 text-left shadow-primary/10 shadow-sm transition-colors hover:bg-primary-soft/40"
				onClick={onStartFresh}
				type="button"
			>
				<span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
					<SparklesIcon className="size-5" />
				</span>
				<span className="space-y-1">
					<span className="block font-semibold">Set up a new instance</span>
					<span className="block text-muted-foreground text-sm">
						Create a fresh admin account and start configuring your workspace
						from scratch.
					</span>
				</span>
				<ArrowRightIcon className="ml-auto size-4 text-primary" />
			</button>
			<button
				className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:bg-muted/50"
				onClick={onRestore}
				type="button"
			>
				<span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
					<DatabaseBackupIcon className="size-5" />
				</span>
				<span className="space-y-1">
					<span className="block font-semibold">Restore from a backup</span>
					<span className="block text-muted-foreground text-sm">
						Bring in a workspace from a .stryve-backup file exported from
						another instance.
					</span>
				</span>
				<ArrowRightIcon className="ml-auto size-4 text-muted-foreground" />
			</button>
		</div>
	);
}
