import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@StryveForms/ui/components/alert";
import { Button } from "@StryveForms/ui/components/button";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
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
import {
	AlertTriangleIcon,
	ArchiveIcon,
	CheckCircle2Icon,
	Loader2Icon,
	XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import PasswordInput from "@/components/app/auth/password-input";
import { formatTrpcError } from "@/lib/format-trpc-error";
import { uploadBackupFile } from "@/lib/upload-backup-file";
import { useTRPC } from "@/utils/trpc";

import BackupFileDrop from "./backup-file-drop";

type Step = "confirm" | "running" | "upload";
interface DestinationOption {
	id: string;
	label: string;
}

function formatSize(bytes: number): string {
	const mb = bytes / (1024 * 1024);
	return mb >= 1 ? `${mb.toFixed(0)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
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

function SafetyBackupOption({
	checked,
	destinations,
	destinationId,
	onCheckedChange,
	onDestinationChange,
}: {
	checked: boolean;
	destinationId: string | null;
	destinations: DestinationOption[];
	onCheckedChange: (checked: boolean) => void;
	onDestinationChange: (value: string | null) => void;
}) {
	return (
		<div className="space-y-2">
			<label className="flex items-start gap-2.5" htmlFor="restore-safety">
				<Checkbox
					checked={checked}
					disabled={destinations.length === 0}
					id="restore-safety"
					onCheckedChange={(value) => onCheckedChange(value === true)}
				/>
				<span>
					<span className="font-medium text-sm">
						Take a safety backup of the current instance first
					</span>
					<span className="block text-subtle-foreground text-xs">
						{destinations.length === 0
							? "Add a backup destination first to enable this."
							: "Strongly recommended — lets you undo this if something looks wrong."}
					</span>
				</span>
			</label>
			{checked && destinations.length > 1 ? (
				<Select
					items={destinations.map((d) => ({ label: d.label, value: d.id }))}
					onValueChange={onDestinationChange}
					value={destinationId ?? undefined}
				>
					<SelectTrigger
						className="ml-6.5 w-full"
						id="restore-safety-destination"
					>
						<SelectValue placeholder="Choose a destination" />
					</SelectTrigger>
					<SelectContent>
						{destinations.map((d) => (
							<SelectItem key={d.id} value={d.id}>
								{d.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			) : null}
		</div>
	);
}

function ConfirmStep({
	confirmText,
	destinations,
	fileName,
	fileSize,
	instanceName,
	onChangeFile,
	onConfirmTextChange,
	onPassphraseChange,
	onSafetyDestinationChange,
	onTakeSafetyBackupChange,
	passphrase,
	safetyDestinationId,
	takeSafetyBackup,
}: {
	confirmText: string;
	destinations: DestinationOption[];
	fileName: string;
	fileSize: number | null;
	instanceName: string;
	onChangeFile: () => void;
	onConfirmTextChange: (value: string) => void;
	onPassphraseChange: (value: string) => void;
	onSafetyDestinationChange: (value: string | null) => void;
	onTakeSafetyBackupChange: (checked: boolean) => void;
	passphrase: string;
	safetyDestinationId: string | null;
	takeSafetyBackup: boolean;
}) {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-subtle px-3 py-2.5">
				<div className="flex min-w-0 items-center gap-2.5">
					<ArchiveIcon className="size-4 shrink-0 text-muted-foreground" />
					<div className="min-w-0">
						<p className="truncate font-medium text-sm">{fileName}</p>
						{fileSize === null ? null : (
							<p className="text-subtle-foreground text-xs">
								{formatSize(fileSize)}
							</p>
						)}
					</div>
				</div>
				<Button onClick={onChangeFile} size="sm" type="button" variant="ghost">
					Change
				</Button>
			</div>

			<div className="space-y-2">
				<Label htmlFor="restore-passphrase">Passphrase</Label>
				<PasswordInput
					id="restore-passphrase"
					onChange={onPassphraseChange}
					value={passphrase}
				/>
				<p className="text-subtle-foreground text-xs">
					The passphrase used to encrypt this backup.
				</p>
			</div>

			<SafetyBackupOption
				checked={takeSafetyBackup}
				destinationId={safetyDestinationId}
				destinations={destinations}
				onCheckedChange={onTakeSafetyBackupChange}
				onDestinationChange={onSafetyDestinationChange}
			/>

			<Alert variant="destructive">
				<AlertTriangleIcon />
				<AlertTitle>This will permanently replace all current data</AlertTitle>
				<AlertDescription>
					Every workspace, form and submission on this instance will be
					overwritten.
				</AlertDescription>
			</Alert>

			<div className="space-y-2">
				<Label htmlFor="restore-confirm">
					Type <span className="font-mono">{instanceName}</span> to confirm
				</Label>
				<Input
					id="restore-confirm"
					onChange={(event) => onConfirmTextChange(event.target.value)}
					placeholder={instanceName}
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
	const isRunning = status !== "completed" && status !== "failed";
	return (
		<div className="flex items-start gap-2.5 text-sm">
			{isRunning ? (
				<Loader2Icon className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
			) : null}
			{status === "completed" ? (
				<CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" />
			) : null}
			{status === "failed" ? (
				<XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
			) : null}
			<div className="space-y-1">
				<p>{runningMessage(status)}</p>
				{error ? <p className="text-destructive text-sm">{error}</p> : null}
			</div>
		</div>
	);
}

/**
 * Admin → Backups → Restore. Replaces EVERYTHING on this instance: all
 * workspaces, users and settings. An automatic safety backup can be taken
 * first, to the chosen destination with the same passphrase, and the admin
 * must type the instance's name to confirm (see BACKUP_DESIGN.md "Full
 * restore").
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
	const [fileSize, setFileSize] = useState<number | null>(null);
	const [passphrase, setPassphrase] = useState("");
	const [confirmText, setConfirmText] = useState("");
	const [takeSafetyBackup, setTakeSafetyBackup] = useState(true);
	const [safetyDestinationId, setSafetyDestinationId] = useState<string | null>(
		null
	);
	const [jobId, setJobId] = useState<string | null>(null);

	const destinationOptions = destinations.data ?? [];
	// Defaults to the only destination available, once the list has loaded,
	// until the admin picks one explicitly.
	const effectiveSafetyDestinationId =
		safetyDestinationId ??
		(destinationOptions.length === 1
			? (destinationOptions[0]?.id ?? null)
			: null);

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
		setFileSize(null);
		setPassphrase("");
		setConfirmText("");
		setJobId(null);
	}

	async function handleFile(file: File) {
		setUploading(true);
		setFileName(file.name);
		setFileSize(file.size);
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
			safetyDestinationId: takeSafetyBackup
				? effectiveSafetyDestinationId
				: null,
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
					<DialogTitle>Restore from a backup?</DialogTitle>
					<DialogDescription>
						This replaces everything in this instance — all workspaces, forms,
						submissions and files — with the contents of the backup. This cannot
						be undone.
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
						destinations={destinationOptions}
						fileName={fileName}
						fileSize={fileSize}
						instanceName={instanceName}
						onChangeFile={() => setStep("upload")}
						onConfirmTextChange={setConfirmText}
						onPassphraseChange={setPassphrase}
						onSafetyDestinationChange={setSafetyDestinationId}
						onTakeSafetyBackupChange={setTakeSafetyBackup}
						passphrase={passphrase}
						safetyDestinationId={effectiveSafetyDestinationId}
						takeSafetyBackup={takeSafetyBackup}
					/>
				) : null}

				{step === "running" ? (
					<RunningStep error={job.data?.error} status={jobStatus} />
				) : null}

				<DialogFooter>
					{step === "confirm" ? (
						<>
							<Button
								onClick={() => onOpenChange(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
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
						</>
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
