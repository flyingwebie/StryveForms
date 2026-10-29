import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import {
	Empty,
	EmptyDescription,
	EmptyTitle,
} from "@StryveForms/ui/components/empty";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, ServerIcon, TrashIcon } from "lucide-react";
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
		<Card className="rounded-xl">
			<CardHeader>
				<CardTitle>Backup destinations</CardTitle>
				<CardDescription>
					Where full-instance backups are sent. Add your own storage, Cloudflare
					R2, RustFS, MinIO or any other S3-compatible service.
				</CardDescription>
				<CardAction>
					<Button onClick={openCreate} size="sm" type="button">
						<PlusIcon /> Add destination
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="space-y-2">
				{destinations.data && destinations.data.length === 0 ? (
					<Empty className="rounded-lg border border-dashed">
						<ServerIcon className="size-8 text-muted-foreground" />
						<EmptyTitle>No destinations yet</EmptyTitle>
						<EmptyDescription>
							Add one before turning on scheduled backups or running a manual
							one.
						</EmptyDescription>
					</Empty>
				) : null}
				{destinations.data?.map((destination) => (
					<button
						className="flex w-full items-center justify-between gap-4 rounded-lg border border-border p-3 text-left text-sm hover:bg-muted/50"
						key={destination.id}
						onClick={() => openEdit(destination)}
						type="button"
					>
						<span className="space-y-0.5">
							<span className="flex items-center gap-2 font-medium">
								{destination.label}
								<Badge variant="secondary">
									{destination.kind === "server"
										? "This instance's storage"
										: destination.preset}
								</Badge>
							</span>
							<span className="block text-muted-foreground text-xs">
								{destination.kind === "server"
									? `Prefix: ${destination.prefix}`
									: `${destination.bucket} · ${destination.endpoint}`}
							</span>
						</span>
						<Button
							disabled={remove.isPending}
							onClick={(event) => {
								event.stopPropagation();
								remove.mutate({ id: destination.id });
							}}
							size="icon-sm"
							type="button"
							variant="ghost"
						>
							<TrashIcon className="text-destructive" />
						</Button>
					</button>
				))}
			</CardContent>

			<DestinationDialog
				destination={editing}
				onOpenChange={setDialogOpen}
				open={dialogOpen}
			/>
		</Card>
	);
}
