import { Badge } from "@StryveForms/ui/components/badge";
import { Switch } from "@StryveForms/ui/components/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@StryveForms/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { formatTrpcError } from "@/lib/format-trpc-error";
import type { WorkspaceSummary } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

type CapabilityRole = "readonly" | "user";
const ROLE_COLUMNS: { label: string; role: CapabilityRole }[] = [
	{ label: "Member", role: "user" },
	{ label: "Read only", role: "readonly" },
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

	return (
		<div className="max-w-3xl space-y-4">
			<p className="text-muted-foreground text-sm">
				Each toggle turns one capability on or off for that role. Admin is
				always full access and can't be changed.
			</p>

			<div className="rounded-xl border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Capability</TableHead>
							<TableHead className="text-center">
								Admin
								<Badge className="ml-1.5" variant="outline">
									Locked
								</Badge>
							</TableHead>
							{ROLE_COLUMNS.map((column) => (
								<TableHead className="text-center" key={column.role}>
									{column.label}
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{capabilities.map((capability) => (
							<TableRow key={capability.key}>
								<TableCell>
									<div className="font-medium">{capability.label}</div>
									<div className="text-muted-foreground text-xs">
										{capability.description}
									</div>
								</TableCell>
								<TableCell className="text-center">
									<CheckIcon className="mx-auto size-4 text-muted-foreground" />
								</TableCell>
								{ROLE_COLUMNS.map((column) => (
									<TableCell className="text-center" key={column.role}>
										<Switch
											checked={matrix[column.role][capability.key]}
											disabled={!isAdmin || update.isPending}
											onCheckedChange={(checked) =>
												toggle(column.role, capability.key, checked)
											}
										/>
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			{!isAdmin && (
				<p className="text-muted-foreground text-xs">
					Only workspace admins can change these permissions.
				</p>
			)}
		</div>
	);
}
