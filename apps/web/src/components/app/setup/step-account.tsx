import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { z } from "zod";

import PasswordInput from "@/components/app/auth/password-input";
import { authClient } from "@/lib/auth-client";

/** Step 1: create the installation's first user, who becomes its admin. */
export default function SetupStepAccount({
	onBack,
	onDone,
}: {
	onBack: () => void;
	onDone: () => void;
}) {
	const form = useForm({
		defaultValues: { name: "", email: "", password: "" },
		onSubmit: async ({ value }) => {
			await authClient.signUp.email(
				{ email: value.email, name: value.name, password: value.password },
				{
					onSuccess: onDone,
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				}
			);
		},
		validators: {
			onSubmit: z.object({
				name: z.string().min(2, "Name must be at least 2 characters"),
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	return (
		<form
			className="space-y-4"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="name">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor={field.name}>Name</Label>
						<Input
							autoComplete="name"
							id={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
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
			<form.Field name="email">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor={field.name}>Email</Label>
						<Input
							autoComplete="email"
							id={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
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
						<Label htmlFor={field.name}>Password</Label>
						<PasswordInput
							autoComplete="new-password"
							id={field.name}
							onBlur={field.handleBlur}
							onChange={field.handleChange}
							value={field.state.value}
						/>
						{field.state.meta.errors.length > 0 ? (
							field.state.meta.errors.map((error) => (
								<p className="text-destructive text-sm" key={error?.message}>
									{error?.message}
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
			<div className="flex justify-between gap-2">
				<Button onClick={onBack} type="button" variant="outline">
					Back
				</Button>
				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{({ canSubmit, isSubmitting }) => (
						<Button disabled={!canSubmit || isSubmitting} type="submit">
							{isSubmitting ? "Creating account…" : "Continue"}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}
