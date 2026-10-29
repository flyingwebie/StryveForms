import { cn } from "@StryveForms/ui/lib/utils";
import { FileArchiveIcon, Loader2Icon } from "lucide-react";
import { useRef, useState } from "react";

/**
 * Drop zone for a `.stryve-backup` file: click to browse or drag a file in.
 * Used by Admin → Backups → Restore and the /setup restore step.
 */
export default function BackupFileDrop({
	disabled,
	fileName,
	id,
	onFile,
	uploading,
}: {
	disabled?: boolean;
	fileName?: string;
	id: string;
	onFile: (file: File) => void;
	uploading?: boolean;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);
	const inactive = Boolean(disabled || uploading);

	return (
		<>
			<input
				accept=".stryve-backup"
				className="sr-only"
				disabled={inactive}
				id={id}
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) {
						onFile(file);
					}
				}}
				ref={inputRef}
				tabIndex={-1}
				type="file"
			/>
			<button
				className={cn(
					"flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
					dragging
						? "border-primary bg-primary-soft/40"
						: "cursor-pointer hover:bg-subtle",
					inactive && "pointer-events-none opacity-70"
				)}
				disabled={inactive}
				onClick={() => inputRef.current?.click()}
				onDragLeave={() => setDragging(false)}
				onDragOver={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDrop={(event) => {
					event.preventDefault();
					setDragging(false);
					const [file] = event.dataTransfer.files;
					if (file) {
						onFile(file);
					}
				}}
				type="button"
			>
				{uploading ? (
					<Loader2Icon className="size-6 animate-spin text-primary" />
				) : (
					<FileArchiveIcon className="size-6 text-muted-foreground" />
				)}
				<span className="font-medium text-sm">
					{uploading
						? `Uploading ${fileName ?? "file"}…`
						: (fileName ?? "Choose a .stryve-backup file")}
				</span>
				<span className="text-muted-foreground text-xs">
					{uploading
						? "Keep this page open until the upload finishes."
						: "Click to browse, or drag the file here."}
				</span>
			</button>
		</>
	);
}
