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
import { StarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
	FOLDER_COLORS,
	FOLDER_EMOJIS,
} from "@/components/app/folders/folder-constants";
import { useTRPC } from "@/utils/trpc";

/** "Save as template" — snapshots a form's current settings into a reusable workspace template. */
export default function SaveAsTemplateDialog({
	formId,
	formTitle,
	onOpenChange,
	open,
	workspaceId,
}: {
	formId: string;
	formTitle: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [name, setName] = useState(formTitle);
	const [description, setDescription] = useState("");
	const [color, setColor] = useState<string | undefined>();
	const [icon, setIcon] = useState<string | undefined>();

	useEffect(() => {
		if (open) {
			setName(formTitle);
			setDescription("");
			setColor(undefined);
			setIcon(undefined);
		}
	}, [open, formTitle]);

	const create = useMutation(
		trpc.template.createFromForm.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.template.listMine.queryKey({ workspaceId }),
				});
				toast.success("Template saved");
				onOpenChange(false);
			},
		})
	);

	function handleSubmit() {
		const trimmed = name.trim();
		if (!trimmed) {
			toast.error("Give the template a name");
			return;
		}
		create.mutate({
			formId,
			name: trimmed,
			description: description.trim() || undefined,
			color,
			icon,
		});
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>Save as template</DialogTitle>
					<DialogDescription>
						Reuse this form's fields and design next time you create a new one.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="template-name">Name</Label>
						<Input
							id="template-name"
							onChange={(event) => setName(event.target.value)}
							value={name}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="template-description">Description (optional)</Label>
						<Textarea
							id="template-description"
							onChange={(event) => setDescription(event.target.value)}
							rows={2}
							value={description}
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
						disabled={create.isPending}
						onClick={handleSubmit}
						type="button"
					>
						<StarIcon /> Save template
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
