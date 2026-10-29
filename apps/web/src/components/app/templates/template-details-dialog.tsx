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
import { Textarea } from "@StryveForms/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
	FOLDER_COLORS,
	FOLDER_EMOJIS,
} from "@/components/app/folders/folder-constants";
import { useTRPC } from "@/utils/trpc";

export interface TemplateDetailsTarget {
	category: string | null;
	color: string | null;
	description: string | null;
	icon: string | null;
	id: string;
	name: string;
}

/** Edit an existing workspace template's name, description, category, colour and icon. */
export default function TemplateDetailsDialog({
	onOpenChange,
	open,
	template,
	workspaceId,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	template: TemplateDetailsTarget | null;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [category, setCategory] = useState("");
	const [color, setColor] = useState<string | undefined>();
	const [icon, setIcon] = useState<string | undefined>();

	useEffect(() => {
		if (open && template) {
			setName(template.name);
			setDescription(template.description ?? "");
			setCategory(template.category ?? "");
			setColor(template.color ?? undefined);
			setIcon(template.icon ?? undefined);
		}
	}, [open, template]);

	const update = useMutation(
		trpc.template.update.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.template.listMine.queryKey({ workspaceId }),
				});
				toast.success("Template updated");
				onOpenChange(false);
			},
		})
	);

	function handleSubmit() {
		if (!template) {
			return;
		}
		const trimmed = name.trim();
		if (!trimmed) {
			toast.error("Give the template a name");
			return;
		}
		update.mutate({
			id: template.id,
			name: trimmed,
			description: description.trim() || null,
			category: category.trim() || null,
			color: color ?? null,
			icon: icon ?? null,
		});
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>Edit template</DialogTitle>
					<DialogDescription>
						Update how this template shows up in your gallery.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="template-edit-name">Name</Label>
						<Input
							id="template-edit-name"
							onChange={(event) => setName(event.target.value)}
							value={name}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="template-edit-description">Description</Label>
						<Textarea
							id="template-edit-description"
							onChange={(event) => setDescription(event.target.value)}
							rows={2}
							value={description}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="template-edit-category">Category</Label>
						<Input
							id="template-edit-category"
							onChange={(event) => setCategory(event.target.value)}
							placeholder="e.g. HR, Events, Marketing"
							value={category}
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Icon</Label>
						<div className="flex flex-wrap gap-1.5">
							{FOLDER_EMOJIS.map((option) => (
								<button
									aria-pressed={option === icon}
									className="flex size-8 items-center justify-center rounded-lg border border-border text-base data-selected:bg-muted data-selected:ring-1 data-selected:ring-ring"
									data-selected={option === icon}
									key={option}
									onClick={() => setIcon(option === icon ? undefined : option)}
									type="button"
								>
									{option}
								</button>
							))}
						</div>
					</div>
					<div className="space-y-1.5">
						<Label>Colour</Label>
						<div className="flex flex-wrap gap-1.5">
							{FOLDER_COLORS.map((option) => (
								<button
									aria-pressed={option.value === color}
									className="flex size-8 items-center justify-center rounded-full ring-1 ring-border ring-offset-2 ring-offset-background data-selected:ring-2 data-selected:ring-foreground"
									data-selected={option.value === color}
									key={option.value}
									onClick={() =>
										setColor(option.value === color ? undefined : option.value)
									}
									style={{ backgroundColor: option.value }}
									type="button"
								/>
							))}
						</div>
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
					<Button
						disabled={update.isPending}
						onClick={handleSubmit}
						type="button"
					>
						Save changes
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
