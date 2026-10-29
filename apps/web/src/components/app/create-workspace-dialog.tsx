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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import IconPicker from "@/components/app/icons/icon-picker";
import { useInstance } from "@/lib/instance";
import { useTRPC } from "@/utils/trpc";

const DEFAULT_ICON = "📝";

export default function CreateWorkspaceDialog({
	onCreated,
	open,
	onOpenChange,
}: {
	onCreated: (workspaceId: string) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const instance = useInstance();
	const [name, setName] = useState("");
	const [icon, setIcon] = useState<string | null>(DEFAULT_ICON);

	const create = useMutation(
		trpc.workspace.create.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async (data) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.workspace.list.queryKey(),
				});
				toast.success("Workspace created");
				onCreated(data.id);
				onOpenChange(false);
				setName("");
			},
		})
	);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create workspace</DialogTitle>
					<DialogDescription>
						Workspaces group forms, members and settings separately.
					</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (name.trim()) {
							create.mutate({ icon: icon ?? undefined, name: name.trim() });
						}
					}}
				>
					<div className="space-y-1.5">
						<Label>Icon</Label>
						<IconPicker
							color={instance?.primaryColor}
							label="workspace icon"
							onChange={(next) => setIcon(next ?? DEFAULT_ICON)}
							value={icon}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="workspace-name">Name</Label>
						<Input
							autoFocus
							id="workspace-name"
							onChange={(event) => setName(event.target.value)}
							placeholder="Acme Inc."
							value={name}
						/>
					</div>
					<DialogFooter>
						<Button disabled={!name.trim() || create.isPending} type="submit">
							{create.isPending ? "Creating…" : "Create workspace"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
