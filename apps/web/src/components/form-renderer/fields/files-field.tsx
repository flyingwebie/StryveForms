import { displayFileName } from "@StryveForms/forms/values";
import { Button } from "@StryveForms/ui/components/button";
import { Spinner } from "@StryveForms/ui/components/spinner";
import { Paperclip, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { FieldComponentProps } from "../types";
import { uploadFile } from "../upload";
import { toStringArray } from "../value-utils";

interface PendingUpload {
	error?: string;
	fraction: number;
	name: string;
}

/** Drag & drop file upload: uploads immediately to `/api/uploads`, storing the returned name. */
export function FilesField({
	disabled,
	field,
	formSlug,
	id,
	onChange,
	required,
	value,
}: FieldComponentProps) {
	const names = toStringArray(value);
	const [pending, setPending] = useState<PendingUpload[]>([]);
	const [dragOver, setDragOver] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	async function uploadOne(file: File) {
		if (field.max_file_size && file.size > field.max_file_size * 1024 * 1024) {
			setPending((prev) => [
				...prev,
				{ error: `${file.name} is too large.`, fraction: 0, name: file.name },
			]);
			return;
		}
		setPending((prev) => [...prev, { fraction: 0, name: file.name }]);
		try {
			const uploaded = await uploadFile(
				file,
				formSlug,
				field.id,
				(fraction) => {
					setPending((prev) =>
						prev.map((p) => (p.name === file.name ? { ...p, fraction } : p))
					);
				}
			);
			setPending((prev) => prev.filter((p) => p.name !== file.name));
			const current = toStringArray(value);
			const next = field.multiple
				? [...current, uploaded.name]
				: [uploaded.name];
			onChange(field.multiple ? next : next[0]);
		} catch {
			setPending((prev) =>
				prev.map((p) =>
					p.name === file.name ? { ...p, error: "Upload failed." } : p
				)
			);
		}
	}

	function handleFiles(files: FileList | null) {
		if (!files || files.length === 0) {
			return;
		}
		const list = field.multiple
			? Array.from(files)
			: ([files[0]].filter(Boolean) as File[]);
		for (const file of list) {
			uploadOne(file);
		}
	}

	function removeFile(name: string) {
		const next = names.filter((n) => n !== name);
		onChange(field.multiple ? next : undefined);
	}

	return (
		<div className="flex flex-col gap-2">
			{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: drag-and-drop dropzone; the <label> stays reachable and operable via the native file input it wraps */}
			<label
				className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${dragOver ? "border-[var(--color-form)] bg-[color-mix(in_srgb,var(--bg-form-color)_8%,transparent)]" : "border-neutral-300 dark:border-neutral-600"}`}
				htmlFor={id}
				onDragLeave={() => setDragOver(false)}
				onDragOver={(e) => {
					e.preventDefault();
					setDragOver(true);
				}}
				onDrop={(e) => {
					e.preventDefault();
					setDragOver(false);
					handleFiles(e.dataTransfer.files);
				}}
			>
				<Upload className="size-6 text-neutral-400" />
				<p className="text-neutral-500 text-sm">
					Drag and drop, or{" "}
					<span className="font-medium text-[var(--color-form)] underline">
						browse
					</span>
				</p>
				{field.allowed_file_types ? (
					<p className="text-neutral-400 text-xs">
						Accepted: {field.allowed_file_types}
					</p>
				) : null}
				{field.max_file_size ? (
					<p className="text-neutral-400 text-xs">
						Max {field.max_file_size} MB per file
					</p>
				) : null}
				<input
					accept={field.allowed_file_types}
					capture={field.camera_upload ? "environment" : undefined}
					className="sr-only"
					disabled={disabled}
					id={id}
					multiple={Boolean(field.multiple)}
					onChange={(e) => handleFiles(e.target.files)}
					ref={inputRef}
					required={required}
					type="file"
				/>
			</label>
			{names.length > 0 || pending.length > 0 ? (
				<ul className="flex flex-col gap-1">
					{names.map((name) => (
						<li
							className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-1.5 text-sm dark:border-neutral-700"
							key={name}
						>
							<span className="flex items-center gap-2 truncate">
								<Paperclip className="size-3.5 shrink-0 text-neutral-400" />
								{displayFileName(name)}
							</span>
							<Button
								aria-label={`Remove ${displayFileName(name)}`}
								disabled={disabled}
								onClick={() => removeFile(name)}
								size="icon-xs"
								type="button"
								variant="ghost"
							>
								<Trash2 className="size-3.5" />
							</Button>
						</li>
					))}
					{pending.map((p) => (
						<li
							className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-1.5 text-sm dark:border-neutral-700"
							key={p.name}
						>
							<span className="flex items-center gap-2 truncate">
								{p.error ? null : <Spinner className="size-3.5" />}
								{p.name}
							</span>
							<span
								className={
									p.error ? "text-red-500 text-xs" : "text-neutral-400 text-xs"
								}
							>
								{p.error ?? `${Math.round(p.fraction * 100)}%`}
							</span>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
