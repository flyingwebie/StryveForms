import { Avatar, AvatarFallback } from "@StryveForms/ui/components/avatar";
import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import { Input } from "@StryveForms/ui/components/input";
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
import {
	KeyRoundIcon,
	MoreHorizontalIcon,
	SearchIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/app/confirm-dialog";
import { authClient } from "@/lib/auth-client";
import { formatTrpcError } from "@/lib/format-trpc-error";
import { useTRPC } from "@/utils/trpc";

const WHITESPACE = /\s+/;

function initials(name: string) {
	const parts = name.trim().split(WHITESPACE);
	return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

export default function AdminUsersTab() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const users = useQuery(trpc.instance.users.queryOptions());
	const { data: session } = authClient.useSession();
	const [search, setSearch] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [resetTarget, setResetTarget] = useState<{
		id: string;
		name: string;
	} | null>(null);

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: trpc.instance.users.queryKey() });

	const setAdmin = useMutation(
		trpc.instance.setAdmin.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: invalidate,
		})
	);
	const deleteUser = useMutation(
		trpc.instance.deleteUser.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await invalidate();
				toast.success("User deleted");
				setDeleteTarget(null);
			},
		})
	);
	const resetTwoFactor = useMutation(
		trpc.instance.resetTwoFactor.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await invalidate();
				toast.success(
					"Two-factor authentication was reset — they can sign in with just their password again"
				);
				setResetTarget(null);
			},
		})
	);

	const allUsers = users.data ?? [];
	const filtered = search.trim()
		? allUsers.filter((user) =>
				`${user.name} ${user.email}`
					.toLowerCase()
					.includes(search.trim().toLowerCase())
			)
		: allUsers;

	return (
		<div className="space-y-4 pb-20">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-muted-foreground text-sm">
					{allUsers.length}{" "}
					{allUsers.length === 1 ? "person has" : "people have"} access to this
					instance.
				</p>
				<div className="relative">
					<SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						className="w-64 pl-8"
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search users…"
						value={search}
					/>
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border bg-card">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead className="text-right">Joined</TableHead>
							<TableHead className="text-center">Admin</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{filtered.map((user) => {
							const isSelf = user.id === session?.user.id;
							return (
								<TableRow key={user.id}>
									<TableCell>
										<div className="flex items-center gap-2.5">
											<Avatar size="sm">
												<AvatarFallback className="bg-primary-soft text-[11px] text-primary-soft-foreground">
													{initials(user.name)}
												</AvatarFallback>
											</Avatar>
											<div className="min-w-0">
												<div className="truncate font-medium">{user.name}</div>
												<div className="truncate text-subtle-foreground text-xs">
													{user.email}
												</div>
											</div>
										</div>
									</TableCell>
									<TableCell className="text-right text-muted-foreground">
										{new Date(user.createdAt).toLocaleDateString(undefined, {
											day: "numeric",
											month: "short",
											year: "numeric",
										})}
									</TableCell>
									<TableCell className="text-center">
										<Switch
											checked={Boolean(user.isAdmin)}
											disabled={setAdmin.isPending}
											onCheckedChange={(checked) =>
												setAdmin.mutate({ isAdmin: checked, userId: user.id })
											}
										/>
									</TableCell>
									<TableCell className="w-10 text-right">
										<DropdownMenu>
											<DropdownMenuTrigger
												render={
													<Button
														aria-label={`Actions for ${user.name}`}
														size="icon-sm"
														variant="ghost"
													/>
												}
											>
												<MoreHorizontalIcon />
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												{user.twoFactorEnabled ? (
													<DropdownMenuItem
														onClick={() =>
															setResetTarget({ id: user.id, name: user.name })
														}
													>
														<KeyRoundIcon /> Reset 2FA
													</DropdownMenuItem>
												) : null}
												<DropdownMenuItem
													disabled={isSelf}
													onClick={() =>
														setDeleteTarget({ id: user.id, name: user.name })
													}
													variant="destructive"
												>
													<Trash2Icon /> Delete user
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>

			<ConfirmDialog
				description={`This permanently deletes ${deleteTarget?.name ?? "this user"}'s account and everything they own.`}
				loading={deleteUser.isPending}
				onConfirm={() =>
					deleteTarget && deleteUser.mutate({ userId: deleteTarget.id })
				}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteTarget(null);
					}
				}}
				open={Boolean(deleteTarget)}
				title="Delete this user?"
			/>

			<ConfirmDialog
				confirmLabel="Reset 2FA"
				description={`${resetTarget?.name ?? "This user"} will lose their authenticator app enrollment and backup codes. They'll sign in with just their password until they set 2FA up again.`}
				loading={resetTwoFactor.isPending}
				onConfirm={() =>
					resetTarget && resetTwoFactor.mutate({ userId: resetTarget.id })
				}
				onOpenChange={(open) => {
					if (!open) {
						setResetTarget(null);
					}
				}}
				open={Boolean(resetTarget)}
				title="Reset two-factor authentication?"
			/>
		</div>
	);
}
