import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@StryveForms/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ShieldIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { formatTrpcError } from "@/lib/format-trpc-error";
import type { WorkspaceSummary } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

type Role = "admin" | "user" | "readonly";
const ROLES: Role[] = ["admin", "user", "readonly"];
const ROLE_LABELS: Record<Role, string> = {
	admin: "Admin",
	readonly: "Read only",
	user: "Member",
};

export default function MembersSettingsTab({
	workspace,
}: {
	workspace: WorkspaceSummary;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<Role>("user");

	const members = useQuery(
		trpc.workspace.members.queryOptions({ workspaceId: workspace.id })
	);
	const isAdmin = workspace.role === "admin";

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.workspace.members.queryKey({ workspaceId: workspace.id }),
		});

	const invite = useMutation(
		trpc.workspace.invite.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async (data) => {
				await invalidate();
				setEmail("");
				toast.success(
					data.status === "invited" ? "Invite sent" : "Member added"
				);
			},
		})
	);
	const cancelInvite = useMutation(
		trpc.workspace.cancelInvite.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: invalidate,
		})
	);
	const updateRole = useMutation(
		trpc.workspace.updateMemberRole.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: invalidate,
		})
	);
	const removeMember = useMutation(
		trpc.workspace.removeMember.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await invalidate();
				toast.success("Member removed");
			},
		})
	);

	return (
		<div className="max-w-2xl space-y-6">
			<Link
				className="inline-flex items-center gap-1.5 text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
				search={{ tab: "roles" }}
				to="/dashboard/settings"
			>
				<ShieldIcon className="size-3.5" />
				What can each role do? Manage roles & permissions
			</Link>
			{isAdmin && (
				<form
					className="flex flex-wrap items-end gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						if (email.trim()) {
							invite.mutate({
								email: email.trim(),
								role,
								workspaceId: workspace.id,
							});
						}
					}}
				>
					<div className="flex-1 space-y-1">
						<label
							className="text-muted-foreground text-xs"
							htmlFor="invite-email"
						>
							Invite by email
						</label>
						<Input
							id="invite-email"
							onChange={(event) => setEmail(event.target.value)}
							placeholder="teammate@example.com"
							type="email"
							value={email}
						/>
					</div>
					<Select
						items={ROLES.map((r) => ({ label: ROLE_LABELS[r], value: r }))}
						onValueChange={(value) => setRole(value as Role)}
						value={role}
					>
						<SelectTrigger className="w-32">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ROLES.map((r) => (
								<SelectItem key={r} value={r}>
									{ROLE_LABELS[r]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button disabled={invite.isPending || !email.trim()} type="submit">
						Invite
					</Button>
				</form>
			)}

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Member</TableHead>
						<TableHead>Role</TableHead>
						{isAdmin && <TableHead />}
					</TableRow>
				</TableHeader>
				<TableBody>
					{(members.data?.members ?? []).map((member) => (
						<TableRow key={member.userId}>
							<TableCell>
								<div className="font-medium">{member.name}</div>
								<div className="text-muted-foreground text-xs">
									{member.email}
								</div>
							</TableCell>
							<TableCell>
								{isAdmin ? (
									<Select
										items={ROLES.map((r) => ({
											label: ROLE_LABELS[r],
											value: r,
										}))}
										onValueChange={(value) =>
											updateRole.mutate({
												role: value as Role,
												userId: member.userId,
												workspaceId: workspace.id,
											})
										}
										value={member.role}
									>
										<SelectTrigger className="w-32" size="sm">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{ROLES.map((r) => (
												<SelectItem key={r} value={r}>
													{ROLE_LABELS[r]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								) : (
									<Badge variant="outline">{ROLE_LABELS[member.role]}</Badge>
								)}
							</TableCell>
							{isAdmin && (
								<TableCell className="text-right">
									<Button
										onClick={() =>
											removeMember.mutate({
												userId: member.userId,
												workspaceId: workspace.id,
											})
										}
										size="sm"
										variant="ghost"
									>
										Remove
									</Button>
								</TableCell>
							)}
						</TableRow>
					))}
				</TableBody>
			</Table>

			{(members.data?.invites.length ?? 0) > 0 && (
				<div className="space-y-2">
					<h3 className="font-medium text-sm">Pending invites</h3>
					<ul className="space-y-1">
						{(members.data?.invites ?? []).map((invitation) => (
							<li
								className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
								key={invitation.id}
							>
								<span>
									{invitation.email} &middot;{" "}
									<span className="text-muted-foreground">
										{ROLE_LABELS[invitation.role]}
									</span>
								</span>
								{isAdmin && (
									<Button
										onClick={() =>
											cancelInvite.mutate({
												inviteId: invitation.id,
												workspaceId: workspace.id,
											})
										}
										size="sm"
										variant="ghost"
									>
										Cancel
									</Button>
								)}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
