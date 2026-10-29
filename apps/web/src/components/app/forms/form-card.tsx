import type { FormField } from "@StryveForms/forms/types";
import { Badge } from "@StryveForms/ui/components/badge";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@StryveForms/ui/components/tooltip";
import { Link } from "@tanstack/react-router";
import { EyeIcon, MessageSquareIcon } from "lucide-react";
import type { MouseEvent } from "react";

import FolderMark from "@/components/app/icons/folder-mark";
import StatusBadge from "@/components/app/status-badge";

import { FORM_DRAG_MIME } from "../folders/folder-constants";
import FormMenu, { type FormMenuTarget } from "./form-menu";
import { FormThumbnail } from "./form-thumbnail";

export interface FormCardSummary extends FormMenuTarget {
	closesAt: Date | string | null;
	color: string;
	coverPicture?: string | null;
	folderId?: string | null;
	isClosed: boolean;
	logoPicture?: string | null;
	properties?: FormField[];
	submissionsCount: number;
	updatedAt: Date | string;
	viewsCount: number;
}

export interface FolderChip {
	color: string | null;
	icon: string | null;
	name: string;
}

function formatUpdated(value: Date | string) {
	return new Date(value).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
	});
}

export default function FormCard({
	dragIds,
	folder,
	form,
	onToggleSelect,
	selected,
	workspaceId,
	workspaces,
}: {
	/** The ids to carry in the drag payload when this card (already selected) is dragged. */
	dragIds: string[];
	folder?: FolderChip | null;
	form: FormCardSummary;
	onToggleSelect: (event: MouseEvent) => void;
	selected: boolean;
	workspaceId: string;
	workspaces: { id: string; name: string }[];
}) {
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: draggable card container; the checkbox, title and menu inside are the real interactive elements
		// biome-ignore lint/a11y/noNoninteractiveElementInteractions: same as above — drag-and-drop has no semantic element
		<div
			className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card transition-all duration-150 focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md data-[selected=true]:ring-2 data-[selected=true]:ring-primary"
			data-selected={selected}
			draggable
			onDragStart={(event) => {
				event.dataTransfer.setData(
					FORM_DRAG_MIME,
					JSON.stringify(dragIds.includes(form.id) ? dragIds : [form.id])
				);
			}}
		>
			<button
				aria-label={
					selected ? `Deselect ${form.title}` : `Select ${form.title}`
				}
				className="absolute top-2 left-2 z-10 rounded-sm bg-background/80 p-0.5 opacity-100 backdrop-blur-sm transition-opacity sm:opacity-0 sm:data-[selected=true]:opacity-100 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
				data-selected={selected}
				onClick={onToggleSelect}
				type="button"
			>
				<Checkbox checked={selected} />
			</button>

			<Link
				params={{ formId: form.id }}
				tabIndex={-1}
				to="/dashboard/forms/$formId"
			>
				<FormThumbnail
					className="h-28 w-full"
					color={form.color}
					coverPicture={form.coverPicture}
					logoPicture={form.logoPicture}
					properties={form.properties ?? []}
				/>
			</Link>

			<div className="flex flex-1 flex-col gap-2 px-4 pb-4">
				<div className="flex items-start justify-between gap-2">
					<Link
						className="min-w-0 flex-1 truncate font-medium hover:underline"
						params={{ formId: form.id }}
						to="/dashboard/forms/$formId"
					>
						{form.title}
					</Link>
					<div className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
						<FormMenu
							form={form}
							workspaceId={workspaceId}
							workspaces={workspaces}
						/>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-1.5">
					<StatusBadge isClosed={form.isClosed} visibility={form.visibility} />
					{folder ? (
						<Badge className="gap-1" variant="outline">
							<FolderMark color={folder.color} icon={folder.icon} />
							{folder.name}
						</Badge>
					) : null}
				</div>

				<div className="mt-auto flex items-center gap-3 text-muted-foreground text-xs">
					<span className="flex items-center gap-1">
						<MessageSquareIcon className="size-3.5" />
						{form.submissionsCount}
					</span>
					<span className="flex items-center gap-1">
						<EyeIcon className="size-3.5" />
						{form.viewsCount}
					</span>
					<Tooltip>
						<TooltipTrigger className="ml-auto">
							Updated {formatUpdated(form.updatedAt)}
						</TooltipTrigger>
						<TooltipContent>
							{new Date(form.updatedAt).toLocaleString()}
						</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</div>
	);
}
