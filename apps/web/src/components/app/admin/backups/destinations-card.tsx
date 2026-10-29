import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyTitle,
} from "@StryveForms/ui/components/empty";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, ServerIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { formatTrpcError } from "@/lib/format-trpc-error";
import { useTRPC } from "@/utils/trpc";

import DestinationDialog, {
	type ClientDestination,
} from "./destination-dialog";

/** Where backups can be sent: this instance's own storage, or any S3-compatible bucket. */
export default function DestinationsCard() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const destinations = useQuery(
		trpc.backupAdmin.destinations.list.queryOptions()
	);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<ClientDestination | null>(null);

	const remove = useMutation(
		trpc.backupAdmin.destinations.delete.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.backupAdmin.destinations.list.queryKey(),
				});
				toast.success("Destination removed");
			},
		})
	);

	function openCreate() {
		setEditing(null);
		setDialogOpen(true);
	}

	function openEdit(destination: ClientDestination) {
		setEditing(destination);
		setDialogOpen(true);
	}

	return (
		<section className="space-y-4">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="font-semibold text-base">Destination</h3>
					<p className="text-[13px] text-subtle-foreground">
						Where backup archives are stored. Add your own storage, Cloudflare
						R2, RustFS, MinIO or any other S3-compatible service.
					</p>
				</div>
				<Button onClick={openCreate} size="sm" type="button" variant="outline">
					<PlusIcon /> Add destination
				</Button>
			</div>

			{destinations.data && destinations.data.length === 0 ? (
				<Empty className="rounded-xl border border-dashed bg-subtle/50">
					<ServerIcon className="size-8 text-subtle-foreground" />
					<EmptyTitle>No destinations yet</EmptyTitle>
					<EmptyDescription>
						Add one before turning on scheduled backups or running a manual one.
					</EmptyDescription>
				</Empty>
			) : null}

			{destinations.data && destinations.data.length > 0 ? (
				<div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-subtle">
					{destinations.data.map((destination) => (
						<div
							className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
							key={destination.id}
						>
							<div className="min-w-0 space-y-0.5">
								<div className="flex items-center gap-2 font-medium">
									{destination.label}
									<Badge variant="neutral">
										{destination.kind === "server"
											? "This instance's storage"
											: (destination.preset ?? "S3-compatible")}
									</Badge>
								</div>
								<p className="truncate font-mono text-subtle-foreground text-xs">
									{destination.kind === "server"
										? `Prefix: ${destination.prefix}`
										: `${destination.bucket} · ${destination.endpoint}`}
								</p>
							</div>
							<div className="flex shrink-0 items-center gap-1">
								<Button
									aria-label={`Edit ${destination.label}`}
									onClick={() => openEdit(destination)}
									size="icon-sm"
									type="button"
									variant="ghost"
								>
									<PencilIcon />
								</Button>
								<Button
									aria-label={`Remove ${destination.label}`}
									disabled={remove.isPending}
									onClick={() => remove.mutate({ id: destination.id })}
									size="icon-sm"
									type="button"
									variant="ghost"
								>
									<TrashIcon className="text-destructive" />
								</Button>
							</div>
						</div>
					))}
				</div>
			) : null}

			<DestinationDialog
				destination={editing}
				onOpenChange={setDialogOpen}
				open={dialogOpen}
			/>
		</section>
	);
}
