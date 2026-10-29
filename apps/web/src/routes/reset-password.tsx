import { Button } from "@StryveForms/ui/components/button";
import { Label } from "@StryveForms/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangleIcon, LockIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import AuthShell from "@/components/app/auth/auth-shell";
import PasswordInput from "@/components/app/auth/password-input";
import { authClient } from "@/lib/auth-client";

const searchSchema = z.object({
	token: z.string().optional(),
	error: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
	component: RouteComponent,
	validateSearch: searchSchema,
});

function RouteComponent() {
	const { token, error } = Route.useSearch();
	const navigate = useNavigate();

	const form = useForm({
		defaultValues: { password: "", confirmPassword: "" },
		onSubmit: async ({ value }) => {
			if (!token) {
				toast.error("This reset link is invalid.");
				return;
			}
			await authClient.resetPassword(
				{ newPassword: value.password, token },
				{
					onSuccess: () => {
						toast.success("Password updated. Sign in with your new password.");
						navigate({ to: "/login" });
					},
					onError: (resetError) => {
						toast.error(
							resetError.error.message || resetError.error.statusText
						);
					},
				}
			);
		},
		validators: {
			onSubmit: z
				.object({
					password: z.string().min(8, "Password must be at least 8 characters"),
					confirmPassword: z.string(),
				})
				.refine((value) => value.password === value.confirmPassword, {
					message: "Passwords don't match",
					path: ["confirmPassword"],
				}),
		},
	});

	const invalid = Boolean(error) || !token;

	return (
		<AuthShell showHero={false}>
			<div className="w-full rounded-2xl border bg-card p-6 text-card-foreground shadow-black/5 shadow-xl sm:p-8 dark:shadow-black/40">
				{invalid ? (
					<div className="space-y-6 text-center">
						<span className="inline-flex size-12 items-center justify-center rounded-xl bg-destructive-soft text-destructive">
							<AlertTriangleIcon className="size-6" />
						</span>
						<div className="space-y-1">
							<h1 className="font-semibold text-xl tracking-tight">
								This link has expired
							</h1>
							<p className="text-muted-foreground text-sm">
								Password reset links expire after 1 hour. Request a new one to
								continue.
							</p>
						</div>
						<Button className="w-full" render={<Link to="/forgot-password" />}>
							Request a new one
						</Button>
					</div>
				) : (
					<div className="space-y-6">
						<div className="space-y-4 text-center">
							<span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
								<LockIcon className="size-6" />
							</span>
							<div className="space-y-1">
								<h1 className="font-semibold text-xl tracking-tight">
									Set a new password
								</h1>
								<p className="text-muted-foreground text-sm">
									Choose a strong password you haven't used before.
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
							<form.Field name="password">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>New password</Label>
										<PasswordInput
											autoComplete="new-password"
											id={field.name}
											name={field.name}
											onBlur={field.handleBlur}
											onChange={field.handleChange}
											value={field.state.value}
										/>
										{field.state.meta.errors.length > 0 ? (
											field.state.meta.errors.map((fieldError) => (
												<p
													className="text-destructive text-sm"
													key={fieldError?.message}
												>
													{fieldError?.message}
												</p>
											))
										) : (
											<p className="text-subtle-foreground text-xs">
												At least 8 characters
											</p>
										)}
									</div>
								)}
							</form.Field>

							<form.Field name="confirmPassword">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>Confirm password</Label>
										<PasswordInput
											autoComplete="new-password"
											id={field.name}
											name={field.name}
											onBlur={field.handleBlur}
											onChange={field.handleChange}
											value={field.state.value}
										/>
										{field.state.meta.errors.map((fieldError) => (
											<p
												className="text-destructive text-sm"
												key={fieldError?.message}
											>
												{fieldError?.message}
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
										{isSubmitting ? "Updating…" : "Update password"}
									</Button>
								)}
							</form.Subscribe>
						</form>
					</div>
				)}
			</div>
		</AuthShell>
	);
}
