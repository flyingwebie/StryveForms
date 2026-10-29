import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@StryveForms/ui/components/input-otp";
import { Label } from "@StryveForms/ui/components/label";
import { Switch } from "@StryveForms/ui/components/switch";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { FingerprintIcon, ShieldCheckIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import PasswordInput from "@/components/app/auth/password-input";
import { authClient } from "@/lib/auth-client";

const OTP_SLOTS = [0, 1, 2, 3, 4, 5];

/** The 6-digit authenticator-app / email-OTP code step, with a "use a backup code" fallback. */
function TwoFactorStep({
	availableMethods,
	redirectTo,
}: {
	availableMethods: string[];
	redirectTo: string;
}) {
	const navigate = useNavigate();
	const [code, setCode] = useState("");
	const [useBackupCode, setUseBackupCode] = useState(false);
	const [trustDevice, setTrustDevice] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const otpAvailable = availableMethods.includes("otp");

	async function submit() {
		setSubmitting(true);
		const onResult = {
			onError: (error: { error: { message?: string; statusText: string } }) => {
				toast.error(error.error.message || error.error.statusText);
			},
			onSuccess: () => {
				navigate({ to: redirectTo });
				toast.success("Signed in");
			},
		};
		if (useBackupCode) {
			await authClient.twoFactor.verifyBackupCode(
				{ code, trustDevice },
				onResult
			);
		} else {
			await authClient.twoFactor.verifyTotp({ code, trustDevice }, onResult);
		}
		setSubmitting(false);
	}

	return (
		<div className="space-y-5 text-center">
			<div className="flex flex-col items-center gap-4">
				<span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
					<ShieldCheckIcon className="size-6" />
				</span>
				<div className="space-y-1">
					<h2 className="font-semibold text-xl tracking-tight">
						Two-factor verification
					</h2>
					<p className="text-muted-foreground text-sm">
						{useBackupCode
							? "Enter one of your saved backup codes."
							: "Enter the 6-digit code from your authenticator app."}
					</p>
				</div>
			</div>

			{useBackupCode ? (
				<Input
					autoFocus
					className="text-center"
					onChange={(event) => setCode(event.target.value.trim())}
					placeholder="xxxxxxxx"
					value={code}
				/>
			) : (
				<div className="flex justify-center">
					<InputOTP maxLength={6} onChange={setCode} value={code}>
						<InputOTPGroup>
							{OTP_SLOTS.map((i) => (
								<InputOTPSlot className="size-11 text-base" index={i} key={i} />
							))}
						</InputOTPGroup>
					</InputOTP>
				</div>
			)}

			<Button
				className="w-full"
				disabled={submitting || (useBackupCode ? !code : code.length !== 6)}
				onClick={submit}
				type="button"
			>
				{submitting ? "Verifying…" : "Verify"}
			</Button>

			<label
				className="flex items-center justify-center gap-2 text-muted-foreground text-xs"
				htmlFor="trust-device"
			>
				<Switch
					checked={trustDevice}
					id="trust-device"
					onCheckedChange={setTrustDevice}
				/>
				Trust this device for 30 days
			</label>

			<div className="flex flex-col gap-2 text-sm">
				<button
					className="text-primary hover:underline"
					onClick={() => {
						setUseBackupCode((prev) => !prev);
						setCode("");
					}}
					type="button"
				>
					{useBackupCode
						? "Use my authenticator app instead"
						: "Use a backup code"}
				</button>
				{otpAvailable && !useBackupCode ? (
					<button
						className="text-primary hover:underline"
						onClick={async () => {
							const { error } = await authClient.twoFactor.sendOtp();
							if (error) {
								toast.error(error.message || "Couldn't send a code");
								return;
							}
							toast.success("Code sent");
						}}
						type="button"
					>
						Email me a code
					</button>
				) : null}
			</div>
		</div>
	);
}

/** "Sign in with a passkey" button, plus silent browser autofill (conditional UI) when supported. */
function PasskeySignIn({ redirectTo }: { redirectTo: string }) {
	const navigate = useNavigate();

	const handleResult = useCallback(
		(error: { message?: string; statusText?: string } | null) => {
			if (error) {
				// A cancelled/no-credential ceremony isn't worth surfacing as an error.
				return;
			}
			navigate({ to: redirectTo });
			toast.success("Signed in");
		},
		[navigate, redirectTo]
	);

	useEffect(() => {
		if (
			typeof window === "undefined" ||
			!("PublicKeyCredential" in window) ||
			!PublicKeyCredential.isConditionalMediationAvailable
		) {
			return;
		}
		let cancelled = false;
		async function tryAutofill() {
			const available =
				await PublicKeyCredential.isConditionalMediationAvailable?.();
			if (!(available && !cancelled)) {
				return;
			}
			const result = await authClient.signIn.passkey({ autoFill: true });
			if (!cancelled) {
				handleResult(result?.error ?? null);
			}
		}
		tryAutofill().catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [handleResult]);

	return (
		<Button
			className="w-full"
			onClick={async () => {
				const { error } = await authClient.signIn.passkey();
				handleResult(error ?? null);
			}}
			type="button"
			variant="outline"
		>
			<FingerprintIcon /> Sign in with a passkey
		</Button>
	);
}

export default function SignInForm({
	onTwoFactorActiveChange,
	redirectTo = "/dashboard",
}: {
	onTwoFactorActiveChange?: (active: boolean) => void;
	redirectTo?: string;
}) {
	const navigate = useNavigate();
	const [twoFactorMethods, setTwoFactorMethods] = useState<string[] | null>(
		null
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: only notify the parent when 2FA active state flips
	useEffect(() => {
		onTwoFactorActiveChange?.(twoFactorMethods !== null);
	}, [twoFactorMethods]);

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{
					email: value.email,
					password: value.password,
				},
				{
					onSuccess: (context) => {
						const data = context.data as {
							twoFactorMethods?: string[];
							twoFactorRedirect?: boolean;
						};
						if (data.twoFactorRedirect) {
							setTwoFactorMethods(data.twoFactorMethods ?? ["totp"]);
							return;
						}
						navigate({ to: redirectTo });
						toast.success("Signed in");
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				}
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	if (twoFactorMethods) {
		return (
			<TwoFactorStep
				availableMethods={twoFactorMethods}
				redirectTo={redirectTo}
			/>
		);
	}

	return (
		<div className="space-y-4">
			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="email">
					{(field) => (
						<div className="space-y-2">
							<Label htmlFor={field.name}>Email</Label>
							<Input
								autoComplete="email webauthn"
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="you@company.com"
								type="email"
								value={field.state.value}
							/>
							{field.state.meta.errors.map((error) => (
								<p className="text-destructive text-sm" key={error?.message}>
									{error?.message}
								</p>
							))}
						</div>
					)}
				</form.Field>

				<form.Field name="password">
					{(field) => (
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label htmlFor={field.name}>Password</Label>
								<Link
									className="text-muted-foreground text-xs hover:underline"
									to="/forgot-password"
								>
									Forgot password?
								</Link>
							</div>
							<PasswordInput
								autoComplete="current-password webauthn"
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={field.handleChange}
								value={field.state.value}
							/>
							{field.state.meta.errors.map((error) => (
								<p className="text-destructive text-sm" key={error?.message}>
									{error?.message}
								</p>
							))}
						</div>
					)}
				</form.Field>

				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{({ canSubmit, isSubmitting }) => (
						<Button
							className="w-full"
							disabled={!canSubmit || isSubmitting}
							type="submit"
						>
							{isSubmitting ? "Signing in…" : "Sign in"}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<div className="flex items-center gap-2 text-muted-foreground text-xs">
				<div className="h-px flex-1 bg-border" />
				or
				<div className="h-px flex-1 bg-border" />
			</div>

			<PasskeySignIn redirectTo={redirectTo} />
		</div>
	);
}
