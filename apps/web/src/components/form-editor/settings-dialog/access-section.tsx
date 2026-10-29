import { CAPTCHA_PROVIDERS } from "@StryveForms/forms/settings";
import { Button } from "@StryveForms/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import {
	Field,
	FieldDescription,
	FieldLabel,
	FieldSet,
} from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@StryveForms/ui/components/native-select";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";
import { useEditor } from "../state/editor-context";

function isoToLocalInput(iso: string | null): string {
	if (!iso) {
		return "";
	}
	const date = new Date(iso);
	return Number.isNaN(date.getTime())
		? ""
		: new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
				.toISOString()
				.slice(0, 16);
}

function PasswordField() {
	const { meta } = useEditor();
	const trpc = useTRPC();
	const [password, setPassword] = useState("");
	const setPasswordMutation = useMutation(
		trpc.form.setPassword.mutationOptions({
			onError: (error) =>
				toast.error("Couldn't update the password", {
					description: error.message,
				}),
			onSuccess: () => {
				toast.success(password ? "Password set" : "Password removed");
				setPassword("");
			},
		})
	);

	return (
		<Field>
			<FieldLabel htmlFor="form-password">Password protection</FieldLabel>
			<div className="flex gap-2">
				<Input
					id="form-password"
					onChange={(e) => setPassword(e.target.value)}
					placeholder={
						meta.hasPassword ? "Set a new password" : "No password set"
					}
					type="password"
					value={password}
				/>
				<Button
					disabled={setPasswordMutation.isPending || !password}
					onClick={() => setPasswordMutation.mutate({ id: meta.id, password })}
					size="sm"
					type="button"
					variant="outline"
				>
					Set
				</Button>
				{meta.hasPassword ? (
					<Button
						disabled={setPasswordMutation.isPending}
						onClick={() =>
							setPasswordMutation.mutate({ id: meta.id, password: null })
						}
						size="sm"
						type="button"
						variant="ghost"
					>
						Remove
					</Button>
				) : null}
			</div>
			<FieldDescription>
				When set, respondents must enter this password before they can see the
				form.
			</FieldDescription>
		</Field>
	);
}

export function AccessSection() {
	const { patch, readOnly, state } = useEditor();
	const { settings } = state;

	return (
		<fieldset className="flex flex-col gap-5" disabled={readOnly}>
			<Card>
				<CardHeader>
					<CardTitle>Access</CardTitle>
					<CardDescription>
						Control who can open this form, and for how long.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<PasswordField />
					<Field>
						<FieldLabel htmlFor="closes-at">Close the form on</FieldLabel>
						<Input
							id="closes-at"
							onChange={(e) =>
								patch({
									closesAt: e.target.value
										? new Date(e.target.value).toISOString()
										: null,
								})
							}
							type="datetime-local"
							value={isoToLocalInput(settings.closesAt)}
						/>
						<FieldDescription>
							After this date and time, the form stops accepting new submissions
							automatically. Leave blank to never close it on a schedule.
						</FieldDescription>
					</Field>
					{settings.closesAt ? (
						<Field>
							<FieldLabel htmlFor="closed-text">
								Message shown once closed
							</FieldLabel>
							<Input
								id="closed-text"
								onChange={(e) => patch({ closedText: e.target.value })}
								value={settings.closedText ?? ""}
							/>
							<FieldDescription>
								Replaces the form with this message once the close date above
								has passed.
							</FieldDescription>
						</Field>
					) : null}
					<FieldSet className="grid grid-cols-2 gap-2">
						<Field>
							<FieldLabel htmlFor="max-submissions">Max submissions</FieldLabel>
							<Input
								id="max-submissions"
								onChange={(e) =>
									patch({
										maxSubmissionsCount: e.target.value
											? Number(e.target.value)
											: null,
									})
								}
								type="number"
								value={settings.maxSubmissionsCount ?? ""}
							/>
						</Field>
					</FieldSet>
					<FieldDescription>
						Stops accepting submissions once this many have been received. Leave
						blank for no limit.
					</FieldDescription>
					{settings.maxSubmissionsCount ? (
						<Field>
							<FieldLabel htmlFor="max-submissions-text">
								Message once the limit is reached
							</FieldLabel>
							<Input
								id="max-submissions-text"
								onChange={(e) =>
									patch({ maxSubmissionsReachedText: e.target.value })
								}
								value={settings.maxSubmissionsReachedText ?? ""}
							/>
							<FieldDescription>
								Replaces the form with this message once the submission limit
								above is reached.
							</FieldDescription>
						</Field>
					) : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Spam protection</CardTitle>
					<CardDescription>
						Keep bots from flooding your form with fake submissions.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Field orientation="horizontal">
						<Checkbox
							checked={settings.useCaptcha}
							id="use-captcha"
							onCheckedChange={(checked) =>
								patch({ useCaptcha: checked === true })
							}
						/>
						<div className="flex flex-col">
							<FieldLabel htmlFor="use-captcha">Require a captcha</FieldLabel>
							<FieldDescription>
								Adds a human-verification challenge before the final submit
								button.
							</FieldDescription>
						</div>
					</Field>
					{settings.useCaptcha ? (
						<Field>
							<FieldLabel htmlFor="captcha-provider">Provider</FieldLabel>
							<NativeSelect
								id="captcha-provider"
								onChange={(e) =>
									patch({
										captchaProvider: e.target
											.value as (typeof CAPTCHA_PROVIDERS)[number],
									})
								}
								value={settings.captchaProvider}
							>
								{CAPTCHA_PROVIDERS.map((provider) => (
									<NativeSelectOption key={provider} value={provider}>
										{provider}
									</NativeSelectOption>
								))}
							</NativeSelect>
							<FieldDescription>
								Which captcha service verifies respondents. Requires that
								service's site key to be configured for this instance.
							</FieldDescription>
						</Field>
					) : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Search visibility</CardTitle>
				</CardHeader>
				<CardContent>
					<Field orientation="horizontal">
						<Checkbox
							checked={settings.canBeIndexed}
							id="can-be-indexed"
							onCheckedChange={(checked) =>
								patch({ canBeIndexed: checked === true })
							}
						/>
						<div className="flex flex-col">
							<FieldLabel htmlFor="can-be-indexed">
								Allow search engines to index this form
							</FieldLabel>
							<FieldDescription>
								When off, a "noindex" tag asks Google and other search engines
								to leave this page out of their results.
							</FieldDescription>
						</div>
					</Field>
				</CardContent>
			</Card>
		</fieldset>
	);
}
