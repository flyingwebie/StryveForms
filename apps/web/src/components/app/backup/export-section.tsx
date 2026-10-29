import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@StryveForms/ui/components/alert";
import { Button } from "@StryveForms/ui/components/button";
import { Label } from "@StryveForms/ui/components/label";
import { Switch } from "@StryveForms/ui/components/switch";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import PasswordInput from "@/components/app/auth/password-input";
import type { WorkspaceSummary } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

import { useBackupJob, useExportWorkspace } from "./backup-rpc";
import ExportHistory from "./export-history";
import JobProgressCard from "./job-progress-card";

const MIN_PASSPHRASE_LENGTH = 12;

function OptionRow({
	checked,
	children,
	description,
	id,
	label,
	onChange,
}: {
	checked: boolean;
	children?: ReactNode;
	description: string;
	id: string;
	label: string;
	onChange: (checked: boolean) => void;
}) {
	return (
		<div className="rounded-xl border border-border p-3.5">
			<label className="flex items-start justify-between gap-4" htmlFor={id}>
				<span>
					<span className="font-medium text-sm">{label}</span>
					<span className="block text-subtle-foreground text-xs">
						{description}
					</span>
				</span>
				<Switch checked={checked} id={id} onCheckedChange={onChange} />
			</label>
			{children}
		</div>
	);
}

/**
 * The "Backup & export" workspace settings section: choose what to include,
 * start the export job, watch its progress, and see past exports. Only
 * shown to people with the "Export workspace" permission (gated by the
 * caller, since the server enforces it too).
 */
export default function BackupExportSection({
	workspace,
}: {
	workspace: WorkspaceSummary;
}) {
	const [includeUploads, setIncludeUploads] = useState(true);
	const [includeSecrets, setIncludeSecrets] = useState(false);
	const [passphrase, setPassphrase] = useState("");
	const [confirmPassphrase, setConfirmPassphrase] = useState("");
	const [activeJobId, setActiveJobId] = useState<string | null>(null);

	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const exportMutation = useExportWorkspace();
	const activeJob = useBackupJob(activeJobId);

	// The export history list below is a separate query — refresh it once the
	// job appears and again once it reaches a final state (so the download
	// link shows up without the person needing to switch tabs and back).
	const lastNotifiedStatus = useRef<string | null>(null);
	useEffect(() => {
		const status = activeJob.data?.status;
		if (status && status !== lastNotifiedStatus.current) {
			lastNotifiedStatus.current = status;
			queryClient.invalidateQueries({
				queryKey: trpc.backup.jobs.queryKey({ workspaceId: workspace.id }),
			});
		}
	}, [activeJob.data?.status, queryClient, trpc, workspace.id]);

	const passphraseTooShort =
		includeSecrets &&
		passphrase.length > 0 &&
		passphrase.length < MIN_PASSPHRASE_LENGTH;
	const passphraseMismatch =
		includeSecrets &&
		confirmPassphrase.length > 0 &&
		passphrase !== confirmPassphrase;
	const canExport =
		!includeSecrets ||
		(passphrase.length >= MIN_PASSPHRASE_LENGTH &&
			passphrase === confirmPassphrase);

	const startExport = () => {
		exportMutation.mutate(
			{
				includeUploads,
				passphrase: includeSecrets ? passphrase : undefined,
				workspaceId: workspace.id,
			},
			{
				onError: (error) => toast.error(error.message),
				onSuccess: (data) => {
					setActiveJobId(data.jobId);
					toast.success("Export started");
				},
			}
		);
	};

	const jobRunning =
		activeJob.data &&
		(activeJob.data.status === "pending" ||
			activeJob.data.status === "running");

	return (
		<div className="max-w-3xl space-y-8">
			<p className="text-muted-foreground text-sm">
				Download everything in "{workspace.name}" as one file. Load it into this
				or another StryveForms instance later to get it all back as a new
				workspace.
			</p>

			<div className="space-y-4 rounded-2xl border border-border bg-card p-6">
				<OptionRow
					checked={includeUploads}
					description="Files people uploaded with their submissions, and signatures. Usually the biggest part of the file. Brand logos, PDF templates and option images are always included."
					id="export-include-uploads"
					label="Include files people uploaded with submissions"
					onChange={setIncludeUploads}
				/>
				<OptionRow
					checked={includeSecrets}
					description="Webhook signing keys, integration tokens, SMTP passwords and the AI provider key, encrypted with a passphrase you choose. Left off, these integrations come in switched off and marked “Needs reconnecting”."
					id="export-include-secrets"
					label="Include secrets"
					onChange={(checked) => {
						setIncludeSecrets(checked);
						if (!checked) {
							setPassphrase("");
							setConfirmPassphrase("");
						}
					}}
				>
					{includeSecrets ? (
						<div className="mt-4 space-y-3 border-border border-t pt-4">
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-1.5">
									<Label htmlFor="export-passphrase">Passphrase</Label>
									<PasswordInput
										autoComplete="new-password"
										id="export-passphrase"
										onChange={setPassphrase}
										value={passphrase}
									/>
									{passphraseTooShort ? (
										<p className="text-destructive text-xs">
											At least {MIN_PASSPHRASE_LENGTH} characters.
										</p>
									) : null}
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="export-passphrase-confirm">
										Confirm passphrase
									</Label>
									<PasswordInput
										autoComplete="new-password"
										id="export-passphrase-confirm"
										onChange={setConfirmPassphrase}
										value={confirmPassphrase}
									/>
									{passphraseMismatch ? (
										<p className="text-destructive text-xs">Doesn't match.</p>
									) : null}
								</div>
							</div>
							<Alert variant="destructive">
								<AlertTriangleIcon />
								<AlertTitle>Keep this passphrase safe</AlertTitle>
								<AlertDescription>
									If you lose this passphrase, the secrets can't be recovered —
									not even by an instance admin.
								</AlertDescription>
							</Alert>
						</div>
					) : null}
				</OptionRow>

				<Button
					disabled={
						!canExport || exportMutation.isPending || Boolean(jobRunning)
					}
					onClick={startExport}
				>
					{exportMutation.isPending ? "Starting…" : "Export workspace"}
				</Button>
			</div>

			{activeJob.data ? <JobProgressCard job={activeJob.data} /> : null}

			<ExportHistory workspaceId={workspace.id} />
		</div>
	);
}
