import type { ImportPreview } from "@StryveForms/api/services/import/preview";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

import JotformConnectStep, {
	type JotformConnection,
} from "./jotform-connect-step";
import JotformSelectStep, { type JotformChoice } from "./jotform-select-step";
import type { ImportTarget } from "./progress-step";
import ReviewStep from "./review-step";
import WizardSteps from "./wizard-steps";

const DEFAULT_CHOICE: JotformChoice = {
	formIds: [],
	options: { files: true, integrations: true, submissions: true },
	targetWorkspaceId: "new",
};

function optionSummary(options: JotformChoice["options"]): string[] {
	const parts = [options.submissions ? "Submissions" : "No submissions"];
	if (options.submissions && options.files) {
		parts.push("files");
	}
	if (options.integrations) {
		parts.push("notifications & webhooks");
	}
	return parts;
}

export default function JotformFlow({
	onCancel,
	onStarted,
}: {
	onCancel: () => void;
	onStarted: (jobId: string, targets: ImportTarget[]) => void;
}) {
	const trpc = useTRPC();
	const workspaces = useQuery(trpc.workspace.list.queryOptions());
	const [connection, setConnection] = useState<JotformConnection | null>(null);
	const [choice, setChoice] = useState<JotformChoice>(DEFAULT_CHOICE);
	const [preview, setPreview] = useState<ImportPreview | null>(null);

	const payload = connection
		? {
				connectionId: connection.connectionId,
				formIds: choice.formIds,
				options: {
					...choice.options,
					files: choice.options.submissions && choice.options.files,
				},
				targetWorkspaceId: choice.targetWorkspaceId,
			}
		: null;

	const review = useMutation(
		trpc.importer.jotform.preview.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: setPreview,
		})
	);
	const start = useMutation(
		trpc.importer.jotform.start.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: (data) => {
				const target = (workspaces.data ?? []).find(
					(w) => w.id === choice.targetWorkspaceId
				);
				onStarted(data.jobId, [
					target
						? { label: target.name, workspaceId: target.id }
						: { label: "JotForm workspace", workspaceId: null },
				]);
			},
		})
	);

	let step = 0;
	let content: ReactNode;
	if (!(connection && payload)) {
		content = (
			<JotformConnectStep
				onCancel={onCancel}
				onConnected={(data) => {
					setConnection(data);
					setChoice(DEFAULT_CHOICE);
				}}
			/>
		);
	} else if (preview) {
		step = 2;
		content = (
			<ReviewStep
				onBack={() => setPreview(null)}
				onStart={() => start.mutate(payload)}
				options={optionSummary(payload.options)}
				preview={preview}
				starting={start.isPending}
			/>
		);
	} else {
		step = 1;
		content = (
			<JotformSelectStep
				choice={choice}
				connection={connection}
				onBack={() => setConnection(null)}
				onChange={setChoice}
				onReview={() => review.mutate(payload)}
				reviewing={review.isPending}
			/>
		);
	}

	return (
		<div className="space-y-6">
			<WizardSteps current={step} />
			{content}
		</div>
	);
}
