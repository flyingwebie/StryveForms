import { Button } from "@StryveForms/ui/components/button";
import { Spinner } from "@StryveForms/ui/components/spinner";
import { UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useEditor } from "../state/editor-context";
import { uploadAsset } from "../utils/upload-asset";

export function UploadButton({
	accept,
	label = "Upload",
	onUploaded,
}: {
	accept?: string;
	label?: string;
	onUploaded: (url: string) => void;
}) {
	const { meta } = useEditor();
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);

	async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) {
			return;
		}
		setUploading(true);
		try {
			const url = await uploadAsset(file, meta.workspaceId);
			onUploaded(url);
		} catch {
			toast.error("Upload failed");
		} finally {
			setUploading(false);
		}
	}

	return (
		<>
			<Button
				disabled={uploading}
				onClick={() => inputRef.current?.click()}
				size="sm"
				type="button"
				variant="outline"
			>
				{uploading ? <Spinner /> : <UploadIcon />}
				{label}
			</Button>
			<input
				accept={accept}
				className="hidden"
				onChange={handleChange}
				ref={inputRef}
				type="file"
			/>
		</>
	);
}
