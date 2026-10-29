import type { FormField } from "@StryveForms/forms/types";
import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import {
	EyeIcon,
	FolderInputIcon,
	FolderMinusIcon,
	MoreHorizontalIcon,
	PencilIcon,
	SparklesIcon,
	Trash2Icon,
} from "lucide-react";
import { FormThumbnail } from "@/components/app/forms/form-thumbnail";
import FolderMark from "@/components/app/icons/folder-mark";

const CATEGORY_COLORS = [
	"#3b82f6",
	"#8b5cf6",
	"#14b8a6",
	"#f97316",
	"#ec4899",
	"#22c55e",
	"#eab308",
	"#6366f1",
];

/** Deterministic colour per category, for built-in templates that have none of their own. */
function colorForCategory(category: string | null | undefined): string {
	if (!category) {
		return CATEGORY_COLORS[0];
	}
	let hash = 0;
	for (let i = 0; i < category.length; i += 1) {
		hash = (hash * 31 + category.charCodeAt(i)) % CATEGORY_COLORS.length;
	}
	return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

export interface TemplateCardData {
	category?: string | null;
	color?: string | null;
	description?: string | null;
	fieldsCount: number;
	icon?: string | null;
	id?: string;
	name: string;
	properties: FormField[];
	slug?: string;
}

export default function TemplateCard({
	folder,
	folders,
	isCustom,
	onDelete,
	onEdit,
	onMoveToFolder,
	onPreview,
	onUse,
	template,
}: {
	folder?: { color: string | null; icon?: string | null; name: string } | null;
	folders?: {
		color: string | null;
		icon: string | null;
		id: string;
		name: string;
	}[];
	isCustom: boolean;
	onDelete?: () => void;
	onEdit?: () => void;
	onMoveToFolder?: (folderId: string | null) => void;
	onPreview: () => void;
	onUse: () => void;
	template: TemplateCardData;
}) {
	const color = template.color ?? colorForCategory(template.category);

	return (
		<div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-150 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md">
			<FormThumbnail
				className="h-28 w-full"
				color={color}
				properties={template.properties}
			/>
			<div className="flex flex-1 flex-col gap-2 p-4">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<h3 className="truncate font-medium">
							{template.icon ? `${template.icon} ` : ""}
							{template.name}
						</h3>
						{template.category ? (
							<span className="text-muted-foreground text-xs">
								{template.category}
							</span>
						) : null}
					</div>
					{isCustom ? (
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button
										aria-label="Template actions"
										size="icon-sm"
										variant="ghost"
									/>
								}
							>
								<MoreHorizontalIcon />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={onEdit}>
									<PencilIcon /> Edit details
								</DropdownMenuItem>
								{onMoveToFolder ? (
									<DropdownMenuSub>
										<DropdownMenuSubTrigger>
											<FolderInputIcon /> Move to folder
										</DropdownMenuSubTrigger>
										<DropdownMenuSubContent>
											<DropdownMenuItem onClick={() => onMoveToFolder(null)}>
												<FolderMinusIcon /> No folder
											</DropdownMenuItem>
											{(folders ?? []).map((f) => (
												<DropdownMenuItem
													key={f.id}
													onClick={() => onMoveToFolder(f.id)}
												>
													<FolderMark color={f.color} icon={f.icon} />
													{f.name}
												</DropdownMenuItem>
											))}
										</DropdownMenuSubContent>
									</DropdownMenuSub>
								) : null}
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={onDelete} variant="destructive">
									<Trash2Icon /> Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
				</div>

				<p className="line-clamp-2 flex-1 text-muted-foreground text-sm">
					{template.description}
				</p>

				<div className="flex flex-wrap items-center gap-1.5">
					<Badge variant="outline">{template.fieldsCount} fields</Badge>
					{folder ? (
						<Badge className="gap-1" variant="outline">
							<FolderMark color={folder.color} icon={folder.icon} />
							{folder.name}
						</Badge>
					) : null}
				</div>

				<div className="mt-1 flex items-center gap-2">
					<Button onClick={onPreview} size="sm" variant="outline">
						<EyeIcon /> Preview
					</Button>
					<Button className="flex-1" onClick={onUse} size="sm">
						<SparklesIcon /> Use template
					</Button>
				</div>
			</div>
		</div>
	);
}
