import { apiBase } from "@/lib/api-url";

export interface UploadedArchive {
	sizeBytes: number;
	uploadKey: string;
}

/**
 * Streams a `.stryve.zip` file straight to `POST /api/backups/upload` (not
 * tRPC, so the raw body can be streamed instead of base64-JSON-encoded) and
 * reports real upload progress via XHR's `upload.onprogress`, which `fetch`
 * can't do.
 */
export function uploadArchive(
	file: File,
	onProgress: (fraction: number) => void,
	signal?: AbortSignal
): Promise<UploadedArchive> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", `${apiBase()}/api/backups/upload`);
		xhr.withCredentials = true;
		xhr.setRequestHeader(
			"Content-Type",
			file.type || "application/octet-stream"
		);

		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) {
				onProgress(event.loaded / event.total);
			}
		};

		xhr.onload = () => {
			let data: { message?: string; sizeBytes?: number; uploadKey?: string } =
				{};
			try {
				data = JSON.parse(xhr.responseText);
			} catch {
				// Non-JSON error body (e.g. a proxy error page); fall through below.
			}
			if (xhr.status >= 200 && xhr.status < 300 && data.uploadKey) {
				resolve({
					sizeBytes: data.sizeBytes ?? file.size,
					uploadKey: data.uploadKey,
				});
			} else {
				reject(
					new Error(
						data.message || `Upload failed (${xhr.status || "network"})`
					)
				);
			}
		};
		xhr.onerror = () =>
			reject(new Error("Upload failed. Check your connection."));
		xhr.onabort = () => reject(new Error("Upload cancelled"));

		signal?.addEventListener("abort", () => xhr.abort());

		xhr.send(file);
	});
}
