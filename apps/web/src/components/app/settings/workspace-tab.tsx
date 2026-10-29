import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/app/confirm-dialog";
import IconPicker from "@/components/app/icons/icon-picker";
import {
	SettingsFooter,
	SettingsRow,
	SettingsSection,
} from "@/components/app/settings-shell";
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
	const dirty =
		name !== workspace.name || icon !== (workspace.icon ?? DEFAULT_ICON);

	function discard() {
		setName(workspace.name);
		setIcon(workspace.icon ?? DEFAULT_ICON);
	}

	return (
		<div className="space-y-10">
			<SettingsSection>
				<SettingsRow
					description="Shown in the sidebar, browser tab, and shared links."
					label="Workspace icon"
				>
					<div className="flex items-center gap-2">
						<IconPicker
							color={iconColor}
							disabled={!isAdmin}
							label="workspace icon"
							onChange={(next) => setIcon(next ?? DEFAULT_ICON)}
							triggerClassName="size-10"
							value={icon}
						/>
					</div>
				</SettingsRow>
				<SettingsRow
					description="Appears in page titles, emails, and the sidebar."
					label="Workspace name"
				>
					<Input
						aria-label="Workspace name"
						disabled={!isAdmin}
						onChange={(event) => setName(event.target.value)}
						value={name}
					/>
				</SettingsRow>
			</SettingsSection>

			{isAdmin && dirty ? (
				<SettingsFooter>
					<Button onClick={discard} type="button" variant="outline">
						Discard
					</Button>
					<Button
						disabled={update.isPending || !name.trim()}
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
				</SettingsFooter>
			) : null}

			{isAdmin && (
				<SettingsSection
					description="These actions are irreversible. Please proceed with caution."
					title="Danger zone"
				>
					<SettingsRow
						description="Permanently deletes this workspace, its forms, submissions, and files. This can't be undone."
						label={<span className="text-destructive">Delete workspace</span>}
					>
						<div className="flex justify-end sm:justify-start">
							<Button
								className="w-full sm:w-auto"
								onClick={() => setDeleteOpen(true)}
								variant="destructive"
							>
								<TrashIcon /> Delete workspace
							</Button>
						</div>
						<ConfirmDialog
							confirmLabel="Delete workspace"
							description={
								<>
									This permanently removes the workspace, its forms, all
									submissions, and uploaded files. This can't be undone.
								</>
							}
							loading={remove.isPending}
							onConfirm={() => remove.mutate({ id: workspace.id })}
							onOpenChange={setDeleteOpen}
							open={deleteOpen}
							title={`Delete "${workspace.name}"?`}
						/>
					</SettingsRow>
				</SettingsSection>
			)}
		</div>
	);
}
