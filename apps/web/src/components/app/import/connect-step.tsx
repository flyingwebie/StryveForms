import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@StryveForms/ui/components/alert";
import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { Tabs, TabsList, TabsTrigger } from "@StryveForms/ui/components/tabs";
import { useMutation } from "@tanstack/react-query";
import {
	AlertCircleIcon,
	ArrowLeftIcon,
	CheckCircle2Icon,
	EyeIcon,
	EyeOffIcon,
	PlugIcon,
} from "lucide-react";
import { useState } from "react";

import { useTRPC } from "@/utils/trpc";

export interface OpnformConnection {
	baseUrl: string;
	connectionId: string;
	workspaces: { icon: string | null; id: number; name: string }[];
}

const CLOUD_URL = "https://api.opnform.com";
const SCOPES = [
	{ description: "List and read form structure", label: "Read forms" },
	{
		description: "Read submission answers and files",
		label: "Read submissions",
	},
	{ description: "Download uploaded files", label: "Read files" },
];

export default function ConnectStep({
	onBack,
	onConnected,
}: {
	onBack: () => void;
	onConnected: (connection: OpnformConnection) => void;
}) {
	const trpc = useTRPC();
	const [mode, setMode] = useState<"cloud" | "self-hosted">("cloud");
	const [baseUrl, setBaseUrl] = useState("");
	const [token, setToken] = useState("");
	const [showToken, setShowToken] = useState(false);
	const [verified, setVerified] = useState<OpnformConnection | null>(null);

	const connect = useMutation(
		trpc.importer.opnform.connect.mutationOptions({
			onSuccess: setVerified,
		})
	);

	const effectiveUrl = mode === "cloud" ? CLOUD_URL : baseUrl.trim();
	const retry = () => {
		connect.reset();
		setVerified(null);
	};
	let connectLabel = "Test connection";
	if (connect.isPending) {
		connectLabel = "Connecting…";
	} else if (connect.isError) {
		connectLabel = "Try again";
	}

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-lg">Connect to OpnForm</h2>
				<p className="text-muted-foreground text-sm">
					Enter your OpnForm server details and a personal access token. We only
					request read access to forms and submissions.
				</p>
			</div>

			<div className="space-y-4 rounded-2xl border bg-card p-6">
				<Tabs
					onValueChange={(value) => {
						setMode(value as typeof mode);
						retry();
					}}
					value={mode}
				>
					<TabsList>
						<TabsTrigger value="cloud">Cloud</TabsTrigger>
						<TabsTrigger value="self-hosted">Self-hosted</TabsTrigger>
					</TabsList>
				</Tabs>

				<div className="space-y-2">
					<Label htmlFor="opnform-base-url">Server URL</Label>
					<Input
						disabled={mode === "cloud"}
						id="opnform-base-url"
						onChange={(event) => {
							setBaseUrl(event.target.value);
							retry();
						}}
						placeholder="https://opnform.com"
						value={mode === "cloud" ? CLOUD_URL : baseUrl}
					/>
					<p className="text-muted-foreground text-xs">
						Use your own domain if self-hosted.
					</p>
				</div>

				<div className="space-y-2">
					<Label htmlFor="opnform-token">Personal access token</Label>
					<div className="relative">
						<Input
							aria-invalid={connect.isError || undefined}
							className="pr-9"
							id="opnform-token"
							onChange={(event) => {
								setToken(event.target.value);
								retry();
							}}
							placeholder="opnform_pat_…"
							type={showToken ? "text" : "password"}
							value={token}
						/>
						<button
							aria-label={showToken ? "Hide token" : "Show token"}
							className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							onClick={() => setShowToken((v) => !v)}
							type="button"
						>
							{showToken ? (
								<EyeOffIcon className="size-4" />
							) : (
								<EyeIcon className="size-4" />
							)}
						</button>
					</div>
					{connect.isError ? (
						<p className="text-destructive text-xs">
							This token looks invalid or has expired.
						</p>
					) : (
						<p className="text-muted-foreground text-xs">
							Create one in OpnForm under Settings → Developers.
						</p>
					)}
				</div>

				<div className="space-y-2">
					<p className="font-medium text-[13px]">Required scopes</p>
					<ul className="space-y-1.5">
						{SCOPES.map((scope) => (
							<li className="flex items-start gap-2 text-sm" key={scope.label}>
								<span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-primary bg-primary text-primary-foreground">
									<CheckCircle2Icon className="size-3" />
								</span>
								<span>
									<span className="font-medium">{scope.label}</span>
									<span className="block text-muted-foreground text-xs">
										{scope.description}
									</span>
								</span>
							</li>
						))}
					</ul>
				</div>

				{verified ? (
					<Alert className="border-success/30 bg-success-soft">
						<CheckCircle2Icon className="text-success" />
						<AlertTitle className="text-success">
							Connection verified
						</AlertTitle>
						<AlertDescription className="text-success/90">
							Connected to {verified.baseUrl}
						</AlertDescription>
					</Alert>
				) : null}

				{connect.isError ? (
					<Alert variant="destructive">
						<AlertCircleIcon />
						<AlertTitle>Connection failed</AlertTitle>
						<AlertDescription>
							We couldn't verify this token against{" "}
							{effectiveUrl || "your server"}.
						</AlertDescription>
					</Alert>
				) : null}

				{connect.isError ? (
					<div className="space-y-2">
						<p className="font-medium text-[13px]">Things to check</p>
						<ol className="space-y-1.5 text-muted-foreground text-sm">
							<li className="flex items-start gap-2">
								<span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-foreground">
									1
								</span>
								The token hasn't expired or been revoked in OpnForm
							</li>
							<li className="flex items-start gap-2">
								<span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-foreground">
									2
								</span>
								It includes the Read forms, Read submissions and Read files
								scopes
							</li>
							<li className="flex items-start gap-2">
								<span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-foreground">
									3
								</span>
								The server URL matches your OpnForm account exactly
							</li>
						</ol>
					</div>
				) : null}

				<Button
					className="w-full"
					disabled={connect.isPending || !token.trim() || !effectiveUrl}
					onClick={() =>
						connect.mutate({ baseUrl: effectiveUrl, token: token.trim() })
					}
				>
					<PlugIcon />
					{connectLabel}
				</Button>
			</div>

			<div className="flex items-center justify-between gap-3">
				<Button onClick={onBack} variant="outline">
					<ArrowLeftIcon />
					Back to Import
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
