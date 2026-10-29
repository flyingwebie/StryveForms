import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import {
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuSub,
	SidebarMenuSubItem,
} from "@StryveForms/ui/components/sidebar";
import { Link } from "@tanstack/react-router";
import {
	ChevronRightIcon,
	FolderPlusIcon,
	MoreHorizontalIcon,
	MoveDownIcon,
	MoveUpIcon,
	PencilIcon,
	Trash2Icon,
} from "lucide-react";
import type { DragEvent } from "react";

import EntityIcon from "@/components/app/icons/entity-icon";

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
		<SidebarMenuSubItem className="group/menu-sub-item relative">
			{/* biome-ignore lint/a11y/noStaticElementInteractions: draggable row container; the link, chevron and menu inside are the real interactive elements */}
			{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: same as above — drag-and-drop has no semantic element */}
			<div
				className="relative flex items-center"
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
				{hasChildren ? (
					<button
						aria-label={
							expanded ? `Collapse ${row.name}` : `Expand ${row.name}`
						}
						className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
						onClick={() => onToggleExpand(row.id)}
						style={{ marginLeft: depth * 12 }}
						type="button"
					>
						<ChevronRightIcon
							className={`size-3 transition-transform ${expanded ? "rotate-90" : ""}`}
						/>
					</button>
				) : (
					<span
						className="size-4 shrink-0"
						style={{ marginLeft: depth * 12 }}
					/>
				)}
				<Link
					className={`flex h-7 min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground text-sm outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground ${
						isDragOver && dragOver?.zone === "nest"
							? "bg-sidebar-accent ring-1 ring-sidebar-ring"
							: ""
					}`}
					data-active={activeFolderId === row.id}
					search={{ folder: row.id }}
					to={basePath}
				>
					{row.icon ? (
						<EntityIcon
							className="shrink-0"
							color={row.color ?? undefined}
							icon={row.icon}
							size={14}
						/>
					) : (
						<span
							aria-hidden="true"
							className="inline-block size-2 shrink-0 rounded-full"
							style={{ backgroundColor: row.color ?? "#64748b" }}
						/>
					)}
					<span className="truncate">{row.name}</span>
				</Link>
				{node.totalCount > 0 ? (
					<SidebarMenuBadge className="top-1/2 min-w-5 -translate-y-1/2 rounded-full bg-muted px-1.5 font-normal text-[10px] text-muted-foreground transition-opacity group-hover/menu-sub-item:opacity-0">
						{node.totalCount}
					</SidebarMenuBadge>
				) : null}
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuAction
								className="top-1/2 -translate-y-1/2"
								showOnHover
							/>
						}
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
				<SidebarMenuSub className="mx-0 border-l-0 px-0">
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
