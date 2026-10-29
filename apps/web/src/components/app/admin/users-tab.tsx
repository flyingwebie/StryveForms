import { Button } from "@StryveForms/ui/components/button";
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
import { useState } from "react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/app/confirm-dialog";
import { authClient } from "@/lib/auth-client";
import { formatTrpcError } from "@/lib/format-trpc-error";
import { useTRPC } from "@/utils/trpc";

export default function AdminUsersTab() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const users = useQuery(trpc.instance.users.queryOptions());
	const { data: session } = authClient.useSession();
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

	return (
		<div className="max-w-3xl space-y-4">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Email</TableHead>
						<TableHead>Joined</TableHead>
						<TableHead>Admin</TableHead>
						<TableHead />
					</TableRow>
				</TableHeader>
				<TableBody>
					{(users.data ?? []).map((user) => {
						const isSelf = user.id === session?.user.id;
						return (
							<TableRow key={user.id}>
								<TableCell className="font-medium">{user.name}</TableCell>
								<TableCell className="text-muted-foreground">
									{user.email}
								</TableCell>
								<TableCell className="text-muted-foreground">
									{new Date(user.createdAt).toLocaleDateString()}
								</TableCell>
								<TableCell>
									<Switch
										checked={Boolean(user.isAdmin)}
										disabled={setAdmin.isPending}
										onCheckedChange={(checked) =>
											setAdmin.mutate({ isAdmin: checked, userId: user.id })
										}
									/>
								</TableCell>
								<TableCell className="text-right">
									{user.twoFactorEnabled ? (
										<Button
											onClick={() =>
												setResetTarget({ id: user.id, name: user.name })
											}
											size="sm"
											title="Clears their authenticator app and backup codes so they can sign in with just their password again"
											variant="ghost"
										>
											Reset 2FA
										</Button>
									) : null}
									<Button
										disabled={isSelf}
										onClick={() =>
											setDeleteTarget({ id: user.id, name: user.name })
										}
										size="sm"
										title={
											isSelf
												? "You can't delete your own account here"
												: undefined
										}
										variant="ghost"
									>
										Delete
									</Button>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>

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
