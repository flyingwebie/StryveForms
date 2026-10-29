import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import { Separator } from "@StryveForms/ui/components/separator";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CopyIcon,
	EyeOffIcon,
	FolderInputIcon,
	FolderMinusIcon,
	Trash2Icon,
	UploadIcon,
	XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/app/confirm-dialog";
import { useTRPC } from "@/utils/trpc";

/**
 * Floating action bar shown while one or more forms are selected: move,
 * publish/draft, duplicate, move to workspace, or delete them in bulk.
 */
export default function BulkActionBar({
	onClear,
	selectedIds,
	workspaceId,
	workspaces,
}: {
	onClear: () => void;
	selectedIds: string[];
	workspaceId: string;
	workspaces: { id: string; name: string }[];
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [deleteOpen, setDeleteOpen] = useState(false);

	const foldersQuery = useQuery(
		trpc.folder.list.queryOptions({ workspaceId, kind: "form" })
	);

	const invalidate = async () => {
		await queryClient.invalidateQueries({
			queryKey: trpc.form.list.queryKey(),
		});
		await queryClient.invalidateQueries({
			queryKey: trpc.folder.list.queryKey({ workspaceId, kind: "form" }),
		});
	};

	const moveToFolder = useMutation(
		trpc.form.moveToFolder.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success(`Moved ${selectedIds.length} form(s)`);
				onClear();
			},
		})
	);
	const setStatus = useMutation(
		trpc.form.setStatus.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Status updated");
				onClear();
			},
		})
	);
	const bulkDuplicate = useMutation(
		trpc.form.bulkDuplicate.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success(`Duplicated ${selectedIds.length} form(s)`);
				onClear();
			},
		})
	);
	const bulkMoveToWorkspace = useMutation(
		trpc.form.bulkMoveToWorkspace.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Moved to workspace");
				onClear();
			},
		})
	);
	const bulkDelete = useMutation(
		trpc.form.bulkDelete.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success(`Deleted ${selectedIds.length} form(s)`);
				setDeleteOpen(false);
				onClear();
			},
		})
	);

	const folders = foldersQuery.data ?? [];
	const otherWorkspaces = workspaces.filter((w) => w.id !== workspaceId);
	const pending =
		moveToFolder.isPending ||
		setStatus.isPending ||
		bulkDuplicate.isPending ||
		bulkMoveToWorkspace.isPending;

	return (
		<>
			<div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-foreground px-2 py-1.5 text-background shadow-lg">
				<span className="px-2 font-medium text-sm">
					{selectedIds.length} selected
				</span>
				<Separator className="h-5 bg-background/20" orientation="vertical" />

				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								className="text-background hover:bg-background/10 hover:text-background"
								disabled={pending}
								size="sm"
								variant="ghost"
							/>
						}
					>
						<FolderInputIcon /> Folder
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						<DropdownMenuItem
							onClick={() =>
								moveToFolder.mutate({ ids: selectedIds, folderId: null })
							}
						>
							<FolderMinusIcon /> No folder
						</DropdownMenuItem>
						{folders.map((folder) => (
							<DropdownMenuItem
								key={folder.id}
								onClick={() =>
									moveToFolder.mutate({ ids: selectedIds, folderId: folder.id })
								}
							>
								<span
									aria-hidden="true"
									className="mr-1 inline-block size-2 rounded-full"
									style={{ backgroundColor: folder.color ?? "#64748b" }}
								/>
								{folder.icon ? `${folder.icon} ` : ""}
								{folder.name}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>

				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								className="text-background hover:bg-background/10 hover:text-background"
								disabled={pending}
								size="sm"
								variant="ghost"
							/>
						}
					>
						<UploadIcon /> Status
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						<DropdownMenuItem
							onClick={() =>
								setStatus.mutate({ ids: selectedIds, visibility: "public" })
							}
						>
							<UploadIcon /> Publish
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() =>
								setStatus.mutate({ ids: selectedIds, visibility: "draft" })
							}
						>
							<EyeOffIcon /> Mark as draft
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() =>
								setStatus.mutate({ ids: selectedIds, visibility: "closed" })
							}
						>
							Close
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				<Button
					className="text-background hover:bg-background/10 hover:text-background"
					disabled={pending}
					onClick={() => bulkDuplicate.mutate({ ids: selectedIds })}
					size="sm"
					variant="ghost"
				>
					<CopyIcon /> Duplicate
				</Button>

				{otherWorkspaces.length > 0 ? (
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									className="text-background hover:bg-background/10 hover:text-background"
									disabled={pending}
									size="sm"
									variant="ghost"
								/>
							}
						>
							<FolderInputIcon /> Move to workspace
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							{otherWorkspaces.map((workspace) => (
								<DropdownMenuItem
									key={workspace.id}
									onClick={() =>
										bulkMoveToWorkspace.mutate({
											ids: selectedIds,
											workspaceId: workspace.id,
										})
									}
								>
									{workspace.name}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}

				<Separator className="h-5 bg-background/20" orientation="vertical" />
				<Button
					className="text-destructive hover:bg-background/10 hover:text-destructive"
					onClick={() => setDeleteOpen(true)}
					size="sm"
					variant="ghost"
				>
					<Trash2Icon /> Delete
				</Button>
				<Button
					aria-label="Clear selection"
					className="text-background hover:bg-background/10 hover:text-background"
					onClick={onClear}
					size="icon-sm"
					variant="ghost"
				>
					<XIcon />
				</Button>
			</div>
			<ConfirmDialog
				confirmIcon={<Trash2Icon />}
				confirmLabel="Delete forms"
				description={`This hides ${selectedIds.length} form(s) and their submissions. This can't be undone from here.`}
				loading={bulkDelete.isPending}
				onConfirm={() => bulkDelete.mutate({ ids: selectedIds })}
				onOpenChange={setDeleteOpen}
				open={deleteOpen}
				title={`Delete ${selectedIds.length} form(s)?`}
			/>
		</>
	);
}
