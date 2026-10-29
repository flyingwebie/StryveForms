import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/app/confirm-dialog";
import IconPicker from "@/components/app/icons/icon-picker";
import { formatTrpcError } from "@/lib/format-trpc-error";
import { useInstance } from "@/lib/instance";
import type { WorkspaceSummary } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

const DEFAULT_ICON = "📝";

export default function WorkspaceSettingsTab({
	workspace,
}: {
	workspace: WorkspaceSummary;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const instance = useInstance();
	const [name, setName] = useState(workspace.name);
	const [icon, setIcon] = useState<string | null>(
		workspace.icon ?? DEFAULT_ICON
	);
	const [deleteOpen, setDeleteOpen] = useState(false);
	// The workspace's own brand colour tints a chosen Lucide icon; falls back to the instance colour.
	const iconColor = workspace.brandColor ?? instance?.primaryColor;

	const update = useMutation(
		trpc.workspace.update.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.workspace.list.queryKey(),
				});
				toast.success("Workspace updated");
			},
		})
	);
	const remove = useMutation(
		trpc.workspace.delete.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.workspace.list.queryKey(),
				});
				toast.success("Workspace deleted");
				navigate({ to: "/dashboard" });
			},
		})
	);

	const isAdmin = workspace.role === "admin";

	return (
		<div className="max-w-lg space-y-8">
			<div className="space-y-4">
				<div className="space-y-1.5">
					<Label>Icon</Label>
					<p className="text-muted-foreground text-xs">
						Pick an emoji, or a Lucide icon tinted with the workspace colour
						(set in Brand).
					</p>
					<IconPicker
						color={iconColor}
						disabled={!isAdmin}
						label="workspace icon"
						onChange={(next) => setIcon(next ?? DEFAULT_ICON)}
						value={icon}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="workspace-settings-name">Name</Label>
					<Input
						disabled={!isAdmin}
						id="workspace-settings-name"
						onChange={(event) => setName(event.target.value)}
						value={name}
					/>
				</div>
				<Button
					disabled={!isAdmin || update.isPending || !name.trim()}
					onClick={() =>
						update.mutate({
							icon: icon ?? null,
							id: workspace.id,
							name: name.trim(),
						})
					}
				>
					{update.isPending ? "Saving…" : "Save changes"}
				</Button>
			</div>

			{isAdmin && (
				<div className="space-y-2 border-destructive/30 border-t pt-6">
					<h3 className="font-medium text-destructive text-sm">
						Delete workspace
					</h3>
					<p className="text-muted-foreground text-sm">
						Permanently deletes this workspace, its forms and submissions. You
						can't delete your only workspace.
					</p>
					<Button onClick={() => setDeleteOpen(true)} variant="destructive">
						Delete workspace
					</Button>
					<ConfirmDialog
						description="This permanently deletes the workspace and everything in it. This can't be undone."
						loading={remove.isPending}
						onConfirm={() => remove.mutate({ id: workspace.id })}
						onOpenChange={setDeleteOpen}
						open={deleteOpen}
						title="Delete this workspace?"
					/>
				</div>
			)}
		</div>
	);
}
