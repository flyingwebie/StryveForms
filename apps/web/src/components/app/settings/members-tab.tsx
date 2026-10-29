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
import { MailIcon, SendIcon, ShieldIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/app/confirm-dialog";
import { authClient } from "@/lib/auth-client";
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
const WHITESPACE_PATTERN = /\s+/;

/** Initials shown in a member's avatar chip, e.g. "Davide Del Gatto" → "DD". */
function initialsOf(name: string): string {
	const parts = name.trim().split(WHITESPACE_PATTERN).filter(Boolean);
	if (parts.length === 0) {
		return "?";
	}
	if (parts.length === 1) {
		return parts[0].slice(0, 2).toUpperCase();
	}
	return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

export default function MembersSettingsTab({
	workspace,
}: {
	workspace: WorkspaceSummary;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<Role>("user");
	const [removeTarget, setRemoveTarget] = useState<{
		name: string;
		userId: string;
	} | null>(null);

	const members = useQuery(
		trpc.workspace.members.queryOptions({ workspaceId: workspace.id })
	);
	const isAdmin = workspace.role === "admin";
	const currentUserId = session?.user.id;

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
				setRemoveTarget(null);
				toast.success("Member removed");
			},
		})
	);

	return (
		<div className="space-y-6">
			<Link
				className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground hover:underline hover:underline-offset-4"
				search={{ tab: "roles" }}
				to="/dashboard/settings"
			>
				<ShieldIcon className="size-3.5" />
				What can each role do? Manage roles & permissions
			</Link>

			{isAdmin && (
				<form
					className="flex flex-wrap items-center gap-2"
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
					<div className="relative min-w-56 flex-1">
						<MailIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							aria-label="Invite by email"
							className="pl-9"
							onChange={(event) => setEmail(event.target.value)}
							placeholder="name@company.com"
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
						<SendIcon /> Send invite
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
								<div className="flex items-center gap-2.5 py-1">
									<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft font-medium text-primary-soft-foreground text-xs">
										{initialsOf(member.name)}
									</span>
									<div className="min-w-0">
										<p className="truncate font-medium">
											{member.name}
											{member.userId === currentUserId ? " (You)" : ""}
										</p>
										<p className="truncate text-muted-foreground text-xs">
											{member.email}
										</p>
									</div>
								</div>
							</TableCell>
							<TableCell>
								{isAdmin ? (
									<Select
										disabled={
											member.userId === currentUserId && member.role === "admin"
										}
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
										className="text-destructive hover:bg-destructive/10 hover:text-destructive"
										onClick={() =>
											setRemoveTarget({
												name: member.name,
												userId: member.userId,
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
					<div className="divide-y divide-border rounded-lg border border-border">
						{(members.data?.invites ?? []).map((invitation) => (
							<div
								className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
								key={invitation.id}
							>
								<span className="flex min-w-0 items-center gap-2">
									<MailIcon className="size-4 shrink-0 text-muted-foreground" />
									<span className="truncate">{invitation.email}</span>
									<Badge variant="neutral">
										{ROLE_LABELS[invitation.role]}
									</Badge>
								</span>
								{isAdmin && (
									<span className="flex shrink-0 items-center gap-1">
										<Button
											onClick={() =>
												invite.mutate({
													email: invitation.email,
													role: invitation.role,
													workspaceId: workspace.id,
												})
											}
											size="sm"
											variant="ghost"
										>
											Resend
										</Button>
										<Button
											className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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
									</span>
								)}
							</div>
						))}
					</div>
				</div>
			)}

			<ConfirmDialog
				confirmLabel="Remove member"
				description={
					<>
						{removeTarget?.name.split(" ")[0] || "They"} will immediately lose
						access to {workspace.name} and its forms. You can invite them again
						later.
					</>
				}
				loading={removeMember.isPending}
				onConfirm={() =>
					removeTarget &&
					removeMember.mutate({
						userId: removeTarget.userId,
						workspaceId: workspace.id,
					})
				}
				onOpenChange={(open) => !open && setRemoveTarget(null)}
				open={removeTarget !== null}
				title={`Remove ${removeTarget?.name ?? "this member"}?`}
			/>
		</div>
	);
}
