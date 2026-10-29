import type { FormField } from "@StryveForms/forms/types";
import { Button } from "@StryveForms/ui/components/button";
import { Link } from "@tanstack/react-router";
import {
	ExternalLinkIcon,
	FileTextIcon,
	PencilIcon,
	XIcon,
} from "lucide-react";

import { FormThumbnail } from "@/components/app/forms/form-thumbnail";
import StatusBadge from "@/components/app/status-badge";

import { FormContextPicker } from "./form-context-picker";

export interface ChatFormSummary {
	closesAt: string | null;
	color: string;
	coverPicture: string | null;
	id: string;
	logoPicture: string | null;
	properties: FormField[];
	submissionsCount: number;
	title: string;
	visibility: string;
}

/**
 * The form the chat is grounded in, shown prominently above the transcript:
 * an eyebrow + thumbnail + status, quick links to the form, and the
 * existing switch/detach picker.
 */
export function FormHeaderCard({
	form,
	onFormChange,
	workspaceId,
}: {
	form: ChatFormSummary;
	onFormChange: (formId: string | null) => void;
	workspaceId: string;
}) {
	const isClosed =
		form.visibility === "closed" ||
		(form.closesAt !== null && new Date(form.closesAt) < new Date());
	const fieldsCount = form.properties.length;

	return (
		<div className="m-3 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-primary-soft/40 px-3 py-2.5">
			<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
				<FileTextIcon className="size-4" />
			</div>
			<div className="h-10 w-14 shrink-0 overflow-hidden rounded-lg border">
				<FormThumbnail
					className="h-full w-full"
					color={form.color}
					coverPicture={form.coverPicture}
					logoPicture={form.logoPicture}
					properties={form.properties}
				/>
			</div>
			<div className="min-w-0 flex-1">
				<p className="text-subtle-foreground text-xs">Form context</p>
				<div className="flex flex-wrap items-center gap-2">
					<span className="truncate font-semibold text-sm">{form.title}</span>
					<StatusBadge isClosed={isClosed} visibility={form.visibility} />
				</div>
				<p className="text-muted-foreground text-xs">
					{fieldsCount} field{fieldsCount === 1 ? "" : "s"} ·{" "}
					{form.submissionsCount} submission
					{form.submissionsCount === 1 ? "" : "s"}
				</p>
			</div>
			<div className="flex shrink-0 flex-wrap items-center gap-1.5">
				<Button
					render={<Link params={{ formId: form.id }} to="/editor/$formId" />}
					size="sm"
					variant="outline"
				>
					<PencilIcon /> Open editor
				</Button>
				<Button
					render={
						<Link params={{ formId: form.id }} to="/dashboard/forms/$formId" />
					}
					size="sm"
					variant="outline"
				>
					<ExternalLinkIcon /> View submissions
				</Button>
				<FormContextPicker
					formId={form.id}
					onChange={onFormChange}
					workspaceId={workspaceId}
				/>
				<Button
					aria-label="Remove form context"
					onClick={() => onFormChange(null)}
					size="icon-sm"
					variant="ghost"
				>
					<XIcon />
				</Button>
			</div>
		</div>
	);
}
