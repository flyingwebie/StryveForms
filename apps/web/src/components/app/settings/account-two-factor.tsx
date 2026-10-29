import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@StryveForms/ui/components/dialog";
import { Input } from "@StryveForms/ui/components/input";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@StryveForms/ui/components/input-otp";
import { Label } from "@StryveForms/ui/components/label";
import {
	CheckIcon,
	CopyIcon,
	DownloadIcon,
	ShieldCheckIcon,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { useInstance } from "@/lib/instance";

/** Pulls the manual entry key (the `secret=` param) out of a TOTP URI, for people who can't scan a QR code. */
function manualKeyFromTotpUri(totpUri: string): string {
	try {
		return new URL(totpUri).searchParams.get("secret") ?? "";
	} catch {
		return "";
	}
}

/** Copy, and download-as-.txt, for a list of backup codes. */
function BackupCodesActions({ codes }: { codes: string[] }) {
	const [copied, setCopied] = useState(false);

	return (
		<div className="flex gap-2">
			<Button
				onClick={async () => {
					await navigator.clipboard.writeText(codes.join("\n"));
					setCopied(true);
					setTimeout(() => setCopied(false), 2000);
				}}
				size="sm"
				type="button"
				variant="outline"
			>
				{copied ? <CheckIcon /> : <CopyIcon />}
				{copied ? "Copied" : "Copy"}
			</Button>
			<Button
				onClick={() => {
					const blob = new Blob([codes.join("\n")], { type: "text/plain" });
					const url = URL.createObjectURL(blob);
					const a = document.createElement("a");
					a.href = url;
					a.download = "stryveforms-backup-codes.txt";
					a.click();
					URL.revokeObjectURL(url);
				}}
				size="sm"
				type="button"
				variant="outline"
			>
				<DownloadIcon /> Download
			</Button>
		</div>
	);
}

/** Final step of enabling 2FA (and the "regenerate" flow): shows the one-time recovery codes exactly once. */
function BackupCodesStep({
	codes,
	onDone,
}: {
	codes: string[];
	onDone: () => void;
}) {
	const [saved, setSaved] = useState(false);
	return (
		<div className="space-y-4">
			<p className="text-muted-foreground text-sm">
				Save these codes somewhere safe. Each one lets you sign in once if you
				lose access to your authenticator app — they won't be shown again.
			</p>
			<div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
				{codes.map((code) => (
					<span key={code}>{code}</span>
				))}
			</div>
			<BackupCodesActions codes={codes} />
			<label className="flex items-center gap-2 text-sm">
				<input
					checked={saved}
					onChange={(event) => setSaved(event.target.checked)}
					type="checkbox"
				/>
				I've saved these codes
			</label>
			<DialogFooter>
				<Button disabled={!saved} onClick={onDone} type="button">
					Done
				</Button>
			</DialogFooter>
		</div>
	);
}

type EnableStep =
	| { kind: "password" }
	| { kind: "verify"; backupCodes: string[]; totpUri: string }
	| { kind: "backup-codes"; backupCodes: string[] };

/** The enable wizard: confirm password → scan QR / enter key → verify a code → save backup codes. */
function EnableTwoFactorDialog({
	onEnabled,
	onOpenChange,
	open,
}: {
	onEnabled: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const instance = useInstance();
	const [step, setStep] = useState<EnableStep>({ kind: "password" });
	const [password, setPassword] = useState("");
	const [code, setCode] = useState("");
	const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (open) {
			setStep({ kind: "password" });
			setPassword("");
			setCode("");
			setQrDataUrl(null);
		}
	}, [open]);

	useEffect(() => {
		if (step.kind !== "verify") {
			return;
		}
		let cancelled = false;
		QRCode.toDataURL(step.totpUri, { margin: 1, width: 200 })
			.then((url) => {
				if (!cancelled) {
					setQrDataUrl(url);
				}
			})
			.catch(() => setQrDataUrl(null));
		return () => {
			cancelled = true;
		};
	}, [step]);

	async function submitPassword() {
		setBusy(true);
		await authClient.twoFactor.enable(
			{
				issuer: instance?.name || "StryveForms",
				method: "totp",
				password,
			},
			{
				onError: (error) => {
					toast.error(error.error.message || error.error.statusText);
				},
				onSuccess: (context) => {
					const data = context.data as {
						backupCodes?: string[];
						totpURI?: string;
					};
					if (data.totpURI) {
						setStep({
							backupCodes: data.backupCodes ?? [],
							kind: "verify",
							totpUri: data.totpURI,
						});
					}
				},
			}
		);
		setBusy(false);
	}

	async function submitCode() {
		if (step.kind !== "verify") {
			return;
		}
		setBusy(true);
		await authClient.twoFactor.verifyTotp(
			{ code },
			{
				onError: (error) => {
					toast.error(error.error.message || error.error.statusText);
				},
				onSuccess: () => {
					setStep({ backupCodes: step.backupCodes, kind: "backup-codes" });
				},
			}
		);
		setBusy(false);
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="rounded-xl">
				<DialogHeader>
					<DialogTitle>Turn on two-factor authentication</DialogTitle>
					<DialogDescription>
						{step.kind === "password" &&
							"Confirm your password to get started."}
						{step.kind === "verify" &&
							"Scan this QR code with an authenticator app (like Google Authenticator or 1Password), then enter the 6-digit code it shows."}
						{step.kind === "backup-codes" &&
							"Two-factor authentication is on. Save your backup codes."}
					</DialogDescription>
				</DialogHeader>

				{step.kind === "password" ? (
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="tfa-enable-password">Current password</Label>
							<Input
								autoComplete="current-password"
								id="tfa-enable-password"
								onChange={(event) => setPassword(event.target.value)}
								type="password"
								value={password}
							/>
						</div>
						<DialogFooter>
							<Button
								disabled={!password || busy}
								onClick={submitPassword}
								type="button"
							>
								{busy ? "Checking…" : "Continue"}
							</Button>
						</DialogFooter>
					</div>
				) : null}

				{step.kind === "verify" ? (
					<div className="space-y-4">
						<div className="flex justify-center">
							{qrDataUrl ? (
								<img
									alt="QR code for your authenticator app"
									className="rounded-lg border"
									height={200}
									src={qrDataUrl}
									width={200}
								/>
							) : (
								<div className="size-[200px] animate-pulse rounded-lg bg-muted" />
							)}
						</div>
						<div className="space-y-1">
							<Label>Can't scan it? Enter this key manually</Label>
							<code className="block break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">
								{manualKeyFromTotpUri(step.totpUri)}
							</code>
						</div>
						<div className="flex flex-col items-center gap-2">
							<Label htmlFor="tfa-verify-code">6-digit code</Label>
							<InputOTP
								id="tfa-verify-code"
								maxLength={6}
								onChange={setCode}
								value={code}
							>
								<InputOTPGroup>
									{[0, 1, 2, 3, 4, 5].map((i) => (
										<InputOTPSlot index={i} key={i} />
									))}
								</InputOTPGroup>
							</InputOTP>
						</div>
						<DialogFooter>
							<Button
								disabled={code.length !== 6 || busy}
								onClick={submitCode}
								type="button"
							>
								{busy ? "Verifying…" : "Verify & turn on"}
							</Button>
						</DialogFooter>
					</div>
				) : null}

				{step.kind === "backup-codes" ? (
					<BackupCodesStep
						codes={step.backupCodes}
						onDone={() => {
							onOpenChange(false);
							onEnabled();
						}}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

/** Password-gated "Disable" confirmation. */
function DisableTwoFactorDialog({
	onDisabled,
	onOpenChange,
	open,
}: {
	onDisabled: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (open) {
			setPassword("");
		}
	}, [open]);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="rounded-xl">
				<DialogHeader>
					<DialogTitle>Turn off two-factor authentication?</DialogTitle>
					<DialogDescription>
						Your account will only need a password to sign in. Confirm your
						password to continue.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor="tfa-disable-password">Current password</Label>
					<Input
						autoComplete="current-password"
						id="tfa-disable-password"
						onChange={(event) => setPassword(event.target.value)}
						type="password"
						value={password}
					/>
				</div>
				<DialogFooter>
					<Button
						disabled={!password || busy}
						onClick={async () => {
							setBusy(true);
							await authClient.twoFactor.disable(
								{ password },
								{
									onError: (error) => {
										toast.error(error.error.message || error.error.statusText);
									},
									onSuccess: () => {
										onOpenChange(false);
										onDisabled();
										toast.success("Two-factor authentication turned off");
									},
								}
							);
							setBusy(false);
						}}
						type="button"
						variant="destructive"
					>
						{busy ? "Turning off…" : "Turn off"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Password-gated "Regenerate backup codes", then shows the new codes once. */
function RegenerateBackupCodesDialog({
	onOpenChange,
	open,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const [password, setPassword] = useState("");
	const [codes, setCodes] = useState<string[] | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (open) {
			setPassword("");
			setCodes(null);
		}
	}, [open]);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="rounded-xl">
				<DialogHeader>
					<DialogTitle>Regenerate backup codes</DialogTitle>
					<DialogDescription>
						{codes
							? "Your old codes no longer work. Save these new ones."
							: "Confirm your password. Your current backup codes will stop working."}
					</DialogDescription>
				</DialogHeader>
				{codes ? (
					<BackupCodesStep codes={codes} onDone={() => onOpenChange(false)} />
				) : (
					<>
						<div className="space-y-2">
							<Label htmlFor="tfa-regen-password">Current password</Label>
							<Input
								autoComplete="current-password"
								id="tfa-regen-password"
								onChange={(event) => setPassword(event.target.value)}
								type="password"
								value={password}
							/>
						</div>
						<DialogFooter>
							<Button
								disabled={!password || busy}
								onClick={async () => {
									setBusy(true);
									await authClient.twoFactor.generateBackupCodes(
										{ password },
										{
											onError: (error) => {
												toast.error(
													error.error.message || error.error.statusText
												);
											},
											onSuccess: (context) => {
												const data = context.data as {
													backupCodes?: string[];
												};
												setCodes(data.backupCodes ?? []);
											},
										}
									);
									setBusy(false);
								}}
								type="button"
							>
								{busy ? "Generating…" : "Regenerate"}
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

/** Settings → Account → Two-factor authentication: status, enable/disable, and backup codes. */
export default function AccountTwoFactorCard() {
	const { data: session, refetch } = authClient.useSession();
	const [enableOpen, setEnableOpen] = useState(false);
	const [disableOpen, setDisableOpen] = useState(false);
	const [regenerateOpen, setRegenerateOpen] = useState(false);

	const enabled = Boolean(session?.user.twoFactorEnabled);

	return (
		<Card className="rounded-xl">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<ShieldCheckIcon className="size-4" />
					Two-factor authentication
					{enabled ? (
						<Badge variant="secondary">Enabled</Badge>
					) : (
						<Badge variant="outline">Recommended</Badge>
					)}
				</CardTitle>
				<CardDescription>
					A second step at sign-in, on top of your password, using a free
					authenticator app on your phone (like Google Authenticator or
					1Password). It's optional, but strongly recommended — it stops someone
					from getting in even if they learn your password.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-wrap gap-2">
				{enabled ? (
					<>
						<Button
							onClick={() => setRegenerateOpen(true)}
							type="button"
							variant="outline"
						>
							Regenerate backup codes
						</Button>
						<Button
							onClick={() => setDisableOpen(true)}
							type="button"
							variant="outline"
						>
							Turn off
						</Button>
					</>
				) : (
					<Button onClick={() => setEnableOpen(true)} type="button">
						Turn on two-factor authentication
					</Button>
				)}
			</CardContent>

			<EnableTwoFactorDialog
				onEnabled={() => refetch()}
				onOpenChange={setEnableOpen}
				open={enableOpen}
			/>
			<DisableTwoFactorDialog
				onDisabled={() => refetch()}
				onOpenChange={setDisableOpen}
				open={disableOpen}
			/>
			<RegenerateBackupCodesDialog
				onOpenChange={setRegenerateOpen}
				open={regenerateOpen}
			/>
		</Card>
	);
}
