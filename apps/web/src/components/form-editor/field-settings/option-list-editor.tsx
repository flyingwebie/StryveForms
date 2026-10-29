import type { SelectOption } from "@StryveForms/forms/types";
import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Textarea } from "@StryveForms/ui/components/textarea";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	GripVerticalIcon,
	ImageIcon,
	PlusIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useState } from "react";
import { UploadButton } from "../shared/upload-button";

function moveOption(options: SelectOption[], index: number, delta: number) {
	const target = index + delta;
	if (target < 0 || target >= options.length) {
		return options;
	}
	const next = [...options];
	const [item] = next.splice(index, 1);
	if (item) {
		next.splice(target, 0, item);
	}
	return next;
}

/**
 * Thumbnail + upload/replace/remove + a manual URL field for one option's
 * image. Shown only while the field's "Display as" includes an image.
 */
function OptionImageControl({
	image,
	onChange,
}: {
	image: string | null | undefined;
	onChange: (image: string | null) => void;
}) {
	return (
		<div className="flex items-center gap-1.5 pl-6">
			{image ? (
				<img
					alt=""
					className="size-8 shrink-0 rounded-lg border object-cover"
					height={32}
					src={image}
					width={32}
				/>
			) : (
				<div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
					<ImageIcon className="size-3.5" />
				</div>
			)}
			<Input
				className="h-7 flex-1 text-xs"
				onChange={(e) => onChange(e.target.value || null)}
				placeholder="Image URL"
				value={image ?? ""}
			/>
			<UploadButton
				accept="image/*"
				label={image ? "Replace" : "Upload"}
				onUploaded={onChange}
			/>
			{image ? (
				<Button
					onClick={() => onChange(null)}
					size="icon-xs"
					type="button"
					variant="ghost"
				>
					<Trash2Icon />
				</Button>
			) : null}
		</div>
	);
}

export function OptionListEditor({
	onChange,
	options,
	withImages = false,
}: {
	onChange: (options: SelectOption[]) => void;
	options: SelectOption[];
	/** Show the per-option image controls (the field's "Display as" includes an image). */
	withImages?: boolean;
}) {
	const [bulkOpen, setBulkOpen] = useState(false);
	const [bulkText, setBulkText] = useState("");

	function updateOption(index: number, patch: Partial<SelectOption>) {
		onChange(options.map((o, i) => (i === index ? { ...o, ...patch } : o)));
	}

	function removeOption(index: number) {
		onChange(options.filter((_, i) => i !== index));
	}

	function addOption() {
		const n = options.length + 1;
		onChange([...options, { id: `Option ${n}`, name: `Option ${n}` }]);
	}

	function applyBulkPaste() {
		const names = bulkText
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		// Match pasted lines back to existing options by name, so re-pasting
		// the same (or mostly the same) list doesn't lose the images already
		// uploaded for unchanged options. Only genuinely new lines get a
		// fresh id and no image.
		const byName = new Map(options.map((o) => [o.name, o]));
		onChange(names.map((name) => byName.get(name) ?? { id: nanoid(8), name }));
		setBulkText("");
		setBulkOpen(false);
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<p className="font-medium text-subtle-foreground text-xs uppercase tracking-wide">
					Options
				</p>
				<span className="text-muted-foreground text-xs">{options.length}</span>
			</div>
			{withImages ? (
				<p className="text-muted-foreground text-xs">
					Each option can show an image: upload a file or paste an image URL
					below its name.
				</p>
			) : null}
			<div className="flex flex-col gap-1.5">
				{options.map((option, index) => (
					<div className="group flex flex-col gap-1" key={option.id}>
						<div className="flex items-center gap-1 rounded-lg border p-1">
							<GripVerticalIcon className="size-4 shrink-0 text-muted-foreground" />
							<Input
								className="h-7 flex-1 border-none bg-transparent px-1 shadow-none focus-visible:ring-0"
								onChange={(e) => updateOption(index, { name: e.target.value })}
								value={option.name}
							/>
							<div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
								<Button
									disabled={index === 0}
									onClick={() => onChange(moveOption(options, index, -1))}
									size="icon-xs"
									type="button"
									variant="ghost"
								>
									<ArrowUpIcon />
								</Button>
								<Button
									disabled={index === options.length - 1}
									onClick={() => onChange(moveOption(options, index, 1))}
									size="icon-xs"
									type="button"
									variant="ghost"
								>
									<ArrowDownIcon />
								</Button>
							</div>
							<Button
								onClick={() => removeOption(index)}
								size="icon-xs"
								type="button"
								variant="ghost"
							>
								<XIcon />
							</Button>
						</div>
						{withImages ? (
							<OptionImageControl
								image={option.image}
								onChange={(image) => updateOption(index, { image })}
							/>
						) : null}
					</div>
				))}
			</div>
			<div className="flex gap-2">
				<Button onClick={addOption} size="sm" type="button" variant="outline">
					<PlusIcon /> Add option
				</Button>
				<Button
					onClick={() => setBulkOpen((v) => !v)}
					size="sm"
					type="button"
					variant="ghost"
				>
					Bulk paste
				</Button>
			</div>
			{bulkOpen ? (
				<div className="flex flex-col gap-1.5">
					<Textarea
						onChange={(e) => setBulkText(e.target.value)}
						placeholder={"One option per line"}
						value={bulkText}
					/>
					<p className="text-muted-foreground text-xs">
						Replaces the option list above. A line matching an existing option's
						name keeps that option's image; new lines start without one.
					</p>
					<Button onClick={applyBulkPaste} size="sm" type="button">
						Replace options
					</Button>
				</div>
			) : null}
		</div>
	);
}
