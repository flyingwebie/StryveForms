import { Button } from "@StryveForms/ui/components/button";
import { Loader2Icon, UploadIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { uploadAsset } from "@/lib/upload-asset";

export default function LogoUpload({
	label,
	onChange,
	value,
}: {
	label: string;
	onChange: (url: string | null) => void;
	value: string | null;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);

	return (
		<div className="space-y-2">
			<p className="text-muted-foreground text-xs">{label}</p>
			<div className="flex items-center gap-3">
				<div className="flex size-14 items-center justify-center border border-border border-dashed bg-muted/40">
					{value ? (
						<img
							alt={label}
							className="max-h-12 max-w-12 object-contain"
							height={48}
							src={value}
							width={48}
						/>
					) : (
						<UploadIcon className="size-4 text-muted-foreground" />
					)}
				</div>
				<input
					accept="image/*"
					className="hidden"
					onChange={async (event) => {
						const file = event.target.files?.[0];
						if (!file) {
							return;
						}
						setUploading(true);
						try {
							onChange(await uploadAsset(file));
						} catch (error) {
							toast.error(
								error instanceof Error ? error.message : "Upload failed"
							);
						} finally {
							setUploading(false);
							event.target.value = "";
						}
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
					{uploading ? (
						<Loader2Icon className="animate-spin" />
					) : (
						<UploadIcon />
					)}
					{value ? "Replace" : "Upload"}
				</Button>
				{value ? (
					<Button
						onClick={() => onChange(null)}
						size="icon-sm"
						type="button"
						variant="ghost"
					>
						<XIcon />
					</Button>
				) : null}
			</div>
		</div>
	);
}
