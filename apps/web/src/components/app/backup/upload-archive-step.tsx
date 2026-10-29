import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@StryveForms/ui/components/alert";
import { Button } from "@StryveForms/ui/components/button";
import { Progress } from "@StryveForms/ui/components/progress";
import {
	AlertTriangleIcon,
	FileArchiveIcon,
	FolderOpenIcon,
	InfoIcon,
	UploadIcon,
} from "lucide-react";
import { useRef, useState } from "react";

import { SourceLogo } from "../import/source-picker";
import type { UploadedArchive } from "./upload-archive";
import { uploadArchive } from "./upload-archive";

/**
 * Step 1 of the "StryveForms file" import source: drop or pick a `.stryve.zip`
 * workspace export and watch it upload, with a real progress bar driven by
 * the browser's upload progress event (not a fake timer).
 */
export default function UploadArchiveStep({
	onCancel,
	onUploaded,
}: {
	onCancel: () => void;
	onUploaded: (result: UploadedArchive) => void;
}) {
	const [fileName, setFileName] = useState<string | null>(null);
	const [progress, setProgress] = useState(0);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [dragOver, setDragOver] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const start = async (file: File) => {
		setFileName(file.name);
		setError(null);
		setUploading(true);
		setProgress(0);
		const controller = new AbortController();
		abortRef.current = controller;
		try {
			const result = await uploadArchive(file, setProgress, controller.signal);
			onUploaded(result);
		} catch (uploadError) {
			setUploading(false);
			setError((uploadError as Error).message);
		}
	};

	const cancelUpload = () => {
		abortRef.current?.abort();
		setUploading(false);
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-3">
				<SourceLogo source="stryveforms" />
				<div>
					<h2 className="font-semibold text-lg">Upload a StryveForms file</h2>
					<p className="text-muted-foreground text-sm">
						Choose a <code>.stryve.zip</code> workspace export to restore here.
					</p>
				</div>
			</div>

			<input
				accept=".zip"
				className="sr-only"
				disabled={uploading}
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) {
						start(file);
					}
				}}
				ref={inputRef}
				type="file"
			/>
			<button
				className={`flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
					dragOver ? "border-primary bg-primary/5" : "border-border bg-subtle"
				} ${uploading ? "pointer-events-none opacity-70" : "cursor-pointer hover:border-primary/40"}`}
				disabled={uploading}
				onClick={() => inputRef.current?.click()}
				onDragLeave={() => setDragOver(false)}
				onDragOver={(event) => {
					event.preventDefault();
					setDragOver(true);
				}}
				onDrop={(event) => {
					event.preventDefault();
					setDragOver(false);
					const [file] = event.dataTransfer.files;
					if (file) {
						start(file);
					}
				}}
				type="button"
			>
				<span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
					{fileName ? (
						<FileArchiveIcon className="size-5 text-primary" />
					) : (
						<UploadIcon className="size-5" />
					)}
				</span>
				<div className="space-y-1">
					<p className="font-medium text-sm">
						{fileName ?? "Drag and drop your .stryve.zip file here"}
					</p>
					{fileName ? null : (
						<p className="text-muted-foreground text-xs">or</p>
					)}
				</div>
				{fileName ? null : (
					<span className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 font-medium text-sm shadow-xs">
						<FolderOpenIcon className="size-4" />
						Browse files
					</span>
				)}
				<p className="text-muted-foreground text-xs">
					Up to 2 GB · Exported from StryveForms Backups
				</p>
			</button>

			{uploading ? (
				<div className="space-y-2 rounded-xl border bg-card p-4">
					<div className="flex justify-between text-sm">
						<span>Uploading…</span>
						<span className="text-muted-foreground tabular-nums">
							{Math.round(progress * 100)}%
						</span>
					</div>
					<Progress value={Math.round(progress * 100)} />
					<Button onClick={cancelUpload} size="sm" variant="outline">
						Cancel upload
					</Button>
				</div>
			) : null}

			{error ? (
				<Alert variant="destructive">
					<AlertTriangleIcon />
					<AlertTitle>Upload failed</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			<div className="flex items-start gap-2.5 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm">
				<InfoIcon className="mt-0.5 size-4 shrink-0 text-info" />
				<div>
					<p className="font-medium text-info">
						Your file stays on this server
					</p>
					<p className="text-muted-foreground text-xs">
						Nothing is uploaded anywhere else. The archive is only read locally
						to prepare the import.
					</p>
				</div>
			</div>

			<div className="flex items-center justify-between gap-3">
				<Button onClick={onCancel} variant="outline">
					← Back to Import
				</Button>
				<Button disabled>Continue</Button>
			</div>
		</div>
	);
}
