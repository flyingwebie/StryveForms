import { Button } from "@StryveForms/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";

import AuthShell from "@/components/app/auth/auth-shell";
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
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Choose a new password</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{invalid ? (
						<p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-center text-destructive text-sm">
							This reset link is invalid or has expired.{" "}
							<Link className="underline" to="/forgot-password">
								Request a new one
							</Link>
							.
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
							<form.Field name="password">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>New password</Label>
										<Input
											autoComplete="new-password"
											id={field.name}
											name={field.name}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											type="password"
											value={field.state.value}
										/>
										{field.state.meta.errors.map((fieldError) => (
											<p
												className="text-red-500 text-sm"
												key={fieldError?.message}
											>
												{fieldError?.message}
											</p>
										))}
									</div>
								)}
							</form.Field>

							<form.Field name="confirmPassword">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>Confirm password</Label>
										<Input
											autoComplete="new-password"
											id={field.name}
											name={field.name}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											type="password"
											value={field.state.value}
										/>
										{field.state.meta.errors.map((fieldError) => (
											<p
												className="text-red-500 text-sm"
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
					)}
				</CardContent>
			</Card>
		</AuthShell>
	);
}
