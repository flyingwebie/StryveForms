import { apiBase } from "@/lib/api-url";

export interface UploadedFile {
	name: string;
	originalName: string;
	size: number;
}

/** Uploads one file to the server's `/api/uploads` endpoint, returning its stored name. */
export async function uploadFile(
	file: File,
	slug: string,
	fieldId: string,
	onProgress?: (fraction: number) => void
): Promise<UploadedFile> {
	return await new Promise<UploadedFile>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		const form = new FormData();
		form.append("file", file);
		form.append("slug", slug);
		form.append("fieldId", fieldId);

		xhr.upload.addEventListener("progress", (event) => {
			if (event.lengthComputable && onProgress) {
				onProgress(event.loaded / event.total);
			}
		});
		xhr.addEventListener("load", () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					resolve(JSON.parse(xhr.responseText) as UploadedFile);
				} catch {
					reject(new Error("Upload response was not valid JSON."));
				}
			} else {
				reject(new Error(`Upload failed with status ${xhr.status}.`));
			}
		});
		xhr.addEventListener("error", () => reject(new Error("Upload failed.")));
		xhr.open("POST", `${apiBase()}/api/uploads`);
		xhr.send(form);
	});
}
