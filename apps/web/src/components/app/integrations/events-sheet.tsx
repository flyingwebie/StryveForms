import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@StryveForms/ui/components/sheet";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/utils/trpc";

export default function IntegrationEventsSheet({
	formId,
	integrationId,
	onOpenChange,
}: {
	formId: string;
	integrationId: string | null;
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
					<SheetTitle>Delivery log</SheetTitle>
				</SheetHeader>
				<div className="space-y-2 px-4">
					{(events.data ?? []).map((event) => (
						<div
							className="rounded-lg border border-border p-2 text-sm"
							key={event.id}
						>
							<div className="flex items-center justify-between">
								<span className="flex items-center gap-1.5">
									<span
										className={
											event.type === "success"
												? "text-green-600"
												: "text-destructive"
										}
									>
										{event.type === "success" ? "Success" : "Error"}
									</span>
									{(event.data as { test?: boolean } | null)?.test ? (
										<span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wide">
											Test
										</span>
									) : null}
								</span>
								<span className="text-muted-foreground text-xs">
									{new Date(event.createdAt).toLocaleString()}
								</span>
							</div>
							{event.data ? (
								<pre className="mt-1 overflow-x-auto text-muted-foreground text-xs">
									{JSON.stringify(event.data, null, 2)}
								</pre>
							) : null}
						</div>
					))}
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
