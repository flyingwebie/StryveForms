import { apiBase } from "@/lib/api-url";

/**
 * Uploads a file (logo, cover, block image/video/audio) to the shared asset
 * endpoint and returns its public URL.
 */
export async function uploadAsset(
	file: File,
	workspaceId: string
): Promise<string> {
	const body = new FormData();
	body.append("file", file);
	body.append("workspaceId", workspaceId);
	const response = await fetch(`${apiBase()}/api/assets`, {
		body,
		credentials: "include",
		method: "POST",
	});
	if (!response.ok) {
		throw new Error("Upload failed");
	}
	const data = (await response.json()) as { url: string };
	return data.url;
}
