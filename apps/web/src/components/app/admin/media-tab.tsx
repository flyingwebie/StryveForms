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
import { Switch } from "@StryveForms/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { formatTrpcError } from "@/lib/format-trpc-error";
import { useTRPC } from "@/utils/trpc";

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

	return (
		<div className="max-w-2xl space-y-6">
			<Card className="rounded-xl">
				<CardHeader>
					<CardTitle>Unsplash</CardTitle>
					<CardDescription>
						Lets anyone in this instance search Unsplash's free photo library
						from the image picker (page images, headers, backgrounds…). The key
						never reaches the browser — every Unsplash call is proxied through
						this server.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
						<span className="space-y-0.5">
							<Label className="text-sm">Enable Unsplash</Label>
							<p className="text-muted-foreground text-xs">
								Turns the Unsplash tab on or off for every workspace. Needs a
								saved Access Key below to actually work.
							</p>
						</span>
						<Switch
							aria-label="Enable Unsplash"
							checked={settings.data.enabled}
							disabled={save.isPending}
							onCheckedChange={(enabled) => save.mutate({ enabled })}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="unsplash-access-key">
							Access Key
							{settings.data.hasKey
								? ` (currently ${settings.data.lastFour ?? "saved"})`
								: ""}
						</Label>
						<Input
							id="unsplash-access-key"
							onChange={(e) => setAccessKey(e.target.value)}
							placeholder={
								settings.data.hasKey
									? "Leave blank to keep the current key"
									: "Paste your Unsplash Access Key"
							}
							type="password"
							value={accessKey}
						/>
						<p className="text-muted-foreground text-xs">
							Demo keys are limited to 50 requests/hour — plenty for trying this
							out, but apply to Unsplash for a higher ("Production") limit once
							real users will search regularly. See the how-to below.
						</p>
					</div>

					{testResult ? (
						<p
							className={
								testResult.ok
									? "text-green-600 text-sm dark:text-green-400"
									: "text-destructive text-sm"
							}
						>
							{testResult.message}
						</p>
					) : null}

					<div className="flex flex-wrap gap-2">
						<Button
							disabled={
								save.isPending || !(accessKey.trim() || settings.data.hasKey)
							}
							onClick={() =>
								save.mutate({
									accessKey: accessKey.trim() || undefined,
								})
							}
						>
							{save.isPending ? "Saving…" : "Save key"}
						</Button>
						<Button
							disabled={
								test.isPending || !(accessKey.trim() || settings.data.hasKey)
							}
							onClick={() =>
								test.mutate({ accessKey: accessKey.trim() || undefined })
							}
							variant="outline"
						>
							{test.isPending ? "Testing…" : "Test key"}
						</Button>
						{settings.data.hasKey ? (
							<Button
								disabled={remove.isPending}
								onClick={() => remove.mutate()}
								variant="ghost"
							>
								Remove key
							</Button>
						) : null}
					</div>
				</CardContent>
			</Card>

			<Card className="rounded-xl">
				<CardHeader>
					<CardTitle>How to get a key</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-muted-foreground text-sm">
					<ol className="list-decimal space-y-2 pl-4">
						<li>
							Go to{" "}
							<a
								className="underline underline-offset-2 hover:text-foreground"
								href="https://unsplash.com/oauth/applications"
								rel="noopener"
								target="_blank"
							>
								unsplash.com/oauth/applications
							</a>{" "}
							and sign in (or create a free account).
						</li>
						<li>
							Click "New Application", accept the API guidelines, and name it.
						</li>
						<li>
							Copy the app's <span className="font-medium">Access Key</span>{" "}
							(not the Secret Key) and paste it above.
						</li>
						<li>
							New apps start in <span className="font-medium">Demo</span> mode:
							50 requests/hour, enough for testing. When this instance is live
							for real users, apply for{" "}
							<span className="font-medium">Production</span> status from the
							same app page — Unsplash reviews it (screenshots of attribution in
							use help) and raises the limit once approved. There's no fixed
							published number for the raised limit; Unsplash decides case by
							case.
						</li>
						<li>
							Attribution is handled automatically: every photo the picker
							inserts credits the photographer and Unsplash, as Unsplash's API
							guidelines require. You don't need to do anything extra.
						</li>
					</ol>
					<p className="pt-2">
						Unsplash+ (Premium) photos aren't reachable through this API at all
						— see the <span className="font-medium">Unsplash research</span>{" "}
						section of{" "}
						<code className="rounded bg-muted px-1 py-0.5 text-xs">
							apps/web/src/components/app/media/README.md
						</code>{" "}
						for the full explanation and sources. The picker's "Premium" filter
						says so and links to unsplash.com/plus instead of pretending to
						search it.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
