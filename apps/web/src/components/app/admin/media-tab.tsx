import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Switch } from "@StryveForms/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { formatTrpcError } from "@/lib/format-trpc-error";
import { useTRPC } from "@/utils/trpc";

import { SettingsRow, SettingsSection } from "./settings-row";

const STEPS = [
	"Create a free Unsplash developer account",
	"Create a new application in the Unsplash dashboard",
	"Copy the Access Key from your application",
	"Paste it above and select Save",
];

/**
 * Admin → "Images & Unsplash": the instance-wide Unsplash Access Key (used
 * by every workspace's `ImagePicker`), a Test key button, and an enable
 * toggle independent of whether a key is saved. The key is encrypted at
 * rest (services/media/settings.ts) and never sent back to the browser —
 * only a masked "•••• last4" hint is shown once saved, same pattern as
 * Settings → AI assistant's provider key field.
 */
export default function AdminMediaTab() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const settings = useQuery(trpc.media.admin.get.queryOptions());
	const [accessKey, setAccessKey] = useState("");
	const [reveal, setReveal] = useState(false);
	const [testResult, setTestResult] = useState<{
		message: string;
		ok: boolean;
	} | null>(null);

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.media.admin.get.queryKey(),
		});

	const save = useMutation(
		trpc.media.admin.save.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await invalidate();
				setAccessKey("");
				setTestResult(null);
				toast.success("Unsplash settings saved");
			},
		})
	);
	const remove = useMutation(
		trpc.media.admin.remove.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await invalidate();
				setAccessKey("");
				setTestResult(null);
				toast.success("Unsplash key removed");
			},
		})
	);
	const test = useMutation(
		trpc.media.admin.test.mutationOptions({
			onError: (error) =>
				setTestResult({ message: formatTrpcError(error), ok: false }),
			onSuccess: (data) => setTestResult(data),
		})
	);

	if (!settings.data) {
		return null;
	}

	const hasValue = accessKey.trim() || settings.data.hasKey;

	return (
		<div className="space-y-8 pb-20">
			<div>
				<SettingsRow
					description="Adds an Unsplash search tab to the image picker."
					label="Enable Unsplash"
				>
					<Switch
						aria-label="Enable Unsplash"
						checked={settings.data.enabled}
						disabled={save.isPending}
						onCheckedChange={(enabled) => save.mutate({ enabled })}
					/>
				</SettingsRow>

				<SettingsRow
					description="Your Unsplash API access key."
					htmlFor="unsplash-access-key"
					label="Access key"
				>
					<div className="relative">
						<Input
							className="pr-9"
							id="unsplash-access-key"
							onChange={(e) => setAccessKey(e.target.value)}
							placeholder={
								settings.data.hasKey
									? `Leave blank to keep the current key${settings.data.lastFour ? ` (•••• ${settings.data.lastFour})` : ""}`
									: "Paste your Unsplash Access Key"
							}
							type={reveal ? "text" : "password"}
							value={accessKey}
						/>
						<button
							aria-label={reveal ? "Hide key" : "Show key"}
							className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							onClick={() => setReveal((v) => !v)}
							type="button"
						>
							{reveal ? (
								<EyeOffIcon className="size-4" />
							) : (
								<EyeIcon className="size-4" />
							)}
						</button>
					</div>
					{testResult ? (
						<p
							className={
								testResult.ok
									? "text-sm text-success"
									: "text-destructive text-sm"
							}
						>
							{testResult.message}
						</p>
					) : null}
					<div className="flex flex-wrap gap-2 pt-1">
						<Button
							disabled={test.isPending || !hasValue}
							onClick={() =>
								test.mutate({ accessKey: accessKey.trim() || undefined })
							}
							variant="outline"
						>
							{test.isPending ? "Testing…" : "Test"}
						</Button>
						{settings.data.hasKey ? (
							<Button
								disabled={remove.isPending}
								onClick={() => remove.mutate()}
								variant="outline"
							>
								Remove
							</Button>
						) : null}
						<Button
							disabled={save.isPending || !hasValue}
							onClick={() =>
								save.mutate({ accessKey: accessKey.trim() || undefined })
							}
						>
							{save.isPending ? "Saving…" : "Save"}
						</Button>
					</div>
				</SettingsRow>
			</div>

			<SettingsSection title="How to get an access key">
				<ol className="space-y-2.5 text-sm">
					{STEPS.map((step, index) => (
						<li className="flex items-start gap-2.5" key={step}>
							<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-subtle-foreground text-xs">
								{index + 1}
							</span>
							{step}
						</li>
					))}
				</ol>
				<p className="pt-3 text-subtle-foreground text-xs">
					Start on{" "}
					<a
						className="underline underline-offset-2 hover:text-foreground"
						href="https://unsplash.com/oauth/applications"
						rel="noopener"
						target="_blank"
					>
						unsplash.com/oauth/applications
					</a>
					. New apps start in Demo mode (50 requests/hour, enough for testing);
					apply for Production status from the same app page once this instance
					is live for real users. Unsplash+ (Premium) photos aren't reachable
					through this API — the picker's "Premium" filter links to
					unsplash.com/plus instead of pretending to search it. Attribution is
					handled automatically.
				</p>
			</SettingsSection>
		</div>
	);
}
