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
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

export interface OpnformConnection {
	baseUrl: string;
	connectionId: string;
	workspaces: { icon: string | null; id: number; name: string }[];
}

const CLOUD_URL = "https://api.opnform.com";

export default function ConnectStep({
	onConnected,
}: {
	onConnected: (connection: OpnformConnection) => void;
}) {
	const trpc = useTRPC();
	const [mode, setMode] = useState<"cloud" | "self-hosted">("cloud");
	const [baseUrl, setBaseUrl] = useState("");
	const [token, setToken] = useState("");

	const connect = useMutation(
		trpc.importer.opnform.connect.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: (data) => {
				toast.success("Connected to OpnForm");
				onConnected(data);
			},
		})
	);

	const effectiveUrl = mode === "cloud" ? CLOUD_URL : baseUrl.trim();

	return (
		<Card className="mx-auto max-w-xl rounded-2xl">
			<CardHeader>
				<CardTitle>Connect your OpnForm account</CardTitle>
				<CardDescription>
					Create a personal access token in OpnForm under Settings &rarr; Access
					Tokens, with the <code>forms-read</code>, <code>workspaces-read</code>
					, <code>workspace-users-read</code> and{" "}
					<code>manage-integrations</code> abilities.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex gap-2">
					<Button
						className="flex-1"
						onClick={() => setMode("cloud")}
						type="button"
						variant={mode === "cloud" ? "default" : "outline"}
					>
						OpnForm Cloud
					</Button>
					<Button
						className="flex-1"
						onClick={() => setMode("self-hosted")}
						type="button"
						variant={mode === "self-hosted" ? "default" : "outline"}
					>
						Self-hosted
					</Button>
				</div>

				{mode === "self-hosted" && (
					<div className="space-y-2">
						<Label htmlFor="opnform-base-url">Server URL</Label>
						<Input
							id="opnform-base-url"
							onChange={(event) => setBaseUrl(event.target.value)}
							placeholder="https://your-host.com/api"
							value={baseUrl}
						/>
					</div>
				)}

				<div className="space-y-2">
					<Label htmlFor="opnform-token">Personal access token</Label>
					<Input
						id="opnform-token"
						onChange={(event) => setToken(event.target.value)}
						placeholder="opnform_pat_…"
						type="password"
						value={token}
					/>
				</div>

				<Button
					className="w-full"
					disabled={connect.isPending || !token.trim() || !effectiveUrl}
					onClick={() =>
						connect.mutate({ baseUrl: effectiveUrl, token: token.trim() })
					}
				>
					{connect.isPending ? "Connecting…" : "Connect"}
				</Button>
			</CardContent>
		</Card>
	);
}
