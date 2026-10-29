import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	CopyIcon,
	ExternalLinkIcon,
	EyeOffIcon,
	FolderInputIcon,
	FolderMinusIcon,
	MoreHorizontalIcon,
	PencilIcon,
	Share2Icon,
	Trash2Icon,
	UploadIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/app/confirm-dialog";
import ShareDialog from "@/components/app/share/share-dialog";
import SaveAsTemplateDialog from "@/components/app/templates/save-as-template-dialog";
import { useTRPC } from "@/utils/trpc";

export interface FormMenuTarget {
	id: string;
	slug: string;
	submissionsCount: number;
	title: string;
	visibility: string;
}

/**
 * The actions menu for one form: used from the card view, the table row,
 * and anywhere else a single form needs its usual actions.
 */
export default function FormMenu({
	form,
	workspaceId,
	workspaces,
}: {
	form: FormMenuTarget;
	workspaceId: string;
	workspaces: { id: string; name: string }[];
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [shareOpen, setShareOpen] = useState(false);
	const [templateOpen, setTemplateOpen] = useState(false);

	const foldersQuery = useQuery(
		trpc.folder.list.queryOptions({ workspaceId, kind: "form" })
	);

	const invalidateForms = () =>
		queryClient.invalidateQueries({ queryKey: trpc.form.list.queryKey() });

	const duplicate = useMutation(
		trpc.form.duplicate.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidateForms();
				toast.success("Form duplicated");
			},
		})
	);
	const remove = useMutation(
		trpc.form.delete.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidateForms();
				toast.success("Form deleted");
				setConfirmOpen(false);
			},
		})
	);
	const move = useMutation(
		trpc.form.move.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidateForms();
				toast.success("Form moved");
			},
		})
	);
	const moveToFolder = useMutation(
		trpc.form.moveToFolder.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidateForms();
				await queryClient.invalidateQueries({
					queryKey: trpc.folder.list.queryKey({ workspaceId, kind: "form" }),
				});
				toast.success("Moved to folder");
			},
		})
	);
	const setStatus = useMutation(
		trpc.form.setStatus.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidateForms();
			},
		})
	);

	const otherWorkspaces = workspaces.filter((w) => w.id !== workspaceId);
	const folders = foldersQuery.data ?? [];

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button aria-label="Form actions" size="icon-sm" variant="ghost" />
					}
				>
					<MoreHorizontalIcon />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem
						render={<Link params={{ formId: form.id }} to="/editor/$formId" />}
					>
						<PencilIcon /> Edit form
					</DropdownMenuItem>
					<DropdownMenuItem
						render={
							<Link
								params={{ formId: form.id }}
								to="/dashboard/forms/$formId"
							/>
						}
					>
						View responses
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => setShareOpen(true)}>
						<Share2Icon /> Share
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => {
							navigator.clipboard.writeText(
								`${window.location.origin}/forms/${form.slug}`
							);
							toast.success("Link copied");
						}}
					>
						<CopyIcon /> Copy share link
					</DropdownMenuItem>
					<DropdownMenuItem
						render={
							<a
								href={`/forms/${form.slug}`}
								rel="noopener noreferrer"
								target="_blank"
							/>
						}
					>
						<ExternalLinkIcon /> Open public link
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					{form.visibility === "draft" ? (
						<DropdownMenuItem
							onClick={() =>
								setStatus.mutate({ ids: [form.id], visibility: "public" })
							}
						>
							<UploadIcon /> Publish
						</DropdownMenuItem>
					) : (
						<DropdownMenuItem
							onClick={() =>
								setStatus.mutate({ ids: [form.id], visibility: "draft" })
							}
						>
							<EyeOffIcon /> Mark as draft
						</DropdownMenuItem>
					)}
					<DropdownMenuItem onClick={() => duplicate.mutate({ id: form.id })}>
						<CopyIcon /> Duplicate
						<DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => setTemplateOpen(true)}>
						<Share2Icon /> Save as template
					</DropdownMenuItem>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							<FolderInputIcon /> Move to folder
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							<DropdownMenuItem
								onClick={() =>
									moveToFolder.mutate({ ids: [form.id], folderId: null })
								}
							>
								<FolderMinusIcon /> No folder
							</DropdownMenuItem>
							{folders.map((folder) => (
								<DropdownMenuItem
									key={folder.id}
									onClick={() =>
										moveToFolder.mutate({
											ids: [form.id],
											folderId: folder.id,
										})
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
						</DropdownMenuSubContent>
					</DropdownMenuSub>
					{otherWorkspaces.length > 0 ? (
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>
								<FolderInputIcon /> Move to workspace
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								{otherWorkspaces.map((workspace) => (
									<DropdownMenuItem
										key={workspace.id}
										onClick={() =>
											move.mutate({ id: form.id, workspaceId: workspace.id })
										}
									>
										{workspace.name}
									</DropdownMenuItem>
								))}
							</DropdownMenuSubContent>
						</DropdownMenuSub>
					) : null}
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onClick={() => setConfirmOpen(true)}
						variant="destructive"
					>
						<Trash2Icon /> Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<ConfirmDialog
				confirmIcon={<Trash2Icon />}
				confirmLabel="Delete form"
				description={`This hides the form and its ${form.submissionsCount} submission${
					form.submissionsCount === 1 ? "" : "s"
				}. This can't be undone from here.`}
				loading={remove.isPending}
				onConfirm={() => remove.mutate({ id: form.id })}
				onOpenChange={setConfirmOpen}
				open={confirmOpen}
				title={`Delete "${form.title}"?`}
			/>
			<ShareDialog
				formId={form.id}
				onOpenChange={setShareOpen}
				open={shareOpen}
			/>
			<SaveAsTemplateDialog
				formId={form.id}
				formTitle={form.title}
				onOpenChange={setTemplateOpen}
				open={templateOpen}
				workspaceId={workspaceId}
			/>
		</>
	);
}
