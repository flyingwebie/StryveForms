import { Button } from "@StryveForms/ui/components/button";
import { cn } from "@StryveForms/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	Loader2Icon,
	SendIcon,
	XCircleIcon,
} from "lucide-react";

import { useTRPC } from "@/utils/trpc";

/**
 * "Send test": fires a realistic sample payload through this integration's
 * real handler (same SSRF guard, same code path as a live submission) and
 * shows the result right here — status, timing, and a response/error snippet.
 */
export function TestSendButton({
	data,
	formId,
	id,
	integrationId,
	settings,
}: {
	data: Record<string, unknown>;
	formId: string;
	/** The saved integration's id, so the attempt is also logged to its delivery log. Omit for an unsaved draft. */
	id?: string;
	integrationId: string;
	settings: Record<string, unknown>;
}) {
	const trpc = useTRPC();
	const sendTest = useMutation(trpc.integration.sendTest.mutationOptions());

	return (
		<div className="space-y-2">
			<Button
				disabled={sendTest.isPending}
				onClick={() =>
					sendTest.mutate({ data, formId, id, integrationId, settings })
				}
				size="sm"
				type="button"
				variant="outline"
			>
				{sendTest.isPending ? (
					<Loader2Icon className="animate-spin" />
				) : (
					<SendIcon />
				)}
				Send test
			</Button>
			<p className="text-muted-foreground text-xs">
				Sends a sample payload (marked as a test) using this integration's
				current settings, without needing a real submission.
			</p>
			{sendTest.data ? (
				<div
					className={cn(
						"space-y-1 rounded-lg border p-2 text-xs",
						sendTest.data.ok
							? "border-green-600/30 bg-green-600/5"
							: "border-destructive/30 bg-destructive/5"
					)}
				>
					<div className="flex flex-wrap items-center gap-1.5 font-medium">
						{sendTest.data.ok ? (
							<CheckCircle2Icon className="size-3.5 text-green-600" />
						) : (
							<XCircleIcon className="size-3.5 text-destructive" />
						)}
						{sendTest.data.ok ? "Sent" : "Failed"}
						{typeof sendTest.data.status === "number"
							? ` — HTTP ${sendTest.data.status}`
							: null}
						<span className="text-muted-foreground">
							({sendTest.data.durationMs} ms)
						</span>
					</div>
					{sendTest.data.error ? (
						<p className="text-destructive">{sendTest.data.error}</p>
					) : null}
					{sendTest.data.response ? (
						<pre className="overflow-x-auto whitespace-pre-wrap text-muted-foreground">
							{sendTest.data.response}
						</pre>
					) : null}
				</div>
			) : null}
			{sendTest.isError ? (
				<p className="text-destructive text-xs">{sendTest.error.message}</p>
			) : null}
		</div>
	);
}
