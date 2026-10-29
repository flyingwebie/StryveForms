import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@StryveForms/ui/components/avatar";
import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ImageIcon,
	LaptopIcon,
	LogOutIcon,
	SmartphoneIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import AccountPasskeysCard from "@/components/app/settings/account-passkeys";
import AccountTwoFactorCard from "@/components/app/settings/account-two-factor";
import {
	SettingsFooter,
	SettingsRow,
	SettingsSection,
} from "@/components/app/settings-shell";
import { authClient } from "@/lib/auth-client";
import { uploadAsset } from "@/lib/upload-asset";

const SESSIONS_QUERY_KEY = ["account", "sessions"];

/** Very small user-agent reader for the sessions list — browser + OS only, no device model (not in the UA string). */
function describeUserAgent(userAgent: string | null | undefined): string {
	if (!userAgent) {
		return "Unknown device";
	}
	const browser = (() => {
		if (userAgent.includes("Edg/")) {
			return "Edge";
		}
		if (userAgent.includes("Chrome/")) {
			return "Chrome";
		}
		if (userAgent.includes("Firefox/")) {
			return "Firefox";
		}
		if (userAgent.includes("Safari/")) {
			return "Safari";
		}
		return "Browser";
	})();
	const os = (() => {
		if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
			return "iOS";
		}
		if (userAgent.includes("Mac OS X")) {
			return "macOS";
		}
		if (userAgent.includes("Android")) {
			return "Android";
		}
		if (userAgent.includes("Windows")) {
			return "Windows";
		}
		if (userAgent.includes("Linux")) {
			return "Linux";
		}
		return "an unknown OS";
	})();
	return `${browser} on ${os}`;
}

function isMobileUserAgent(userAgent: string | null | undefined): boolean {
	return Boolean(
		userAgent?.includes("Mobile") ||
			userAgent?.includes("iPhone") ||
			userAgent?.includes("Android")
	);
}

function relativeTime(value: string | Date): string {
	const date = new Date(value);
	const diffMs = Date.now() - date.getTime();
	const minutes = Math.round(diffMs / 60_000);
	if (minutes < 1) {
		return "Active now";
	}
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	const hours = Math.round(minutes / 60);
	if (hours < 24) {
		return `${hours}h ago`;
	}
	const days = Math.round(hours / 24);
	return `${days}d ago`;
}

/** Settings → Account → Sessions: every device currently signed in, with a bulk "sign out other sessions". */
function SessionsSection() {
	const queryClient = useQueryClient();
	const { data: current } = authClient.useSession();
	const sessions = useQuery({
		queryFn: async () => {
			const { data, error } = await authClient.listSessions();
			if (error) {
				throw new Error(error.message || "Couldn't load sessions");
			}
			return data ?? [];
		},
		queryKey: SESSIONS_QUERY_KEY,
	});
	const [signingOut, setSigningOut] = useState(false);

	return (
		<SettingsSection
			description="Devices currently signed in to your account."
			title="Sessions"
		>
			<div className="space-y-3 py-4">
				<div className="divide-y divide-border rounded-lg border border-border">
					{(sessions.data ?? []).map((session) => {
						const isCurrent = session.token === current?.session.token;
						const Icon = isMobileUserAgent(session.userAgent)
							? SmartphoneIcon
							: LaptopIcon;
						return (
							<div
								className="flex items-center gap-3 px-3 py-2.5 text-sm"
								key={session.id}
							>
								<Icon className="size-4 shrink-0 text-muted-foreground" />
								<div className="min-w-0 flex-1">
									<p className="flex items-center gap-2 font-medium">
										{describeUserAgent(session.userAgent)}
										{isCurrent ? (
											<span className="font-medium text-success text-xs">
												This device
											</span>
										) : null}
									</p>
									<p className="text-muted-foreground text-xs">
										{relativeTime(session.updatedAt)}
									</p>
								</div>
							</div>
						);
					})}
					{sessions.data && sessions.data.length === 0 ? (
						<p className="px-3 py-4 text-center text-muted-foreground text-sm">
							No active sessions.
						</p>
					) : null}
				</div>
				<Button
					disabled={signingOut}
					onClick={async () => {
						setSigningOut(true);
						await authClient.revokeOtherSessions({
							fetchOptions: {
								onError: (error) => {
									toast.error(error.error.message);
								},
								onSuccess: async () => {
									await queryClient.invalidateQueries({
										queryKey: SESSIONS_QUERY_KEY,
									});
									toast.success("Other sessions signed out");
								},
							},
						});
						setSigningOut(false);
					}}
					variant="outline"
				>
					<LogOutIcon /> Sign out other sessions
				</Button>
			</div>
		</SettingsSection>
	);
}

