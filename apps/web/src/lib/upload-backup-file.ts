import { apiBase } from "@/lib/api-url";

/**
 * Uploads a `.stryve-backup` file to the shared authenticated endpoint
 * (`POST /api/backups/upload`, owned by engineer P) so a restore can read it
 * by key afterwards. Streams the raw file body (not multipart), matching
 * that endpoint's contract.
 */
export async function uploadBackupFile(
	file: File
): Promise<{ sizeBytes: number; uploadKey: string }> {
	const response = await fetch(`${apiBase()}/api/backups/upload`, {
		body: file,
		credentials: "include",
		headers: { "Content-Type": file.type || "application/octet-stream" },
		method: "POST",
	});
	if (!response.ok) {
		throw new Error(
			`Upload failed (${response.status}). Check the file and try again.`
		);
	}
	return (await response.json()) as { sizeBytes: number; uploadKey: string };
}
