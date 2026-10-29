import { useState } from "react";

import StryveformsImportFlow from "../backup/stryveforms-import-flow";
import JotformFlow from "./jotform-flow";
import OpnformFlow from "./opnform-flow";
import ProgressStep, { type ImportTarget } from "./progress-step";
import RecentImportJobs from "./recent-jobs";
import SourcePicker, { type ImportSourceId, SOURCES } from "./source-picker";
import WizardSteps from "./wizard-steps";

/** Settings → Import: pick a source, then connect, choose, review and import. */
export default function ImportCenter({
	initialSource,
}: {
	initialSource?: ImportSourceId;
}) {
	const [source, setSource] = useState<ImportSourceId | null>(
		initialSource ?? null
	);
	const [job, setJob] = useState<{
		id: string;
		targets?: ImportTarget[];
	} | null>(null);

	const reset = () => {
		setSource(null);
		setJob(null);
	};
	const sourceName = SOURCES.find((s) => s.id === source)?.name;

	if (job) {
		return (
			<div className="mx-auto max-w-4xl space-y-6">
				{source ? <WizardSteps current={3} /> : null}
				<ProgressStep
					jobId={job.id}
					onStartAnother={reset}
					targets={job.targets}
				/>
			</div>
		);
	}

	if (source === "stryveforms") {
		// Manages its own progress and summary screens (a different job table
		// and archive format than the OpnForm/JotForm importer uses), so it
		// isn't wrapped in the shared ProgressStep below.
		return (
			<div className="mx-auto max-w-4xl space-y-2">
				<p className="text-muted-foreground text-sm">
					Importing from {sourceName}
				</p>
				<StryveformsImportFlow onCancel={reset} />
			</div>
		);
	}

	if (source) {
		return (
			<div className="mx-auto max-w-4xl space-y-2">
				<p className="text-muted-foreground text-sm">
					Importing from {sourceName}
				</p>
				{source === "opnform" ? (
					<OpnformFlow
						onCancel={reset}
						onStarted={(id, targets) => setJob({ id, targets })}
					/>
				) : (
					<JotformFlow
						onCancel={reset}
						onStarted={(id, targets) => setJob({ id, targets })}
					/>
				)}
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl space-y-8">
			<div>
				<h2 className="font-semibold text-lg">Import your forms</h2>
				<p className="text-muted-foreground text-sm">
					Bring forms, submissions and files over from another form builder.
					You'll see an overview before anything is copied, and running an
					import again updates what you imported before instead of duplicating
					it.
				</p>
			</div>
			<SourcePicker onPick={setSource} />
			<RecentImportJobs onResume={(id) => setJob({ id })} />
		</div>
	);
}