export default function AccountSettingsTab() {
	const { data: session } = authClient.useSession();
	const [name, setName] = useState(session?.user.name ?? "");
	const [savingName, setSavingName] = useState(false);
	const [uploadingAvatar, setUploadingAvatar] = useState(false);
	const avatarInputRef = useRef<HTMLInputElement>(null);
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [changingPassword, setChangingPassword] = useState(false);

	if (!session) {
		return null;
	}

	const dirty = name.trim() !== session.user.name;
	const passwordsMatch =
		!(newPassword && confirmPassword) || newPassword === confirmPassword;

	return (
		<div className="space-y-10">
			<SettingsSection>
				<div className="flex flex-col gap-3 py-5 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3">
						<Avatar className="size-12 rounded-full">
							<AvatarImage src={session.user.image ?? undefined} />
							<AvatarFallback className="rounded-full bg-primary-soft font-semibold text-primary-soft-foreground">
								{session.user.name.slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div>
							<p className="font-medium text-sm">{session.user.name}</p>
							<p className="text-muted-foreground text-xs">
								{session.user.email}
							</p>
						</div>
					</div>
					<div>
						<input
							accept="image/*"
							className="hidden"
							onChange={async (event) => {
								const file = event.target.files?.[0];
								if (!file) {
									return;
								}
								setUploadingAvatar(true);
								try {
									const url = await uploadAsset(file);
									await authClient.updateUser(
										{ image: url },
										{
											onError: (error) => {
												toast.error(
													error.error.message || error.error.statusText
												);
											},
											onSuccess: () => {
												toast.success("Avatar updated");
											},
										}
									);
								} catch (error) {
									toast.error(
										error instanceof Error ? error.message : "Upload failed"
									);
								} finally {
									setUploadingAvatar(false);
									event.target.value = "";
								}
							}}
							ref={avatarInputRef}
							type="file"
						/>
						<Button
							disabled={uploadingAvatar}
							onClick={() => avatarInputRef.current?.click()}
							type="button"
							variant="outline"
						>
							<ImageIcon /> {uploadingAvatar ? "Uploading…" : "Change avatar"}
						</Button>
					</div>
				</div>
				<SettingsRow
					description="Shown on comments and shared activity."
					label="Full name"
				>
					<Input
						onChange={(event) => setName(event.target.value)}
						value={name}
					/>
				</SettingsRow>
				<SettingsRow
					description="Used to sign in and receive notifications."
					label="Email"
				>
					<Input disabled value={session.user.email} />
				</SettingsRow>
			</SettingsSection>

			{dirty ? (
				<SettingsFooter>
					<Button
						onClick={() => setName(session.user.name)}
						type="button"
						variant="outline"
					>
						Discard
					</Button>
					<Button
						disabled={savingName || !name.trim()}
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
						{savingName ? "Saving…" : "Save changes"}
					</Button>
				</SettingsFooter>
			) : null}

			<SettingsSection
				description="Change the password used to sign in."
				title="Password"
			>
				<SettingsRow label="Current password">
					<Input
						autoComplete="current-password"
						onChange={(event) => setCurrentPassword(event.target.value)}
						type="password"
						value={currentPassword}
					/>
				</SettingsRow>
				<SettingsRow description="At least 10 characters." label="New password">
					<Input
						autoComplete="new-password"
						onChange={(event) => setNewPassword(event.target.value)}
						type="password"
						value={newPassword}
					/>
				</SettingsRow>
				<SettingsRow label="Confirm new password">
					<div className="space-y-1">
						<Input
							aria-invalid={!passwordsMatch}
							autoComplete="new-password"
							onChange={(event) => setConfirmPassword(event.target.value)}
							type="password"
							value={confirmPassword}
						/>
						{passwordsMatch ? null : (
							<p className="text-destructive text-xs">Passwords don't match.</p>
						)}
					</div>
				</SettingsRow>
			</SettingsSection>

			<div className="flex justify-end">
				<Button
					disabled={
						changingPassword ||
						!currentPassword ||
						newPassword.length < 10 ||
						!passwordsMatch
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
									setConfirmPassword("");
								},
							}
						);
						setChangingPassword(false);
					}}
				>
					{changingPassword ? "Updating…" : "Update password"}
				</Button>
			</div>

			<SessionsSection />

			<AccountPasskeysCard />
			<AccountTwoFactorCard />
		</div>
	);
}
