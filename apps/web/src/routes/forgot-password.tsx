import { Button } from "@StryveForms/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import AuthShell from "@/components/app/auth/auth-shell";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/forgot-password")({
	component: RouteComponent,
});

function RouteComponent() {
	const [sent, setSent] = useState(false);

	const form = useForm({
		defaultValues: { email: "" },
		onSubmit: async ({ value }) => {
			await authClient.requestPasswordReset(
				{
					email: value.email,
					redirectTo: "/reset-password",
				},
				{
					onSuccess: () => setSent(true),
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				}
			);
		},
		validators: {
			onSubmit: z.object({ email: z.email("Invalid email address") }),
		},
	});

	return (
		<AuthShell showHero={false}>
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Reset your password</CardTitle>
					<CardDescription>
						Enter your email and we'll send you a link to reset your password.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{sent ? (
						<p className="rounded-lg border border-border bg-muted p-4 text-center text-sm">
							Check your inbox for a reset link.
						</p>
					) : (
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
											autoComplete="email"
											id={field.name}
											name={field.name}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											type="email"
											value={field.state.value}
										/>
										{field.state.meta.errors.map((error) => (
											<p className="text-red-500 text-sm" key={error?.message}>
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
										{isSubmitting ? "Sending…" : "Send reset link"}
									</Button>
								)}
							</form.Subscribe>
						</form>
					)}

					<p className="text-center text-muted-foreground text-sm">
						<Link className="text-foreground underline" to="/login">
							Back to sign in
						</Link>
					</p>
				</CardContent>
			</Card>
		</AuthShell>
	);
}
