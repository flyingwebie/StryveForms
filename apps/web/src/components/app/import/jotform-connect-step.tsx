import { Button } from "@StryveForms/ui/components/button";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
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
import {
	AlertTriangleIcon,
	CheckCircle2Icon,
	EyeIcon,
	EyeOffIcon,
	PlugIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { type RouterOutputs, useTRPC } from "@/utils/trpc";

import { SourceLogo } from "./source-picker";

export type JotformConnection = RouterOutputs["importer"]["jotform"]["connect"];

type Region = "auto" | "us" | "eu" | "hipaa" | "enterprise";

const REGIONS: { label: string; value: Region }[] = [
	{ label: "Detect automatically", value: "auto" },
	{ label: "United States (jotform.com)", value: "us" },
	{ label: "Europe (eu.jotform.com)", value: "eu" },
	{ label: "HIPAA (hipaa.jotform.com)", value: "hipaa" },
	{ label: "Enterprise — custom domain", value: "enterprise" },
];

const SCOPES = [
	{ description: "List and read form structure", label: "Read forms" },
	{
		description: "Read submission answers and files",
		label: "Read submissions",
	},
	{ description: "Download uploaded files", label: "Read files" },
];

export default function JotformConnectStep({
	onCancel,
	onConnected,
}: {
	onCancel: () => void;
	onConnected: (connection: JotformConnection) => void;
}) {
	const trpc = useTRPC();
	const [apiKey, setApiKey] = useState("");
	const [region, setRegion] = useState<Region>("auto");
	const [enterpriseUrl, setEnterpriseUrl] = useState("");
	const [showKey, setShowKey] = useState(false);
	const [verified, setVerified] = useState<JotformConnection | null>(null);

	const connect = useMutation(
		trpc.importer.jotform.connect.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: (data) => {
				toast.success(`Connected to ${data.account.name}'s JotForm account`);
				setVerified(data);
			},
		})
	);

	const invalidate = () => {
		if (verified) {
			setVerified(null);
		}
		connect.reset();
	};

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

	let connectLabel = "Test connection";
	if (connect.isPending) {
		connectLabel = "Connecting…";
	} else if (connect.isError) {
		connectLabel = "Try again";
	}

	return (
		<div className="mx-auto max-w-xl space-y-6">
			<div className="flex items-center gap-3">
				<SourceLogo source="jotform" />
				<div>
					<h2 className="font-semibold text-lg">Connect to JotForm</h2>
					<p className="text-muted-foreground text-sm">
						Enter your JotForm API key and the region your account runs in.
					</p>
				</div>
			</div>

			<div className="space-y-5 rounded-2xl border bg-card p-6">
				<div className="space-y-2">
					<Label htmlFor="jotform-api-key">API key</Label>
					<div className="relative">
						<Input
							aria-invalid={connect.isError || undefined}
							autoComplete="off"
							className="pr-9 font-mono"
							id="jotform-api-key"
							onChange={(event) => {
								setApiKey(event.target.value);
								invalidate();
							}}
							placeholder="Paste your JotForm API key"
							spellCheck={false}
							type={showKey ? "text" : "password"}
							value={apiKey}
						/>
						<button
							aria-label={showKey ? "Hide API key" : "Show API key"}
							className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							onClick={() => setShowKey((v) => !v)}
							type="button"
						>
							{showKey ? (
								<EyeOffIcon className="size-4" />
							) : (
								<EyeIcon className="size-4" />
							)}
						</button>
					</div>
					<p className="text-muted-foreground text-xs">
						Find this in JotForm under Account → API.
					</p>
				</div>

				<div className="space-y-2">
					<Label htmlFor="jotform-region">Region</Label>
					<Select
						items={REGIONS}
						onValueChange={(value) => {
							setRegion(value ? (value as Region) : "auto");
							invalidate();
						}}
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
					<p className="text-muted-foreground text-xs">
						Global, EU, HIPAA-compliant, or your Enterprise domain.
					</p>
				</div>

				{region === "enterprise" ? (
					<div className="space-y-2">
						<Label htmlFor="jotform-enterprise-url">Enterprise domain</Label>
						<Input
							id="jotform-enterprise-url"
							onChange={(event) => {
								setEnterpriseUrl(event.target.value);
								invalidate();
							}}
							placeholder="https://acme.jotform.com"
							type="url"
							value={enterpriseUrl}
						/>
						<p className="text-muted-foreground text-xs">
							Your dedicated JotForm Enterprise URL.
						</p>
					</div>
				) : null}

				<div className="space-y-2.5">
					<Label>Required scopes</Label>
					{SCOPES.map((scope) => (
						<div className="flex items-start gap-2.5" key={scope.label}>
							<Checkbox checked className="mt-0.5" disabled />
							<div>
								<p className="font-medium text-sm">{scope.label}</p>
								<p className="text-muted-foreground text-xs">
									{scope.description}
								</p>
							</div>
						</div>
					))}
				</div>

				{verified ? (
					<div className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm">
						<CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" />
						<div>
							<p className="font-medium text-success">Connection verified</p>
							<p className="text-muted-foreground text-xs">
								Connected as {verified.account.email} · {verified.account.name}
								's account
							</p>
						</div>
					</div>
				) : null}

				{connect.isError ? (
					<div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm">
						<AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
						<div>
							<p className="font-medium text-destructive">Connection failed</p>
							<p className="text-muted-foreground text-xs">
								{connect.error.message}
							</p>
						</div>
					</div>
				) : null}

				<Button
					className="w-full"
					disabled={!canConnect || connect.isPending}
					onClick={submit}
					type="button"
				>
					<PlugIcon />
					{connectLabel}
				</Button>

				<p className="text-muted-foreground text-xs">
					Your key stays in memory for this import only (at most 2 hours) and is
					never saved. Free JotForm accounts can make 1,000 API calls a day —
					the review step shows how many this import needs.
				</p>
			</div>

			<div className="flex items-center justify-between gap-3">
				<Button onClick={onCancel} variant="outline">
					← Back to Import
				</Button>
				<Button
					disabled={!verified}
					onClick={() => verified && onConnected(verified)}
				>
					Continue
				</Button>
			</div>
		</div>
	);
}
