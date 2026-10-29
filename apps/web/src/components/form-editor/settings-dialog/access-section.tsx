import { CAPTCHA_PROVIDERS } from "@StryveForms/forms/settings";
import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Switch } from "@StryveForms/ui/components/switch";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";
import { SegmentedControl } from "../design/segmented-control";
import { useEditor } from "../state/editor-context";
import { SettingsRow, SettingsSection } from "./settings-row";

const CAPTCHA_PROVIDER_LABELS: Record<
	(typeof CAPTCHA_PROVIDERS)[number],
	string
> = {
	hcaptcha: "hCaptcha",
	recaptcha: "reCAPTCHA",
	turnstile: "Turnstile",
};

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

function PasswordRow() {
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
		<SettingsRow
			description="Require a password to open the form."
			htmlFor="form-password"
			label="Password protect"
		>
			<div className="flex items-center gap-2">
				<Input
					id="form-password"
					onChange={(e) => setPassword(e.target.value)}
					placeholder={
						meta.hasPassword ? "Set a new password" : "No password set"
					}
					type="password"
					value={password}
				/>
				<Switch
					checked={meta.hasPassword}
					onCheckedChange={(checked) => {
						if (checked) {
							return;
						}
						setPasswordMutation.mutate({ id: meta.id, password: null });
					}}
				/>
			</div>
			{password ? (
				<Button
					disabled={setPasswordMutation.isPending}
					onClick={() => setPasswordMutation.mutate({ id: meta.id, password })}
					size="sm"
					type="button"
					variant="outline"
				>
					Set password
				</Button>
			) : null}
		</SettingsRow>
	);
}

export function AccessSection() {
	const { patch, readOnly, state } = useEditor();
	const { settings } = state;

	return (
		<fieldset className="flex flex-col gap-8" disabled={readOnly}>
			<SettingsSection title="Access & security">
				<PasswordRow />
				<SettingsRow
					description="Stop accepting responses after this date."
					htmlFor="closes-at"
					label="Close date"
				>
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
				</SettingsRow>
				{settings.closesAt ? (
					<SettingsRow htmlFor="closed-text" label="Close message">
						<Input
							id="closed-text"
							onChange={(e) => patch({ closedText: e.target.value })}
							value={settings.closedText ?? ""}
						/>
					</SettingsRow>
				) : null}
				<SettingsRow
					description="Stop accepting responses after this count."
					htmlFor="max-submissions"
					label="Max submissions"
				>
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
				</SettingsRow>
				{settings.maxSubmissionsCount ? (
					<SettingsRow
						htmlFor="max-submissions-text"
						label="Message once the limit is reached"
					>
						<Input
							id="max-submissions-text"
							onChange={(e) =>
								patch({ maxSubmissionsReachedText: e.target.value })
							}
							value={settings.maxSubmissionsReachedText ?? ""}
						/>
					</SettingsRow>
				) : null}
				<SettingsRow
					description="Protect against spam and bots."
					label="Captcha"
				>
					<div className="flex items-center justify-between gap-2">
						<Switch
							checked={settings.useCaptcha}
							id="use-captcha"
							onCheckedChange={(checked) => patch({ useCaptcha: checked })}
						/>
						{settings.useCaptcha ? (
							<SegmentedControl
								ariaLabel="Captcha provider"
								onChange={(provider) => patch({ captchaProvider: provider })}
								options={CAPTCHA_PROVIDERS.map((provider) => ({
									label: CAPTCHA_PROVIDER_LABELS[provider],
									value: provider,
								}))}
								value={settings.captchaProvider}
							/>
						) : null}
					</div>
				</SettingsRow>
				<SettingsRow
					description="Let Google and others index this form."
					label="Allow search engine indexing"
				>
					<div className="flex justify-end">
						<Switch
							checked={settings.canBeIndexed}
							id="can-be-indexed"
							onCheckedChange={(checked) => patch({ canBeIndexed: checked })}
						/>
					</div>
				</SettingsRow>
			</SettingsSection>
		</fieldset>
	);
}
