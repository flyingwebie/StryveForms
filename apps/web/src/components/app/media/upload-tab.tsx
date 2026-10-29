import { Button } from "@StryveForms/ui/components/button";
import { Spinner } from "@StryveForms/ui/components/spinner";
import { cn } from "@StryveForms/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { UploadCloudIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { uploadAsset } from "@/components/form-editor/utils/upload-asset";
import { useTRPC } from "@/utils/trpc";

import type { PickedImage } from "./types";

/** Drag/drop (or click-to-browse) upload — the same `/api/assets` endpoint every other upload uses. */
export function UploadTab({
	accept = "image/*",
	onUploaded,
	workspaceId,
}: {
	accept?: string;
	onUploaded: (image: PickedImage) => void;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [dragOver, setDragOver] = useState(false);

	async function handleFile(file: File | undefined) {
		if (!file) {
			return;
		}
		setUploading(true);
		try {
			const url = await uploadAsset(file, workspaceId);
			// So the Library tab shows this upload right away instead of the
			// 60s default staleTime leaving it looking empty.
			await queryClient.invalidateQueries({
				queryKey: trpc.media.library.list.queryKey({ workspaceId }),
			});
			onUploaded({ url });
		} catch {
			toast.error("Upload failed");
		} finally {
			setUploading(false);
		}
	}

	return (
		<div className="space-y-3">
			<button
				className={cn(
					"flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors",
					dragOver
						? "border-primary bg-primary/5"
						: "border-border hover:border-primary/50"
				)}
				onClick={() => inputRef.current?.click()}
				onDragLeave={() => setDragOver(false)}
				onDragOver={(e) => {
					e.preventDefault();
					setDragOver(true);
				}}
				onDrop={(e) => {
					e.preventDefault();
					setDragOver(false);
					handleFile(e.dataTransfer.files?.[0]);
				}}
				type="button"
			>
				{uploading ? (
					<Spinner className="size-6" />
				) : (
					<UploadCloudIcon className="size-6 text-muted-foreground" />
				)}
				<p className="font-medium text-sm">
					{uploading ? "Uploading…" : "Drag an image here, or click to browse"}
				</p>
				<p className="text-muted-foreground text-xs">
					PNG, JPEG, GIF, WebP, SVG or AVIF.
				</p>
			</button>
			<input
				accept={accept}
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0];
					e.target.value = "";
					handleFile(file);
				}}
				ref={inputRef}
				type="file"
			/>
			<Button
				disabled={uploading}
				onClick={() => inputRef.current?.click()}
				size="sm"
				type="button"
				variant="outline"
			>
				Choose a file
			</Button>
		</div>
	);
}
