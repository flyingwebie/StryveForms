import { Button } from "@StryveForms/ui/components/button";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "@StryveForms/ui/components/input-otp";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { SmartphoneIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import AuthShell from "@/components/app/auth/auth-shell";
import { authClient } from "@/lib/auth-client";

const NON_CODE_CHARS = /[^A-Za-z0-9]/g;
const FIRST_GROUP = [0, 1, 2, 3];
const SECOND_GROUP = [4, 5, 6, 7];

const searchSchema = z.object({ user_code: z.string().optional() });

/**
 * Device authorization entry point — the page a CLI (`stryveforms login`)
 * sends the user to. They type (or arrive with, via a QR/complete URL) the
 * short code shown in their terminal; this claims the pending device code
 * for the signed-in session, then hands off to the approve/deny screen.
 */
export const Route = createFileRoute("/device")({
	component: RouteComponent,
	ssr: false,
	validateSearch: searchSchema,
	beforeLoad: async ({ search }) => {
		const session = await authClient.getSession();
		if (!session.data) {
			const here = search.user_code
				? `/device?user_code=${encodeURIComponent(search.user_code)}`
				: "/device";
			throw redirect({ search: { redirect: here }, to: "/login" });
		}
	},
});

function RouteComponent() {
	const { user_code: initialCode } = Route.useSearch();
	const navigate = useNavigate();
	const [code, setCode] = useState((initialCode ?? "").toUpperCase());
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		const formatted = code.trim().replace(NON_CODE_CHARS, "").toUpperCase();
		if (formatted.length < 8) {
			setError("Enter the code shown in your terminal.");
			return;
		}
		setLoading(true);
		setError(null);
		const { error: verifyError } = await authClient.device({
			query: { user_code: formatted },
		});
		setLoading(false);
		if (verifyError) {
			setError(
				verifyError.error_description ??
					"That code is invalid or has expired. Check your terminal and try again."
			);
			return;
		}
		navigate({
			search: { user_code: formatted },
			to: "/device/approve",
		});
	}

	return (
		<AuthShell showHero={false}>
			<div className="w-full rounded-2xl border bg-card p-6 text-card-foreground shadow-black/5 shadow-xl sm:p-8 dark:shadow-black/40">
				<form className="space-y-6 text-center" onSubmit={handleSubmit}>
					<div className="space-y-4">
						<span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
							<SmartphoneIcon className="size-6" />
						</span>
						<div className="space-y-1">
							<h1 className="font-semibold text-xl tracking-tight">
								Connect a device
							</h1>
							<p className="text-muted-foreground text-sm">
								Enter the code shown on your TV, CLI, or device screen.
							</p>
						</div>
					</div>

					<div className="flex justify-center">
						<InputOTP
							autoFocus
							maxLength={8}
							onChange={(value) => setCode(value.toUpperCase())}
							value={code}
						>
							<InputOTPGroup>
								{FIRST_GROUP.map((i) => (
									<InputOTPSlot
										className="size-11 text-base"
										index={i}
										key={i}
									/>
								))}
							</InputOTPGroup>
							<InputOTPSeparator />
							<InputOTPGroup>
								{SECOND_GROUP.map((i) => (
									<InputOTPSlot
										className="size-11 text-base"
										index={i}
										key={i}
									/>
								))}
							</InputOTPGroup>
						</InputOTP>
					</div>

					{error ? <p className="text-destructive text-sm">{error}</p> : null}

					<Button className="w-full" disabled={loading} type="submit">
						{loading ? "Checking…" : "Continue"}
					</Button>
				</form>
			</div>
		</AuthShell>
	);
}
