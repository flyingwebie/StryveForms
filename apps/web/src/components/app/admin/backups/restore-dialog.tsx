import { Button } from "@StryveForms/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@StryveForms/ui/components/dialog";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { formatTrpcError } from "@/lib/format-trpc-error";
import { uploadBackupFile } from "@/lib/upload-backup-file";
import { useTRPC } from "@/utils/trpc";

import BackupFileDrop from "./backup-file-drop";

type Step = "confirm" | "running" | "upload";
interface DestinationOption {
	id: string;
	label: string;
}

function UploadStep({
	fileName,
	onFile,
	uploading,
}: {
	fileName: string;
	onFile: (file: File) => void;
	uploading: boolean;
}) {
	return (
		<div className="space-y-3">
			<Label htmlFor="restore-file">Backup file (.stryve-backup)</Label>
			<BackupFileDrop
				fileName={fileName || undefined}
				id="restore-file"
				onFile={onFile}
				uploading={uploading}
			/>
		</div>
	);
}

function ConfirmStep({
	confirmText,
	destinations,
	fileName,
	instanceName,
	onConfirmTextChange,
	onPassphraseChange,
	onSafetyDestinationChange,
	passphrase,
	safetyDestinationId,
}: {
	confirmText: string;
	destinations: DestinationOption[];
	fileName: string;
	instanceName: string;
	onConfirmTextChange: (value: string) => void;
	onPassphraseChange: (value: string) => void;
	onSafetyDestinationChange: (value: string | null) => void;
	passphrase: string;
	safetyDestinationId: string | null;
}) {
	return (
		<div className="space-y-4">
			<p className="text-muted-foreground text-sm">
				Uploaded <span className="font-medium">{fileName}</span>.
			</p>
			<div className="space-y-2">
				<Label htmlFor="restore-passphrase">Passphrase</Label>
				<Input
					id="restore-passphrase"
					onChange={(event) => onPassphraseChange(event.target.value)}
					type="password"
					value={passphrase}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="restore-safety-destination">
					Take a safety backup first, to
				</Label>
				<Select
					items={destinations.map((d) => ({ label: d.label, value: d.id }))}
					onValueChange={onSafetyDestinationChange}
					value={safetyDestinationId ?? undefined}
				>
					<SelectTrigger className="w-full" id="restore-safety-destination">
						<SelectValue placeholder="Choose a destination (recommended)" />
					</SelectTrigger>
					<SelectContent>
						{destinations.map((d) => (
							<SelectItem key={d.id} value={d.id}>
								{d.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<p className="text-muted-foreground text-xs">
					Taken with the same passphrase, before anything is wiped. Strongly
					recommended.
				</p>
			</div>
			<div className="space-y-2">
				<Label htmlFor="restore-confirm">
					Type <span className="font-mono">{instanceName}</span> to confirm
				</Label>
				<Input
					id="restore-confirm"
					onChange={(event) => onConfirmTextChange(event.target.value)}
					value={confirmText}
				/>
			</div>
		</div>
	);
}

function runningMessage(status: string | undefined): string {
	if (status === "completed") {
		return "Restore complete. Everyone, including you, needs to sign in again.";
	}
	if (status === "failed") {
		return "The restore failed.";
	}
	return "Restoring… this can take a while for a large instance.";
}

function RunningStep({
	error,
	status,
}: {
	error: string | null | undefined;
	status: string | undefined;
}) {
	return (
		<div className="space-y-2">
			<p className="text-sm">{runningMessage(status)}</p>
			{error ? <p className="text-destructive text-sm">{error}</p> : null}
		</div>
	);
}

/**
 * Admin → Backups → Restore. Replaces EVERYTHING on this instance: all
 * workspaces, users and settings. An automatic safety backup is taken first,
 * to the chosen destination with the same passphrase, and the admin must
 * type the instance's name to confirm (see BACKUP_DESIGN.md "Full restore").
 */
export default function RestoreDialog({
	instanceName,
	onOpenChange,
	open,
}: {
	instanceName: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const destinations = useQuery(
		trpc.backupAdmin.destinations.list.queryOptions()
	);

	const [step, setStep] = useState<Step>("upload");
	const [uploading, setUploading] = useState(false);
	const [uploadKey, setUploadKey] = useState<string | null>(null);
	const [fileName, setFileName] = useState("");
	const [passphrase, setPassphrase] = useState("");
	const [confirmText, setConfirmText] = useState("");
	const [safetyDestinationId, setSafetyDestinationId] = useState<string | null>(
		null
	);
	const [jobId, setJobId] = useState<string | null>(null);

	const job = useQuery({
		...trpc.backupAdmin.job.queryOptions({ id: jobId ?? "" }),
		enabled: Boolean(jobId),
		refetchInterval: (query) =>
			query.state.data?.status === "running" ? 2000 : false,
	});

	const restore = useMutation(
		trpc.backupAdmin.restore.mutationOptions({
			onError: (error) => {
				toast.error(formatTrpcError(error));
				setStep("confirm");
			},
			onSuccess: ({ jobId: newJobId }) => {
				setJobId(newJobId);
				setStep("running");
			},
		})
	);

	function reset() {
		setStep("upload");
		setUploadKey(null);
		setFileName("");
		setPassphrase("");
		setConfirmText("");
		setJobId(null);
	}

	async function handleFile(file: File) {
		setUploading(true);
		setFileName(file.name);
		try {
			const result = await uploadBackupFile(file);
			setUploadKey(result.uploadKey);
			setStep("confirm");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Upload failed");
		} finally {
			setUploading(false);
		}
	}

	function handleRestore() {
		if (!uploadKey) {
			return;
		}
		restore.mutate({
			confirmInstanceName: confirmText,
			passphrase,
			safetyDestinationId,
			uploadKey,
		});
	}

	const jobStatus = job.data?.status;
	const jobSettled = jobStatus === "completed" || jobStatus === "failed";

	return (
		<Dialog
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) {
					reset();
				}
			}}
			open={open}
		>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Restore from a backup</DialogTitle>
					<DialogDescription>
						This REPLACES everything on this instance — every workspace, user
						and setting. There's no undo except restoring something else
						afterwards.
					</DialogDescription>
				</DialogHeader>

				{step === "upload" ? (
					<UploadStep
						fileName={fileName}
						onFile={handleFile}
						uploading={uploading}
					/>
				) : null}

				{step === "confirm" ? (
					<ConfirmStep
						confirmText={confirmText}
						destinations={destinations.data ?? []}
						fileName={fileName}
						instanceName={instanceName}
						onConfirmTextChange={setConfirmText}
						onPassphraseChange={setPassphrase}
						onSafetyDestinationChange={setSafetyDestinationId}
						passphrase={passphrase}
						safetyDestinationId={safetyDestinationId}
					/>
				) : null}

				{step === "running" ? (
					<RunningStep error={job.data?.error} status={jobStatus} />
				) : null}

				<DialogFooter>
					{step === "confirm" ? (
						<Button
							disabled={
								confirmText !== instanceName ||
								passphrase.length === 0 ||
								restore.isPending
							}
							onClick={handleRestore}
							type="button"
							variant="destructive"
						>
							{restore.isPending ? "Starting…" : "Replace everything"}
						</Button>
					) : null}
					{step === "running" && jobSettled ? (
						<Button
							onClick={async () => {
								onOpenChange(false);
								reset();
								await queryClient.invalidateQueries({
									queryKey: trpc.backupAdmin.jobs.queryKey(),
								});
							}}
							type="button"
						>
							Close
						</Button>
					) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
