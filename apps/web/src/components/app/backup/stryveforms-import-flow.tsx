import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { useWorkspaces } from "@/lib/workspace";

import WizardSteps from "../import/wizard-steps";
import ArchiveOverviewStep from "./archive-overview-step";
import {
	useBackupJob,
	useCancelBackupJob,
	useInspectImport,
	useStartImport,
} from "./backup-rpc";
import type {
	MemberDecision,
	WorkspaceArchiveOverview,
	WorkspaceImportResult,
} from "./contract";
import ImportSummaryStep from "./import-summary-step";
import JobProgressCard from "./job-progress-card";
import MembersStep from "./members-step";
import ArchivePassphraseStep from "./passphrase-step";
import type { UploadedArchive } from "./upload-archive";
import UploadArchiveStep from "./upload-archive-step";

const STEPS = ["Upload", "Overview", "Passphrase", "Members", "Import"];

type Stage =
	| { kind: "upload" }
	| {
			kind: "overview";
			overview: WorkspaceArchiveOverview;
			upload: UploadedArchive;
	  }
	| {
			kind: "passphrase";
			overview: WorkspaceArchiveOverview;
			upload: UploadedArchive;
	  }
	| {
			kind: "members";
			overview: WorkspaceArchiveOverview;
			passphrase?: string;
			upload: UploadedArchive;
	  }
	| { kind: "progress"; jobId: string; overview: WorkspaceArchiveOverview };

const STEP_INDEX: Record<Stage["kind"], number> = {
	members: 3,
	overview: 1,
	passphrase: 2,
	progress: 4,
	upload: 0,
};

/**
 * "StryveForms file" import source: upload a `.stryve.zip` workspace export
 * and load it as a brand-new workspace. Upload → overview → passphrase (only
 * if the archive has secrets) → members → progress → summary.
 */
export default function StryveformsImportFlow({
	onCancel,
}: {
	onCancel: () => void;
}) {
	const navigate = useNavigate();
	const { setWorkspaceId } = useWorkspaces();
	const [stage, setStage] = useState<Stage>({ kind: "upload" });
	const [passphraseError, setPassphraseError] = useState<string | null>(null);
	// Bumped whenever inspecting a freshly uploaded file fails, so the upload
	// step (which otherwise has no way to learn its upload "succeeded" but the
	// file was rejected) remounts fresh instead of sitting at "Uploading…
	// 100%" forever.
	const [uploadAttempt, setUploadAttempt] = useState(0);

	const inspect = useInspectImport();
	const start = useStartImport();
	const cancelJob = useCancelBackupJob();
	const jobId = stage.kind === "progress" ? stage.jobId : null;
	const jobQuery = useBackupJob(jobId);

	let content: ReactNode;

	if (stage.kind === "upload") {
		content = (
			<UploadArchiveStep
				key={uploadAttempt}
				onCancel={onCancel}
				onUploaded={(upload) => {
					// Inspect without a passphrase first — the overview always
					// shows before asking for one, per the design.
					inspect.mutate(
						{ uploadKey: upload.uploadKey },
						{
							onError: (error) => {
								toast.error(error.message);
								setUploadAttempt((n) => n + 1);
							},
							onSuccess: (overview) =>
								setStage({ kind: "overview", overview, upload }),
						}
					);
				}}
			/>
		);
	} else if (stage.kind === "overview") {
		content = (
			<ArchiveOverviewStep
				onBack={() => setStage({ kind: "upload" })}
				onContinue={() =>
					setStage(
						stage.overview.includesSecrets
							? {
									kind: "passphrase",
									overview: stage.overview,
									upload: stage.upload,
								}
							: {
									kind: "members",
									overview: stage.overview,
									upload: stage.upload,
								}
					)
				}
				overview={stage.overview}
			/>
		);
	} else if (stage.kind === "passphrase") {
		content = (
			<ArchivePassphraseStep
				checking={inspect.isPending}
				error={passphraseError}
				onBack={() =>
					setStage({
						kind: "overview",
						overview: stage.overview,
						upload: stage.upload,
					})
				}
				onSkip={() =>
					setStage({
						kind: "members",
						overview: stage.overview,
						upload: stage.upload,
					})
				}
				onSubmit={(passphrase) => {
					setPassphraseError(null);
					inspect.mutate(
						{ passphrase, uploadKey: stage.upload.uploadKey },
						{
							onError: () =>
								setPassphraseError("That passphrase doesn't match this file."),
							onSuccess: (overview) => {
								if (overview.passphraseOk === false) {
									setPassphraseError(
										"That passphrase doesn't match this file."
									);
									return;
								}
								setStage({
									kind: "members",
									overview,
									passphrase,
									upload: stage.upload,
								});
							},
						}
					);
				}}
			/>
		);
	} else if (stage.kind === "members") {
		content = (
			<MembersStep
				members={stage.overview.members}
				onBack={() =>
					setStage(
						stage.overview.includesSecrets
							? {
									kind: "passphrase",
									overview: stage.overview,
									upload: stage.upload,
								}
							: {
									kind: "overview",
									overview: stage.overview,
									upload: stage.upload,
								}
					)
				}
				onStart={(decisions: MemberDecision[], sendInvites: boolean) => {
					const members = decisions
						.filter((d) => d.imported)
						.map((d) => ({ email: d.email, role: d.role }));
					start.mutate(
						{
							members,
							passphrase: stage.passphrase,
							sendInvites,
							uploadKey: stage.upload.uploadKey,
						},
						{
							onError: (error) => toast.error(error.message),
							onSuccess: (data) =>
								setStage({
									jobId: data.jobId,
									kind: "progress",
									overview: stage.overview,
								}),
						}
					);
				}}
				starting={start.isPending}
			/>
		);
	} else {
		const job = jobQuery.data;
		const result = job?.result as Partial<WorkspaceImportResult> | undefined;
		if (!job) {
			content = (
				<p className="text-muted-foreground text-sm">Loading import…</p>
			);
		} else if (job.status === "completed" && result?.workspaceId) {
			// The job result carries members, real link changes and the reconnect
			// count; custom domains come from the overview earlier in this flow.
			const { workspaceId } = result;
			content = (
				<ImportSummaryStep
					onOpenWorkspace={() => {
						setWorkspaceId(workspaceId);
						navigate({ to: "/dashboard" });
					}}
					summary={{
						customDomains: stage.overview.customDomains,
						invitesCreated: result.membersInvited ?? 0,
						membersAdded: result.membersAdded ?? 0,
						reconnectCount: result.reconnectCount ?? 0,
						slugChanges: result.slugChanges ?? stage.overview.slugChanges,
						workspaceId,
						workspaceName: result.workspaceName,
					}}
				/>
			);
		} else {
			content = (
				<JobProgressCard
					cancelling={cancelJob.isPending}
					job={job}
					onCancel={() => cancelJob.mutate({ id: job.id })}
				/>
			);
		}
	}

	return (
		<div className="space-y-6">
			<WizardSteps current={STEP_INDEX[stage.kind]} steps={STEPS} />
			{content}
			{stage.kind === "upload" ? null : (
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
