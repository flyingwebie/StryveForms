import { Badge } from "@StryveForms/ui/components/badge";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@StryveForms/ui/components/sheet";
import { cn } from "@StryveForms/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/utils/trpc";

export default function IntegrationEventsSheet({
	formId,
	integrationId,
	integrationName,
	onOpenChange,
}: {
	formId: string;
	integrationId: string | null;
	/** Shown in the sheet title, e.g. "Delivery log · Webhook". */
	integrationName?: string;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const events = useQuery({
		...trpc.integration.events.queryOptions({
			formId,
			id: integrationId ?? "",
		}),
		enabled: Boolean(integrationId),
	});

	return (
		<Sheet onOpenChange={onOpenChange} open={Boolean(integrationId)}>
			<SheetContent className="overflow-y-auto">
				<SheetHeader>
					<SheetTitle>
						Delivery log{integrationName ? ` · ${integrationName}` : ""}
					</SheetTitle>
				</SheetHeader>
				<div className="space-y-2 px-4">
					{(events.data ?? []).map((event) => {
						const isSuccess = event.type === "success";
						return (
							<div
								className={cn(
									"space-y-2 rounded-lg border p-3 text-sm",
									isSuccess
										? "border-border"
										: "border-destructive/30 bg-destructive-soft"
								)}
								key={event.id}
							>
								<div className="flex items-center justify-between gap-2">
									<span className="flex items-center gap-1.5">
										<span
											aria-hidden="true"
											className={cn(
												"size-1.5 rounded-full",
												isSuccess ? "bg-success" : "bg-destructive"
											)}
										/>
										<span
											className={cn(
												"font-medium",
												isSuccess ? "text-foreground" : "text-destructive"
											)}
										>
											{isSuccess ? "200 OK" : "Error"}
										</span>
										{(event.data as { test?: boolean } | null)?.test ? (
											<Badge variant="neutral">Test</Badge>
										) : null}
									</span>
									<span className="text-muted-foreground text-xs">
										{new Date(event.createdAt).toLocaleString()}
									</span>
								</div>
								{event.data ? (
									<pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/60 p-2 font-mono text-[11px] text-muted-foreground">
										{JSON.stringify(event.data, null, 2)}
									</pre>
								) : null}
							</div>
						);
					})}
					{events.data?.length === 0 ? (
						<p className="py-6 text-center text-muted-foreground text-sm">
							No events yet
						</p>
					) : null}
				</div>
			</SheetContent>
		</Sheet>
	);
}
