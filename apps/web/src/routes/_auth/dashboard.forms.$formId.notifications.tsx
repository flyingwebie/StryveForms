import { Button } from "@StryveForms/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@StryveForms/ui/components/empty";
import { ItemGroup } from "@StryveForms/ui/components/item";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MailPlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import ConfirmDialog from "@/components/app/confirm-dialog";
import NotificationEditor from "@/components/app/notifications/notification-editor";
import {
	type NotificationRecord,
	NotificationRow,
} from "@/components/app/notifications/notification-row";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute(
	"/_auth/dashboard/forms/$formId/notifications"
)({
	component: RouteComponent,
	// `?edit=new` opens a blank notification, `?edit=<id>` an existing one,
	// so the browser's back button and a page refresh keep you in the editor.
	validateSearch: z.object({ edit: z.string().optional() }),
});

function RouteComponent() {
	const { formId } = Route.useParams();
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { edit } = Route.useSearch();
	const navigate = Route.useNavigate();
	const openEditor = (id: string) => navigate({ search: { edit: id } });
	const closeEditor = () => navigate({ search: {} });
	const [deleteTarget, setDeleteTarget] = useState<NotificationRecord | null>(
		null
	);

	const formQuery = useQuery(trpc.form.get.queryOptions({ id: formId }));
	const list = useQuery(trpc.integration.list.queryOptions({ formId }));
	const lastRuns = useQuery(trpc.integration.lastRuns.queryOptions({ formId }));

	const notifications = (list.data ?? []).filter(
		(row) => row.integrationId === "email"
	) as NotificationRecord[];

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.integration.list.queryKey(),
		});

	const update = useMutation(
		trpc.integration.update.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: invalidate,
		})
	);
	const create = useMutation(
		trpc.integration.create.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Notification duplicated");
			},
		})
	);
	const remove = useMutation(
		trpc.integration.delete.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Notification removed");
				setDeleteTarget(null);
			},
		})
	);

	if (!formQuery.data || (edit && edit !== "new" && list.isLoading)) {
		return <Skeleton className="h-64 w-full" />;
	}

	if (edit) {
		const existing =
			edit === "new" ? null : notifications.find((n) => n.id === edit);
		if (existing !== undefined) {
			return (
				<NotificationEditor
					existing={existing}
					form={formQuery.data}
					key={edit}
					onClose={closeEditor}
				/>
			);
		}
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-semibold text-base">Email notifications</h2>
					<p className="text-muted-foreground text-sm">
						Send an email every time someone submits this form.
					</p>
				</div>
				<Button onClick={() => openEditor("new")}>
					<MailPlusIcon /> New notification
				</Button>
			</div>

			{notifications.length > 0 ? (
				<ItemGroup>
					{notifications.map((notification) => (
						<NotificationRow
							key={notification.id}
							lastRun={lastRuns.data?.[notification.id]}
							notification={notification}
							onDelete={() => setDeleteTarget(notification)}
							onDuplicate={() =>
								create.mutate({
									data: notification.data,
									formId,
									integrationId: "email",
									logic: notification.logic,
									status: "inactive",
								})
							}
							onEdit={() => openEditor(notification.id)}
							onToggle={(checked) =>
								update.mutate({
									formId,
									id: notification.id,
									status: checked ? "active" : "inactive",
								})
							}
						/>
					))}
				</ItemGroup>
			) : (
				<Empty className="rounded-xl border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<MailPlusIcon />
						</EmptyMedia>
						<EmptyTitle>No email notifications yet</EmptyTitle>
						<EmptyDescription>
							Add one to get an email every time someone submits this form, or
							send the respondent a confirmation.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button onClick={() => openEditor("new")}>
							<MailPlusIcon /> New notification
						</Button>
					</EmptyContent>
				</Empty>
			)}

			<ConfirmDialog
				description="This stops this email from being sent for new submissions."
				loading={remove.isPending}
				onConfirm={() =>
					deleteTarget && remove.mutate({ formId, id: deleteTarget.id })
				}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteTarget(null);
					}
				}}
				open={Boolean(deleteTarget)}
				title="Delete this notification?"
			/>
		</div>
	);
}
