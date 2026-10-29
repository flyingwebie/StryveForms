import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import BackupFileDrop from "@/components/app/admin/backups/backup-file-drop";
import { apiBase } from "@/lib/api-url";

type Phase = "upload" | "restoring" | "ready";

/**
 * Fresh-instance restore: upload a `.stryve-backup`, give its passphrase,
 * and replace this never-used instance with it. Talks to the public,
 * setup-only `/api/setup/restore-upload` and `/api/setup/restore` routes
 * (no session exists yet) — see apps/server/src/index.ts.
 */
export default function SetupStepRestore({ onBack }: { onBack: () => void }) {
	const navigate = useNavigate();
	const [phase, setPhase] = useState<Phase>("upload");
	const [fileName, setFileName] = useState("");
	const [uploadKey, setUploadKey] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [passphrase, setPassphrase] = useState("");
	const [error, setError] = useState<string | null>(null);

	async function handleFile(file: File) {
		setUploading(true);
		setFileName(file.name);
		setError(null);
		try {
			const response = await fetch(`${apiBase()}/api/setup/restore-upload`, {
				body: file,
				headers: { "Content-Type": file.type || "application/octet-stream" },
				method: "POST",
			});
			if (!response.ok) {
				throw new Error(`Upload failed (${response.status})`);
			}
			const data = (await response.json()) as { uploadKey: string };
			setUploadKey(data.uploadKey);
		} catch (uploadError) {
			toast.error(
				uploadError instanceof Error ? uploadError.message : "Upload failed"
			);
		} finally {
			setUploading(false);
		}
	}

	async function handleRestore() {
		if (!uploadKey) {
			return;
		}
		setPhase("restoring");
		setError(null);
		try {
			const response = await fetch(`${apiBase()}/api/setup/restore`, {
				body: JSON.stringify({ passphrase, uploadKey }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			const data = (await response.json()) as {
				message?: string;
				ok?: boolean;
			};
			if (!(response.ok && data.ok)) {
				throw new Error(data.message ?? "Restore failed");
			}
			setPhase("ready");
		} catch (restoreError) {
			setError(
				restoreError instanceof Error ? restoreError.message : "Restore failed"
			);
			setPhase("upload");
		}
	}

	if (phase === "ready") {
		return (
			<div className="space-y-4 text-center">
				<p className="text-sm">
					Restore complete. Sign in with an account from the restored instance.
				</p>
				<Button
					className="w-full"
					onClick={() => navigate({ to: "/login" })}
					type="button"
				>
					Go to sign in
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="setup-restore-file">Backup file (.stryve-backup)</Label>
				<BackupFileDrop
					disabled={phase === "restoring"}
					fileName={fileName || undefined}
					id="setup-restore-file"
					onFile={handleFile}
					uploading={uploading}
				/>
			</div>

			{uploadKey ? (
				<div className="space-y-2">
					<Label htmlFor="setup-restore-passphrase">Passphrase</Label>
					<Input
						id="setup-restore-passphrase"
						onChange={(event) => setPassphrase(event.target.value)}
						type="password"
						value={passphrase}
					/>
				</div>
			) : null}

			{error ? <p className="text-destructive text-sm">{error}</p> : null}

			<div className="flex gap-2">
				<Button onClick={onBack} type="button" variant="outline">
					Back
				</Button>
				<Button
					className="flex-1"
					disabled={
						!uploadKey || passphrase.length === 0 || phase === "restoring"
					}
					onClick={handleRestore}
					type="button"
				>
					{phase === "restoring" ? "Restoring…" : "Restore"}
				</Button>
			</div>
		</div>
	);
}
