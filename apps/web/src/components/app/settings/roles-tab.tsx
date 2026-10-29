import { Switch } from "@StryveForms/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockIcon } from "lucide-react";
import { toast } from "sonner";

import { formatTrpcError } from "@/lib/format-trpc-error";
import type { WorkspaceSummary } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

type CapabilityRole = "readonly" | "user";
const ROLE_COLUMNS: { label: string; role: CapabilityRole }[] = [
	{ label: "Member", role: "user" },
	{ label: "Read only", role: "readonly" },
];

/** Presentational-only grouping of the flat capability list, matching the design. */
const CAPABILITY_GROUPS: { keys: string[]; label: string }[] = [
	{
		keys: ["view_forms", "edit_forms", "delete_forms", "publish_forms"],
		label: "Content",
	},
	{ keys: ["manage_submissions"], label: "Submissions" },
	{
		keys: ["manage_integrations", "manage_pdf_templates", "use_ai_assistant"],
		label: "Integrations & AI",
	},
	{
		keys: [
			"manage_folders",
			"manage_members",
			"manage_workspace",
			"import_data",
			"export_workspace",
		],
		label: "Workspace",
	},
];

/**
 * What each role can do in this workspace, beyond the built-in defaults.
 * Admin always has full access and can't be changed here.
 */
export default function RolesSettingsTab({
	workspace,
}: {
	workspace: WorkspaceSummary;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const isAdmin = workspace.role === "admin";

	const permissions = useQuery(
		trpc.workspace.rolePermissions.queryOptions({ workspaceId: workspace.id })
	);

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.workspace.rolePermissions.queryKey({
				workspaceId: workspace.id,
			}),
		});

	const update = useMutation(
		trpc.workspace.updateRolePermissions.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: invalidate,
		})
	);

	if (!permissions.data) {
		return (
			<p className="text-muted-foreground text-sm">Loading permissions…</p>
		);
	}

	const { capabilities, matrix, overrides } = permissions.data;
	type Capability = (typeof capabilities)[number]["key"];

	function toggle(role: CapabilityRole, key: Capability, next: boolean) {
		update.mutate({
			overrides: { ...overrides, [role]: { ...overrides[role], [key]: next } },
			workspaceId: workspace.id,
		});
	}

	const capabilityByKey = new Map(capabilities.map((c) => [c.key, c]));

	return (
		<div className="space-y-6">
			{!isAdmin && (
				<p className="text-muted-foreground text-sm">
					Only workspace admins can change these permissions.
				</p>
			)}

			<div className="grid grid-cols-[1fr_repeat(3,96px)] items-center gap-x-4 border-border border-b pb-3 sm:grid-cols-[1fr_repeat(3,120px)]">
				<span />
				<span className="flex items-center justify-center gap-1 font-medium text-muted-foreground text-xs">
					Admin <LockIcon className="size-3" />
				</span>
				{ROLE_COLUMNS.map((column) => (
					<span
						className="text-center font-medium text-muted-foreground text-xs"
						key={column.role}
					>
						{column.label}
					</span>
				))}
			</div>

			{CAPABILITY_GROUPS.map((group) => (
				<div className="space-y-1" key={group.label}>
					<h3 className="pt-2 font-semibold text-sm">{group.label}</h3>
					<div className="divide-y divide-border">
						{group.keys.flatMap((key) => {
							const capability = capabilityByKey.get(key as Capability);
							if (!capability) {
								return [];
							}
							return (
								<div
									className="grid grid-cols-[1fr_repeat(3,96px)] items-center gap-x-4 py-4 sm:grid-cols-[1fr_repeat(3,120px)]"
									key={capability.key}
								>
									<div>
										<p className="font-medium text-[13px]">
											{capability.label}
										</p>
										<p className="text-subtle-foreground text-xs">
											{capability.description}
										</p>
									</div>
									<div className="flex justify-center">
										<LockIcon className="size-4 text-muted-foreground/60" />
									</div>
									{ROLE_COLUMNS.map((column) => (
										<div className="flex justify-center" key={column.role}>
											<Switch
												checked={matrix[column.role][capability.key]}
												disabled={!isAdmin || update.isPending}
												onCheckedChange={(checked) =>
													toggle(column.role, capability.key, checked)
												}
											/>
										</div>
									))}
								</div>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}
