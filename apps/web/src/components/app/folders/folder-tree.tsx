import {
	SidebarGroupAction,
	SidebarGroupLabel,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@StryveForms/ui/components/sidebar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FolderPlusIcon, InboxIcon, PlusIcon } from "lucide-react";
import type { DragEvent } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/app/confirm-dialog";
import { useTRPC } from "@/utils/trpc";

import {
	expandedFoldersStorageKey,
	FOLDER_DRAG_MIME,
	FORM_DRAG_MIME,
	NO_FOLDER,
} from "./folder-constants";
import FolderEditDialog, { type FolderEditTarget } from "./folder-edit-dialog";
import type { DragOverState } from "./folder-row";
import FolderRow from "./folder-row";
import { buildFolderTree, isSelfOrDescendant } from "./folder-tree-utils";

export interface FolderTreeProps {
	/** Current `?folder=` value: undefined = all, `"none"` = unfiled, else a folder id. */
	activeFolderId?: string;
	/** Route to link folders to, e.g. "/dashboard" or "/dashboard/templates". */
	basePath: "/dashboard" | "/dashboard/templates";
	kind: "form" | "template";
	/** Group heading (e.g. "Folders"); renders it with a "+ New folder" action. */
	label?: string;
	workspaceId: string;
}

function readExpanded(
	workspaceId: string,
	kind: "form" | "template"
): Set<string> {
	if (typeof window === "undefined") {
		return new Set();
	}
	try {
		const raw = window.localStorage.getItem(
			expandedFoldersStorageKey(workspaceId, kind)
		);
		return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
	} catch {
		return new Set();
	}
}

/**
 * Folder tree shown in the sidebar under Forms / Templates: nested folders
 * with expand/collapse, create/rename/re-colour/delete, drag a folder onto
 * another to nest it or above/below a sibling to reorder it (also doable
 * from the "…" menu for keyboard users), and — for forms — drop dragged
 * cards onto a folder to move them. Filtering by a folder also includes
 * its subfolders' items (the folder's badge count is the running total).
 */
