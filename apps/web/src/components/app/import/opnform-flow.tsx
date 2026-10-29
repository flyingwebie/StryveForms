import type { ImportPreview } from "@StryveForms/api/services/import/preview";
import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

import ConnectStep, { type OpnformConnection } from "./connect-step";
import type { ImportTarget } from "./progress-step";
import ReviewStep from "./review-step";
import SelectStep, { type ImportOptions, useOpnformPlan } from "./select-step";
import WizardSteps from "./wizard-steps";
import type { ImportSelection } from "./workspace-selector";

const DEFAULT_OPTIONS: ImportOptions = {
	files: true,
	integrations: true,
	keepSlugs: true,
	submissions: true,
};

function optionSummary(options: ImportOptions): string[] {
	const parts = [options.submissions ? "Submissions" : "No submissions"];
	if (options.submissions && options.files) {
		parts.push("files");
	}
	if (options.integrations) {
		parts.push("integrations");
	}
	if (options.keepSlugs) {
		parts.push("same links");
	}
	return parts;
}

export default function OpnformFlow({
	onCancel,
	onStarted,
}: {
	onCancel: () => void;
	onStarted: (jobId: string, targets: ImportTarget[]) => void;
}) {
	const trpc = useTRPC();
	const [connection, setConnection] = useState<OpnformConnection | null>(null);
	const [selections, setSelections] = useState<Record<number, ImportSelection>>(
		{}
	);
	const [options, setOptions] = useState<ImportOptions>(DEFAULT_OPTIONS);
	const [preview, setPreview] = useState<ImportPreview | null>(null);
	const effective = {
		...options,
		files: options.submissions && options.files,
	};
	const plan = useOpnformPlan(
		connection ?? { baseUrl: "", connectionId: "", workspaces: [] },
		selections
	);

	const review = useMutation(
		trpc.importer.opnform.preview.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: setPreview,
		})
	);
	const start = useMutation(
		trpc.importer.opnform.start.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: (data) => onStarted(data.jobId, plan.targets),
		})
	);

	let step = 0;
	let content: ReactNode;
	if (!connection) {
		content = <ConnectStep onConnected={setConnection} />;
	} else if (preview) {
		step = 2;
		content = (
			<ReviewStep
				onBack={() => setPreview(null)}
				onStart={() =>
					start.mutate({
						connectionId: connection.connectionId,
						options: effective,
						selections: plan.selections,
					})
				}
				options={optionSummary(effective)}
				preview={preview}
				starting={start.isPending}
			/>
		);
	} else {
		step = 1;
		content = (
			<SelectStep
				connection={connection}
				onBack={() => setConnection(null)}
				onReview={() =>
					review.mutate({
						connectionId: connection.connectionId,
						options: effective,
						selections: plan.selections,
					})
				}
				options={options}
				reviewing={review.isPending}
				selections={selections}
				setOptions={setOptions}
				setSelections={setSelections}
			/>
		);
	}

	return (
		<div className="space-y-6">
			<WizardSteps current={step} />
			{content}
			{connection ? null : (
				<button
					className="text-muted-foreground text-sm hover:text-foreground"
					onClick={onCancel}
					type="button"
				>
					← Choose another source
				</button>
			)}
		</div>
	);
}
