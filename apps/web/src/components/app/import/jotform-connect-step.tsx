import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { useMutation } from "@tanstack/react-query";
import { ExternalLinkIcon, KeyRoundIcon, ShieldCheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { type RouterOutputs, useTRPC } from "@/utils/trpc";

export type JotformConnection = RouterOutputs["importer"]["jotform"]["connect"];

type Region = "auto" | "us" | "eu" | "hipaa" | "enterprise";

const REGIONS: { label: string; value: Region }[] = [
	{ label: "Detect automatically", value: "auto" },
	{ label: "United States (jotform.com)", value: "us" },
	{ label: "Europe (eu.jotform.com)", value: "eu" },
	{ label: "HIPAA (hipaa.jotform.com)", value: "hipaa" },
	{ label: "Enterprise (own domain)", value: "enterprise" },
];

const API_PAGES: Record<Region, string> = {
	auto: "https://www.jotform.com/myaccount/api",
	enterprise: "https://www.jotform.com/myaccount/api",
	eu: "https://eu.jotform.com/myaccount/api",
	hipaa: "https://hipaa.jotform.com/myaccount/api",
	us: "https://www.jotform.com/myaccount/api",
};

export default function JotformConnectStep({
	onConnected,
}: {
	onConnected: (connection: JotformConnection) => void;
}) {
	const trpc = useTRPC();
	const [apiKey, setApiKey] = useState("");
	const [region, setRegion] = useState<Region>("auto");
	const [enterpriseUrl, setEnterpriseUrl] = useState("");

	const connect = useMutation(
		trpc.importer.jotform.connect.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: (data) => {
				toast.success(`Connected to ${data.account.name}'s JotForm account`);
				onConnected(data);
			},
		})
	);

	const canConnect =
		apiKey.trim().length >= 16 &&
		(region !== "enterprise" || enterpriseUrl.trim().length > 0);

	const submit = () => {
		connect.mutate({
			apiKey: apiKey.trim(),
			endpoint:
				region === "enterprise" ? { url: enterpriseUrl.trim() } : region,
		});
	};

	return (
		<div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
			<form
				className="space-y-5 rounded-2xl border bg-card p-6"
				onSubmit={(event) => {
					event.preventDefault();
					if (canConnect) {
						submit();
					}
				}}
			>
				<div>
					<h2 className="font-semibold text-lg">
						Connect your JotForm account
					</h2>
					<p className="text-muted-foreground text-sm">
						StryveForms reads your forms and submissions with an API key. It
						never changes anything in JotForm.
					</p>
				</div>

				<div className="space-y-2">
					<Label htmlFor="jotform-api-key">API key</Label>
					<div className="relative">
						<KeyRoundIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							autoComplete="off"
							className="pl-9 font-mono"
							id="jotform-api-key"
							onChange={(event) => setApiKey(event.target.value)}
							placeholder="Paste your JotForm API key"
							spellCheck={false}
							type="password"
							value={apiKey}
						/>
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="jotform-region">Where is your account?</Label>
					<Select
						items={REGIONS}
						onValueChange={(value) =>
							setRegion(value ? (value as Region) : "auto")
						}
						value={region}
					>
						<SelectTrigger className="w-full" id="jotform-region">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{REGIONS.map((r) => (
								<SelectItem key={r.value} value={r.value}>
									{r.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{region === "enterprise" ? (
					<div className="space-y-2">
						<Label htmlFor="jotform-enterprise-url">Your JotForm address</Label>
						<Input
							id="jotform-enterprise-url"
							onChange={(event) => setEnterpriseUrl(event.target.value)}
							placeholder="https://forms.yourcompany.com"
							type="url"
							value={enterpriseUrl}
						/>
						<p className="text-muted-foreground text-xs">
							We'll use its API at /API, like JotForm does.
						</p>
					</div>
				) : null}

				<Button
					className="w-full"
					disabled={!canConnect || connect.isPending}
					type="submit"
				>
					{connect.isPending ? "Connecting…" : "Connect and list my forms"}
				</Button>

				<p className="flex items-start gap-2 text-muted-foreground text-xs">
					<ShieldCheckIcon className="mt-px size-3.5 shrink-0" />
					Your key stays in memory for this import only (at most 2 hours) and is
					never saved.
				</p>
			</form>

			<aside className="space-y-3 rounded-2xl border border-dashed p-5 text-sm">
				<h3 className="font-medium">Where to find your key</h3>
				<ol className="list-decimal space-y-2 pl-4 text-muted-foreground">
					<li>Sign in to JotForm and open Settings → API.</li>
					<li>
						Click <strong className="text-foreground">Create new key</strong>{" "}
						and give it <strong className="text-foreground">Read access</strong>
						.
					</li>
					<li>Copy the key and paste it here.</li>
				</ol>
				<a
					className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
					href={API_PAGES[region]}
					rel="noopener noreferrer"
					target="_blank"
				>
					Open JotForm API settings <ExternalLinkIcon className="size-3.5" />
				</a>
				<p className="text-muted-foreground text-xs">
					Free JotForm accounts can make 1,000 API calls a day. The review step
					shows how many this import needs.
				</p>
			</aside>
		</div>
	);
}
