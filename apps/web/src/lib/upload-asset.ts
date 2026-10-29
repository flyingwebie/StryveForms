import { apiBase } from "@/lib/api-url";

/** Uploads an image (logo, favicon…) and returns its public URL. */
export async function uploadAsset(file: File): Promise<string> {
	const body = new FormData();
	body.append("file", file);
	const response = await fetch(`${apiBase()}/api/assets`, {
		body,
		credentials: "include",
		method: "POST",
	});
	const data = (await response.json().catch(() => null)) as {
		url?: string;
		message?: string;
	} | null;
	if (!(response.ok && data?.url)) {
		throw new Error(data?.message || "Upload failed");
	}
	return data.url;
}
