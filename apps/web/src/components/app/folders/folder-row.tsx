import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import {
	SidebarMenuSub,
	SidebarMenuSubItem,
} from "@StryveForms/ui/components/sidebar";
import { Link } from "@tanstack/react-router";
import {
	ChevronRightIcon,
	FolderIcon,
	FolderPlusIcon,
	MoreHorizontalIcon,
	MoveDownIcon,
	MoveUpIcon,
	PencilIcon,
	Trash2Icon,
} from "lucide-react";
import type { DragEvent } from "react";

import EntityIcon from "@/components/app/icons/entity-icon";

import { usesDefaultFolderIcon } from "./folder-constants";

import type {
	FolderNode,
	FolderRow as FolderRowData,
} from "./folder-tree-utils";

export type DropZone = "after" | "before" | "nest";

export interface DragOverState {
	id: string;
	zone: DropZone;
}

export interface FolderRowProps {
	activeFolderId?: string;
	basePath: "/dashboard" | "/dashboard/templates";
	canMoveDown: boolean;
	canMoveUp: boolean;
	depth: number;
	dragOver: DragOverState | null;
	expandedIds: Set<string>;
	formDropEnabled: boolean;
	node: FolderNode<FolderRowData>;
	onDelete: (folder: FolderRowData) => void;
	onDragLeave: () => void;
	onDragOver: (event: DragEvent, rowId: string) => void;
	onDragStart: (event: DragEvent, rowId: string) => void;
	onDrop: (event: DragEvent, rowId: string) => void;
	onEdit: (folder: FolderRowData) => void;
	onMoveDown: (folder: FolderRowData) => void;
	onMoveUp: (folder: FolderRowData) => void;
	onNewSubfolder: (parentId: string) => void;
	onToggleExpand: (id: string) => void;
}

/** One folder row, rendered recursively for its children when expanded. */
export default function FolderRow({
	activeFolderId,
	basePath,
	canMoveDown,
	canMoveUp,
	depth,
	dragOver,
	expandedIds,
	formDropEnabled,
	node,
	onDelete,
	onDragLeave,
	onDragOver,
	onDragStart,
	onDrop,
	onEdit,
	onMoveDown,
	onMoveUp,
	onNewSubfolder,
	onToggleExpand,
}: FolderRowProps) {
	const { row } = node;
	const hasChildren = node.children.length > 0;
	const expanded = expandedIds.has(row.id);
	const isDragOver = dragOver?.id === row.id;

	return (
		<SidebarMenuSubItem className="relative">
			{/* biome-ignore lint/a11y/noStaticElementInteractions: draggable row container; the link, chevron and menu inside are the real interactive elements */}
			{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: same as above — drag-and-drop has no semantic element */}
			<div
				className="group/folder-row relative flex items-center"
				draggable
				onDragLeave={onDragLeave}
				onDragOver={(event) => onDragOver(event, row.id)}
				onDragStart={(event) => onDragStart(event, row.id)}
				onDrop={(event) => onDrop(event, row.id)}
			>
				{isDragOver && dragOver?.zone === "before" ? (
					<span className="absolute inset-x-2 -top-px h-0.5 rounded-full bg-primary" />
				) : null}
				{isDragOver && dragOver?.zone === "after" ? (
					<span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
				) : null}
				<Link
					className={`flex h-8 min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md pr-8 text-sidebar-foreground text-sm outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground data-active:shadow-xs data-active:ring-1 data-active:ring-sidebar-border ${
						isDragOver && dragOver?.zone === "nest"
							? "bg-sidebar-accent ring-1 ring-sidebar-ring"
							: ""
					}`}
					data-active={activeFolderId === row.id}
					search={{ folder: row.id }}
					style={{ paddingLeft: 8 + depth * 14 }}
					to={basePath}
				>
					<span
						className={
							hasChildren
								? "flex shrink-0 group-hover/folder-row:invisible"
								: "flex shrink-0"
						}
					>
						<FolderGlyph color={row.color} icon={row.icon} />
					</span>
					<span className="truncate">{row.name}</span>
				</Link>
				{hasChildren ? (
					<button
						aria-expanded={expanded}
						aria-label={
							expanded ? `Collapse ${row.name}` : `Expand ${row.name}`
						}
						className="absolute flex size-5 items-center justify-center rounded-sm text-muted-foreground opacity-0 outline-hidden hover:bg-sidebar-border hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring group-hover/folder-row:opacity-100"
						onClick={() => onToggleExpand(row.id)}
						style={{ left: 6 + depth * 14 }}
						type="button"
					>
						<ChevronRightIcon
							className={`size-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
						/>
					</button>
				) : null}
				{node.totalCount > 0 ? (
					<span className="pointer-events-none absolute right-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-medium text-[11px] text-subtle-foreground tabular-nums transition-opacity group-focus-within/folder-row:opacity-0 group-hover/folder-row:opacity-0">
						{node.totalCount}
					</span>
				) : null}
				<DropdownMenu>
					<DropdownMenuTrigger
						aria-label={`Folder actions for ${row.name}`}
						className="absolute right-1 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-hidden transition-opacity hover:bg-sidebar-border hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring group-focus-within/folder-row:opacity-100 group-hover/folder-row:opacity-100 aria-expanded:opacity-100 [&>svg]:size-4"
					>
						<MoreHorizontalIcon />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" side="right">
						<DropdownMenuItem onClick={() => onEdit(row)}>
							<PencilIcon /> Edit folder
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => onNewSubfolder(row.id)}>
							<FolderPlusIcon /> New subfolder
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={!canMoveUp}
							onClick={() => onMoveUp(row)}
						>
							<MoveUpIcon /> Move up
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={!canMoveDown}
							onClick={() => onMoveDown(row)}
						>
							<MoveDownIcon /> Move down
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => onDelete(row)}
							variant="destructive"
						>
							<Trash2Icon /> Delete folder
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{hasChildren && expanded ? (
				<SidebarMenuSub className="mx-0 translate-x-0 gap-0.5 border-l-0 px-0 py-0.5">
					{node.children.map((child) => (
						<FolderRow
							activeFolderId={activeFolderId}
							basePath={basePath}
							canMoveDown={child !== node.children.at(-1)}
							canMoveUp={child !== node.children[0]}
							depth={depth + 1}
							dragOver={dragOver}
							expandedIds={expandedIds}
							formDropEnabled={formDropEnabled}
							key={child.row.id}
							node={child}
							onDelete={onDelete}
							onDragLeave={onDragLeave}
							onDragOver={onDragOver}
							onDragStart={onDragStart}
							onDrop={onDrop}
							onEdit={onEdit}
							onMoveDown={onMoveDown}
							onMoveUp={onMoveUp}
							onNewSubfolder={onNewSubfolder}
							onToggleExpand={onToggleExpand}
						/>
					))}
				</SidebarMenuSub>
			) : null}
		</SidebarMenuSubItem>
	);
}

/** A folder's icon: the Lucide folder (tinted with its colour) by default, or the emoji/icon the user picked. */
function FolderGlyph({
	color,
	icon,
}: {
	color: string | null;
	icon: string | null;
}) {
	if (usesDefaultFolderIcon(icon)) {
		return (
			<FolderIcon
				aria-hidden="true"
				className="size-4 shrink-0"
				style={{ color: color ?? undefined }}
			/>
		);
	}
	return (
		<EntityIcon
			className="shrink-0"
			color={color ?? undefined}
			icon={icon}
			size={15}
		/>
	);
}
