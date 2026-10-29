import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon, KeyRoundIcon, MailCheckIcon } from "lucide-react";
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
	const [sentEmail, setSentEmail] = useState("");

	const form = useForm({
		defaultValues: { email: "" },
		onSubmit: async ({ value }) => {
			await authClient.requestPasswordReset(
				{
					email: value.email,
					redirectTo: "/reset-password",
				},
				{
					onSuccess: () => {
						setSentEmail(value.email);
						setSent(true);
					},
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
			<div className="w-full rounded-2xl border bg-card p-6 text-card-foreground shadow-black/5 shadow-xl sm:p-8 dark:shadow-black/40">
				{sent ? (
					<div className="space-y-6 text-center">
						<span className="inline-flex size-12 items-center justify-center rounded-xl bg-success-soft text-success">
							<MailCheckIcon className="size-6" />
						</span>
						<div className="space-y-1">
							<h1 className="font-semibold text-xl tracking-tight">
								Check your inbox
							</h1>
							<p className="text-muted-foreground text-sm">
								We've sent a password reset link to {sentEmail}. The link
								expires in 1 hour.
							</p>
						</div>
						<Button
							className="w-full"
							render={<Link to="/login" />}
							variant="outline"
						>
							<ArrowLeftIcon /> Back to sign in
						</Button>
					</div>
				) : (
					<div className="space-y-6">
						<div className="space-y-4 text-center">
							<span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
								<KeyRoundIcon className="size-6" />
							</span>
							<div className="space-y-1">
								<h1 className="font-semibold text-xl tracking-tight">
									Forgot your password?
								</h1>
								<p className="text-muted-foreground text-sm">
									Enter your email and we'll send you a link to reset it.
								</p>
							</div>
						</div>
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
											placeholder="you@company.com"
											type="email"
											value={field.state.value}
										/>
										{field.state.meta.errors.map((error) => (
											<p
												className="text-destructive text-sm"
												key={error?.message}
											>
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

						<p className="text-center text-sm">
							<Link className="text-primary hover:underline" to="/login">
								← Back to sign in
							</Link>
						</p>
					</div>
				)}
			</div>
		</AuthShell>
	);
}
