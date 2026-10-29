import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@StryveForms/ui/components/alert";
import { Button } from "@StryveForms/ui/components/button";
import { Progress } from "@StryveForms/ui/components/progress";
import { AlertTriangleIcon, FileArchiveIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";

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
			<div>
				<h2 className="font-semibold text-lg">Upload a StryveForms file</h2>
				<p className="text-muted-foreground text-sm">
					Pick the <code>.stryve.zip</code> file you exported from a workspace
					on this or another StryveForms instance. It always becomes a new
					workspace here — nothing existing is changed.
				</p>
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
				className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
					dragOver ? "border-primary bg-primary/5" : "border-border"
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
				{fileName ? (
					<FileArchiveIcon className="size-8 text-primary" />
				) : (
					<UploadIcon className="size-8 text-muted-foreground" />
				)}
				<div>
					<p className="font-medium text-sm">
						{fileName ?? "Drop your .stryve.zip file here"}
					</p>
					<p className="text-muted-foreground text-xs">
						{fileName ? "" : "or click to browse"}
					</p>
				</div>
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

			<div className="flex justify-between">
				<Button onClick={onCancel} variant="outline">
					← Choose another source
				</Button>
			</div>
		</div>
	);
}
