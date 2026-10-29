import { Button } from "@StryveForms/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import InstanceLogo from "@/components/app/instance-logo";
import { authClient } from "@/lib/auth-client";

const NON_CODE_CHARS = /[^A-Za-z0-9]/g;

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
	const [code, setCode] = useState(initialCode ?? "");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		const formatted = code.trim().replace(NON_CODE_CHARS, "").toUpperCase();
		if (!formatted) {
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
		<div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
			<Card className="w-full max-w-sm rounded-xl">
				<CardHeader className="items-center text-center">
					<InstanceLogo showName={false} />
					<CardTitle className="text-xl">Connect a device</CardTitle>
					<CardDescription>
						Enter the code shown in your terminal or TV to connect it to your
						account.
					</CardDescription>
				</CardHeader>
				<form onSubmit={handleSubmit}>
					<CardContent className="space-y-2">
						<Label htmlFor="device-code">Device code</Label>
						<Input
							autoFocus
							id="device-code"
							onChange={(event) => setCode(event.target.value)}
							placeholder="ABCD-1234"
							value={code}
						/>
						{error ? <p className="text-destructive text-sm">{error}</p> : null}
					</CardContent>
					<CardFooter>
						<Button className="w-full" disabled={loading} type="submit">
							{loading ? "Checking…" : "Continue"}
						</Button>
					</CardFooter>
				</form>
			</Card>
		</div>
	);
}
