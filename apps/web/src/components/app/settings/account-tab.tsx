import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { useState } from "react";
import { toast } from "sonner";

import AccountPasskeysCard from "@/components/app/settings/account-passkeys";
import AccountTwoFactorCard from "@/components/app/settings/account-two-factor";
import { authClient } from "@/lib/auth-client";

export default function AccountSettingsTab() {
	const { data: session } = authClient.useSession();
	const [name, setName] = useState(session?.user.name ?? "");
	const [savingName, setSavingName] = useState(false);
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [changingPassword, setChangingPassword] = useState(false);

	if (!session) {
		return null;
	}

	return (
		<div className="max-w-2xl space-y-8">
			<div className="max-w-lg space-y-4">
				<h3 className="font-medium text-sm">Profile</h3>
				<div className="space-y-2">
					<Label htmlFor="account-name">Name</Label>
					<Input
						id="account-name"
						onChange={(event) => setName(event.target.value)}
						value={name}
					/>
				</div>
				<div className="space-y-2">
					<Label>Email</Label>
					<Input disabled value={session.user.email} />
				</div>
				<Button
					disabled={savingName || !name.trim() || name === session.user.name}
					onClick={async () => {
						setSavingName(true);
						await authClient.updateUser(
							{ name: name.trim() },
							{
								onError: (error) => {
									toast.error(error.error.message || error.error.statusText);
								},
								onSuccess: () => {
									toast.success("Profile updated");
								},
							}
						);
						setSavingName(false);
					}}
				>
					{savingName ? "Saving…" : "Save"}
				</Button>
			</div>

			<div className="max-w-lg space-y-4 border-t pt-6">
				<h3 className="font-medium text-sm">Change password</h3>
				<div className="space-y-2">
					<Label htmlFor="current-password">Current password</Label>
					<Input
						autoComplete="current-password"
						id="current-password"
						onChange={(event) => setCurrentPassword(event.target.value)}
						type="password"
						value={currentPassword}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="new-password">New password</Label>
					<Input
						autoComplete="new-password"
						id="new-password"
						onChange={(event) => setNewPassword(event.target.value)}
						type="password"
						value={newPassword}
					/>
				</div>
				<Button
					disabled={
						changingPassword || !currentPassword || newPassword.length < 8
					}
					onClick={async () => {
						setChangingPassword(true);
						await authClient.changePassword(
							{ currentPassword, newPassword, revokeOtherSessions: true },
							{
								onError: (error) => {
									toast.error(error.error.message || error.error.statusText);
								},
								onSuccess: () => {
									toast.success("Password changed");
									setCurrentPassword("");
									setNewPassword("");
								},
							}
						);
						setChangingPassword(false);
					}}
				>
					{changingPassword ? "Updating…" : "Update password"}
				</Button>
			</div>

			<div className="max-w-lg space-y-2 border-t pt-6">
				<h3 className="font-medium text-sm">Sessions</h3>
				<p className="text-muted-foreground text-sm">
					Sign out of every other browser and device, keeping this session
					active.
				</p>
				<Button
					onClick={() => {
						authClient.revokeOtherSessions({
							fetchOptions: {
								onError: (error) => {
									toast.error(error.error.message);
								},
								onSuccess: () => {
									toast.success("Other sessions signed out");
								},
							},
						});
					}}
					variant="outline"
				>
					Sign out other sessions
				</Button>
			</div>

			<div className="space-y-6 border-t pt-6">
				<h3 className="font-medium text-sm">Sign-in security</h3>
				<AccountTwoFactorCard />
				<AccountPasskeysCard />
			</div>
		</div>
	);
}
