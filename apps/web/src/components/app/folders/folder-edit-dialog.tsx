import { Button } from "@StryveForms/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@StryveForms/ui/components/dialog";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import IconPicker from "@/components/app/icons/icon-picker";
import { useTRPC } from "@/utils/trpc";

import {
	DEFAULT_FOLDER_COLOR,
	DEFAULT_FOLDER_ICON,
	FOLDER_COLORS,
} from "./folder-constants";
import {
	buildFolderTree,
	type FolderRow,
	flattenWithDepth,
	isSelfOrDescendant,
} from "./folder-tree-utils";

const NO_PARENT = "__root__";

export interface FolderEditTarget {
	color: string | null;
	icon: string | null;
	id: string;
	name: string;
	parentId?: string | null;
}

/**
 * Create or rename/restyle a folder. Pass `folder` to edit, omit it to
 * create a new one; pass `defaultParentId` to pre-select a parent when
 * creating a subfolder from a folder's own menu.
 */
export default function FolderEditDialog({
	defaultParentId,
	folder,
	folders,
	kind,
	onOpenChange,
	open,
	workspaceId,
}: {
	/** Pre-selected parent for a brand-new folder (e.g. "New subfolder"). */
	defaultParentId?: string | null;
	folder?: FolderEditTarget | null;
	/** The full flat folder list, for the "Parent folder" picker. */
	folders: FolderRow[];
	kind: "form" | "template";
	onOpenChange: (open: boolean) => void;
	open: boolean;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [name, setName] = useState(folder?.name ?? "");
	const [color, setColor] = useState(folder?.color ?? DEFAULT_FOLDER_COLOR);
	const [icon, setIcon] = useState(folder?.icon ?? DEFAULT_FOLDER_ICON);
	const [parentId, setParentId] = useState<string>(
		folder?.parentId ?? defaultParentId ?? NO_PARENT
	);

	useEffect(() => {
		if (open) {
			setName(folder?.name ?? "");
			setColor(folder?.color ?? DEFAULT_FOLDER_COLOR);
			setIcon(folder?.icon ?? DEFAULT_FOLDER_ICON);
			setParentId(folder?.parentId ?? defaultParentId ?? NO_PARENT);
		}
	}, [open, folder, defaultParentId]);

	// A folder can't become a child of itself or of its own subfolder.
	const parentOptions = useMemo(() => {
		const tree = buildFolderTree(folders);
		const flat = flattenWithDepth(tree);
		return flat.filter(
			({ row }) => !(folder && isSelfOrDescendant(folders, folder.id, row.id))
		);
	}, [folders, folder]);

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.folder.list.queryKey({ workspaceId, kind }),
		});

	const create = useMutation(
		trpc.folder.create.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Folder created");
				onOpenChange(false);
			},
		})
	);
	const update = useMutation(
		trpc.folder.update.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Folder updated");
				onOpenChange(false);
			},
		})
	);

	const pending = create.isPending || update.isPending;

	function handleSubmit() {
		const trimmed = name.trim();
		if (!trimmed) {
			toast.error("Give the folder a name");
			return;
		}
		const resolvedParentId = parentId === NO_PARENT ? null : parentId;
		if (folder) {
			update.mutate({
				id: folder.id,
				name: trimmed,
				color,
				icon,
				parentId: resolvedParentId,
			});
		} else {
			create.mutate({
				workspaceId,
				kind,
				name: trimmed,
				color,
				icon,
				parentId: resolvedParentId,
			});
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>{folder ? "Edit folder" : "New folder"}</DialogTitle>
					<DialogDescription>
						{kind === "form"
							? "Organize your forms with a named, coloured folder."
							: "Organize your templates with a named, coloured folder."}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="folder-name">Name</Label>
						<Input
							id="folder-name"
							onChange={(event) => setName(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									handleSubmit();
								}
							}}
							placeholder="e.g. Marketing"
							value={name}
						/>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="folder-parent">Parent folder</Label>
						<Select
							items={[
								{ label: "No parent (top level)", value: NO_PARENT },
								...parentOptions.map(({ depth, row }) => ({
									label: `${"— ".repeat(depth)}${row.name}`,
									value: row.id,
								})),
							]}
							onValueChange={(value) => setParentId(value ?? NO_PARENT)}
							value={parentId}
						>
							<SelectTrigger className="w-full" id="folder-parent">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_PARENT}>No parent (top level)</SelectItem>
								{parentOptions.map(({ depth, row }) => (
									<SelectItem key={row.id} value={row.id}>
										{"— ".repeat(depth)}
										{row.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-1.5">
						<Label>Colour</Label>
						<div className="flex flex-wrap gap-1.5">
							{FOLDER_COLORS.map((option) => (
								<button
									aria-label={`Colour ${option.name}`}
									aria-pressed={option.value === color}
									className="flex size-8 items-center justify-center rounded-full ring-1 ring-border ring-offset-2 ring-offset-background data-selected:ring-2 data-selected:ring-foreground"
									data-selected={option.value === color}
									key={option.value}
									onClick={() => setColor(option.value)}
									style={{ backgroundColor: option.value }}
									type="button"
								/>
							))}
						</div>
					</div>

					<div className="space-y-1.5">
						<Label>Icon</Label>
						<p className="text-muted-foreground text-xs">
							Pick an emoji, or a Lucide icon tinted with the colour above.
						</p>
						<IconPicker
							color={color}
							label="folder icon"
							onChange={(next) => setIcon(next ?? DEFAULT_FOLDER_ICON)}
							value={icon}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant="ghost"
					>
						Cancel
					</Button>
					<Button disabled={pending} onClick={handleSubmit} type="button">
						{folder ? "Save changes" : "Create folder"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
