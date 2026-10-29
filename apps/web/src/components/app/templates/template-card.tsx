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
	BriefcaseIcon,
	CalendarIcon,
	EyeIcon,
	FileTextIcon,
	FolderInputIcon,
	FolderMinusIcon,
	GraduationCapIcon,
	HeartIcon,
	type LucideIcon,
	MessageSquareIcon,
	MoreHorizontalIcon,
	PencilIcon,
	SparklesIcon,
	Trash2Icon,
	TrendingUpIcon,
} from "lucide-react";
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

/** Icon shown in the card's tile when a category matches, chosen to echo the design's per-category art. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
	Education: GraduationCapIcon,
	Events: SparklesIcon,
	Feedback: MessageSquareIcon,
	Health: HeartIcon,
	HR: BriefcaseIcon,
	Registration: CalendarIcon,
	Sales: TrendingUpIcon,
};

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

function iconForCategory(category: string | null | undefined): LucideIcon {
	return (category && CATEGORY_ICONS[category]) || FileTextIcon;
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
	const CategoryIcon = iconForCategory(template.category);

	return (
		<div className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md">
			<div className="flex items-start justify-between gap-2">
				<div
					className="flex size-11 shrink-0 items-center justify-center rounded-xl"
					style={{ backgroundColor: `${color}1f`, color }}
				>
					{template.icon ? (
						<span aria-hidden="true" className="text-lg leading-none">
							{template.icon}
						</span>
					) : (
						<CategoryIcon className="size-5" />
					)}
				</div>
				<div className="flex min-w-0 items-center gap-1.5">
					{folder ? (
						<Badge className="gap-1" variant="outline">
							<FolderMark color={folder.color} icon={folder.icon} />
							<span className="truncate">{folder.name}</span>
						</Badge>
					) : null}
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
			</div>

			<div className="min-w-0">
				<h3 className="truncate font-medium text-sm">{template.name}</h3>
				{template.category ? (
					<span className="text-subtle-foreground text-xs">
						{template.category}
					</span>
				) : null}
			</div>

			<p className="line-clamp-2 flex-1 text-muted-foreground text-sm">
				{template.description}
			</p>

			<div className="relative">
				<div className="flex flex-wrap items-center gap-1.5 transition-opacity sm:group-hover:pointer-events-none sm:group-hover:opacity-0 sm:group-focus-within:pointer-events-none sm:group-focus-within:opacity-0">
					<Badge variant="outline">{template.fieldsCount} fields</Badge>
				</div>
				<div className="mt-2 flex items-center gap-2 opacity-100 transition-opacity sm:pointer-events-none sm:absolute sm:inset-0 sm:mt-0 sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100">
					<Button
						className="flex-1 sm:flex-none"
						onClick={onPreview}
						size="sm"
						variant="outline"
					>
						<EyeIcon /> Preview
					</Button>
					<Button className="flex-1 sm:flex-none" onClick={onUse} size="sm">
						<SparklesIcon /> Use template
					</Button>
				</div>
			</div>
		</div>
	);
}
