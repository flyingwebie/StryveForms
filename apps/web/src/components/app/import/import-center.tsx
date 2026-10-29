import { EyeIcon, ShieldIcon, ZapIcon } from "lucide-react";
import { useState } from "react";

import StryveformsImportFlow from "../backup/stryveforms-import-flow";
import JotformFlow from "./jotform-flow";
import OpnformFlow from "./opnform-flow";
import ProgressStep, { type ImportTarget } from "./progress-step";
import RecentImportJobs from "./recent-jobs";
import SourcePicker, { type ImportSourceId, SOURCES } from "./source-picker";
import WizardSteps from "./wizard-steps";

const TRUST_POINTS = [
	{ icon: ShieldIcon, text: "Nothing is overwritten until you confirm" },
	{ icon: EyeIcon, text: "Review every field before anything changes" },
	{ icon: ZapIcon, text: "Most imports finish in a few minutes" },
];

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
					sourceName={sourceName}
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
		<div className="space-y-8">
			<div className="max-w-2xl space-y-3">
				<h2 className="font-display text-4xl">Bring everything over.</h2>
				<p className="text-muted-foreground text-sm">
					Move your forms, submissions, files, and integrations from OpnForm,
					JotForm, or a StryveForms backup.
				</p>
				<div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1">
					{TRUST_POINTS.map(({ icon: Icon, text }) => (
						<span
							className="flex items-center gap-1.5 text-subtle-foreground text-xs"
							key={text}
						>
							<Icon className="size-3.5" />
							{text}
						</span>
					))}
				</div>
			</div>

			<div className="space-y-3">
				<div>
					<h3 className="font-semibold text-base">Choose a source</h3>
					<p className="text-muted-foreground text-sm">
						Pick where you're importing from — you can always import more later.
					</p>
				</div>
				<SourcePicker onPick={setSource} />
			</div>

			<RecentImportJobs onResume={(id) => setJob({ id })} />
		</div>
	);
}
