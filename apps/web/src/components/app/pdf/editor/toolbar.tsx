import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import { Input } from "@StryveForms/ui/components/input";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, EyeIcon, SaveIcon, Undo2Icon } from "lucide-react";
import type { RouterOutputs } from "@/utils/trpc";

type Submission = RouterOutputs["submission"]["list"]["items"][number];

function saveLabel({ dirty, saving }: { dirty: boolean; saving: boolean }) {
	if (saving) {
		return "Saving…";
	}
	return dirty ? "Save changes" : "Saved";
}

/** Top bar: back link, editable name, undo, preview (with a submission picker), save. */
export default function EditorToolbar({
	canUndo,
	dirty,
	formId,
	name,
	onNameChange,
	onPreview,
	onSave,
	previewSubmissionId,
	onPreviewSubmissionChange,
	onUndo,
	saving,
	submissions,
}: {
	canUndo: boolean;
	dirty: boolean;
	formId: string;
	name: string;
	onNameChange: (name: string) => void;
	onPreview: () => void;
	onPreviewSubmissionChange: (id: string | null) => void;
	onSave: () => void;
	previewSubmissionId: string | null;
	onUndo: () => void;
	saving: boolean;
	submissions: Submission[];
}) {
	const selectedLabel = previewSubmissionId
		? new Date(
				submissions.find((s) => s.id === previewSubmissionId)?.createdAt ??
					Date.now()
			).toLocaleString()
		: "Sample data";

	return (
		<div className="flex items-center gap-3 border-b px-4 py-2">
			<Button
				render={<Link params={{ formId }} to="/dashboard/forms/$formId/pdf" />}
				size="icon-sm"
				variant="ghost"
			>
				<ArrowLeftIcon />
			</Button>
			<Input
				className="h-8 max-w-56 border-transparent font-medium shadow-none hover:border-input focus-visible:border-ring"
				onChange={(e) => onNameChange(e.target.value)}
				value={name}
			/>
			<Button
				disabled={!canUndo}
				onClick={onUndo}
				size="icon-sm"
				title="Undo"
				variant="ghost"
			>
				<Undo2Icon />
			</Button>
			<div className="flex-1" />
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
					{selectedLabel}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={() => onPreviewSubmissionChange(null)}>
						Sample data
					</DropdownMenuItem>
					{submissions.map((submission) => (
						<DropdownMenuItem
							key={submission.id}
							onClick={() => onPreviewSubmissionChange(submission.id)}
						>
							{new Date(submission.createdAt).toLocaleString()}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
			<Button onClick={onPreview} size="sm" variant="outline">
				<EyeIcon /> Preview
			</Button>
			<Button disabled={!dirty || saving} onClick={onSave} size="sm">
				<SaveIcon /> {saveLabel({ dirty, saving })}
			</Button>
		</div>
	);
}