export default function FolderTree({
	activeFolderId,
	basePath,
	kind,
	label,
	workspaceId,
}: FolderTreeProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [editTarget, setEditTarget] = useState<
		FolderEditTarget | null | undefined
	>(undefined);
	const [newSubfolderParentId, setNewSubfolderParentId] = useState<
		string | null
	>(null);
	const [deleteTarget, setDeleteTarget] = useState<FolderEditTarget | null>(
		null
	);
	const [dragOver, setDragOver] = useState<DragOverState | null>(null);
	const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
		readExpanded(workspaceId, kind)
	);

	useEffect(() => {
		setExpandedIds(readExpanded(workspaceId, kind));
	}, [workspaceId, kind]);

	function toggleExpand(id: string) {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			try {
				window.localStorage.setItem(
					expandedFoldersStorageKey(workspaceId, kind),
					JSON.stringify([...next])
				);
			} catch {
				// Storage can be unavailable (private browsing); ignore.
			}
			return next;
		});
	}

	const foldersQuery = useQuery(
		trpc.folder.list.queryOptions({ workspaceId, kind })
	);
	const folders = foldersQuery.data ?? [];
	const tree = buildFolderTree(folders);

	const invalidateFolders = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.folder.list.queryKey({ workspaceId, kind }),
		});
	const invalidateItems = () =>
		queryClient.invalidateQueries({
			queryKey:
				kind === "form"
					? trpc.form.list.queryKey()
					: trpc.template.listMine.queryKey(),
		});

	const remove = useMutation(
		trpc.folder.delete.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await Promise.all([invalidateFolders(), invalidateItems()]);
				toast.success("Folder deleted");
				setDeleteTarget(null);
			},
		})
	);
	const moveFormsToFolder = useMutation(
		trpc.form.moveToFolder.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidateItems();
				await invalidateFolders();
				toast.success("Moved");
			},
		})
	);
	const updateFolder = useMutation(
		trpc.folder.update.mutationOptions({
			onError: (error) => toast.error(error.message),
		})
	);
	const reorderFolders = useMutation(
		trpc.folder.reorder.mutationOptions({
			onError: (error) => toast.error(error.message),
		})
	);

	async function afterFolderMutation() {
		await invalidateFolders();
	}

	/** Reorders `folderId` one step up or down among its current siblings. */
	function moveSibling(folderId: string, direction: "down" | "up") {
		const current = folders.find((f) => f.id === folderId);
		if (!current) {
			return;
		}
		const siblings = folders
			.filter((f) => f.parentId === current.parentId)
			.sort((a, b) => a.position - b.position);
		const index = siblings.findIndex((f) => f.id === folderId);
		const swapWith = direction === "up" ? index - 1 : index + 1;
		if (swapWith < 0 || swapWith >= siblings.length) {
			return;
		}
		const reordered = [...siblings];
		const [moved] = reordered.splice(index, 1);
		reordered.splice(swapWith, 0, moved);
		reorderFolders.mutate(
			{ ids: reordered.map((f) => f.id) },
			{ onSuccess: afterFolderMutation }
		);
	}

	/** Nests `draggedId` under `newParentId` (null = top level), rejecting cycles. */
	function nestFolder(draggedId: string, newParentId: string | null) {
		if (newParentId && isSelfOrDescendant(folders, draggedId, newParentId)) {
			toast.error(
				"A folder can't be nested inside itself or its own subfolder"
			);
			return;
		}
		updateFolder.mutate(
			{ id: draggedId, parentId: newParentId },
			{ onSuccess: afterFolderMutation }
		);
	}

	/** Moves `draggedId` to just before/after `targetId`, reparenting it if needed. */
	function reorderFolder(
		draggedId: string,
		targetId: string,
		zone: "after" | "before"
	) {
		const target = folders.find((f) => f.id === targetId);
		const dragged = folders.find((f) => f.id === draggedId);
		if (!(target && dragged)) {
			return;
		}
		if (isSelfOrDescendant(folders, draggedId, target.parentId ?? "")) {
			toast.error(
				"A folder can't be nested inside itself or its own subfolder"
			);
			return;
		}
		const siblings = folders
			.filter((f) => f.parentId === target.parentId && f.id !== draggedId)
			.sort((a, b) => a.position - b.position);
		const targetIndex = siblings.findIndex((f) => f.id === targetId);
		const insertAt = zone === "before" ? targetIndex : targetIndex + 1;
		const ids = [
			...siblings.slice(0, insertAt).map((f) => f.id),
			draggedId,
			...siblings.slice(insertAt).map((f) => f.id),
		];
		const reorder = () =>
			reorderFolders.mutate({ ids }, { onSuccess: afterFolderMutation });
		if (dragged.parentId === target.parentId) {
			reorder();
		} else {
			updateFolder.mutate(
				{ id: draggedId, parentId: target.parentId },
				{ onSuccess: reorder }
			);
		}
	}

	function handleDragStart(event: DragEvent, rowId: string) {
		event.dataTransfer.setData(FOLDER_DRAG_MIME, rowId);
	}

	function handleDragOver(event: DragEvent, rowId: string) {
		const isFolderDrag = event.dataTransfer.types.includes(FOLDER_DRAG_MIME);
		const isFormDrag =
			kind === "form" && event.dataTransfer.types.includes(FORM_DRAG_MIME);
		if (!(isFolderDrag || isFormDrag)) {
			return;
		}
		event.preventDefault();
		// "No folder" isn't a reorderable sibling — dropping on it always un-nests.
		if (!isFolderDrag || rowId === NO_FOLDER) {
			setDragOver({ id: rowId, zone: "nest" });
			return;
		}
		const rect = event.currentTarget.getBoundingClientRect();
		const ratio = (event.clientY - rect.top) / rect.height;
		let zone: DragOverState["zone"] = "nest";
		if (ratio < 0.3) {
			zone = "before";
		} else if (ratio > 0.7) {
			zone = "after";
		}
		setDragOver({ id: rowId, zone });
	}

	function handleDrop(event: DragEvent, rowId: string) {
		event.preventDefault();
		const zone = dragOver?.zone ?? "nest";
		setDragOver(null);
		const draggedFolderId = event.dataTransfer.getData(FOLDER_DRAG_MIME);
		if (draggedFolderId && draggedFolderId !== rowId) {
			const targetId = rowId === NO_FOLDER ? null : rowId;
			if (zone === "nest" || !targetId) {
				nestFolder(draggedFolderId, targetId);
			} else {
				reorderFolder(draggedFolderId, targetId, zone);
			}
			return;
		}
		const raw = event.dataTransfer.getData(FORM_DRAG_MIME);
		if (!raw) {
			return;
		}
		try {
			const ids = JSON.parse(raw) as string[];
			if (ids.length > 0) {
				moveFormsToFolder.mutate({
					folderId: rowId === NO_FOLDER ? null : rowId,
					ids,
				});
			}
		} catch {
			// Not a recognised drag payload — ignore.
		}
	}

	const formDropEnabled = kind === "form";
	const noFolderDragOver = dragOver?.id === NO_FOLDER;

	return (
		<>
			{label ? (
				<>
					<SidebarGroupLabel className="text-[11px] uppercase tracking-wider">
						{label}
					</SidebarGroupLabel>
					<SidebarGroupAction
						aria-label="New folder"
						onClick={() => {
							setNewSubfolderParentId(null);
							setEditTarget(null);
						}}
						title="New folder"
					>
						<PlusIcon />
					</SidebarGroupAction>
				</>
			) : null}
			<SidebarMenuSub className="mx-0 translate-x-0 gap-0.5 border-l-0 px-0">
				{tree.map((node, index) => (
					<FolderRow
						activeFolderId={activeFolderId}
						basePath={basePath}
						canMoveDown={index < tree.length - 1}
						canMoveUp={index > 0}
						depth={0}
						dragOver={dragOver}
						expandedIds={expandedIds}
						formDropEnabled={formDropEnabled}
						key={node.row.id}
						node={node}
						onDelete={setDeleteTarget}
						onDragLeave={() => setDragOver(null)}
						onDragOver={handleDragOver}
						onDragStart={handleDragStart}
						onDrop={handleDrop}
						onEdit={setEditTarget}
						onMoveDown={(folder) => moveSibling(folder.id, "down")}
						onMoveUp={(folder) => moveSibling(folder.id, "up")}
						onNewSubfolder={(parentId) => {
							setNewSubfolderParentId(parentId);
							setEditTarget(null);
						}}
						onToggleExpand={toggleExpand}
					/>
				))}

				<SidebarMenuSubItem>
					<SidebarMenuSubButton
						className={
							noFolderDragOver
								? "h-8 bg-sidebar-accent ring-1 ring-sidebar-ring"
								: "h-8 data-active:font-medium data-active:shadow-xs data-active:ring-1 data-active:ring-sidebar-border"
						}
						isActive={activeFolderId === NO_FOLDER}
						onDragLeave={() => setDragOver(null)}
						onDragOver={(event) => handleDragOver(event, NO_FOLDER)}
						onDrop={(event) => handleDrop(event, NO_FOLDER)}
						render={<Link search={{ folder: NO_FOLDER }} to={basePath} />}
					>
						<InboxIcon />
						<span>No folder</span>
					</SidebarMenuSubButton>
				</SidebarMenuSubItem>

				<SidebarMenuSubItem>
					<SidebarMenuSubButton
						className="mt-1 h-8 w-full border border-sidebar-border border-dashed text-muted-foreground hover:border-primary/40 hover:bg-sidebar-accent hover:text-foreground"
						onClick={() => {
							setNewSubfolderParentId(null);
							setEditTarget(null);
						}}
						render={<button type="button" />}
					>
						<FolderPlusIcon />
						<span>New folder</span>
					</SidebarMenuSubButton>
				</SidebarMenuSubItem>
			</SidebarMenuSub>

			<FolderEditDialog
				defaultParentId={newSubfolderParentId}
				folder={editTarget ?? null}
				folders={folders}
				kind={kind}
				onOpenChange={(next) => {
					if (!next) {
						setEditTarget(undefined);
						setNewSubfolderParentId(null);
					}
				}}
				open={editTarget !== undefined || newSubfolderParentId !== null}
				workspaceId={workspaceId}
			/>
			<ConfirmDialog
				description={`Forms inside "${deleteTarget?.name}" (and any subfolders) move to No folder. This can't be undone.`}
				loading={remove.isPending}
				onConfirm={() => deleteTarget && remove.mutate({ id: deleteTarget.id })}
				onOpenChange={(next) => {
					if (!next) {
						setDeleteTarget(null);
					}
				}}
				open={deleteTarget !== null}
				title="Delete this folder?"
			/>
		</>
	);
}
