import { ItemGroup } from "@StryveForms/ui/components/item";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/app/confirm-dialog";
import { IntegrationCatalogue } from "@/components/app/integrations/catalogue";
import IntegrationEventsSheet from "@/components/app/integrations/events-sheet";
import IntegrationDialog, {
	type IntegrationRecord,
} from "@/components/app/integrations/integration-dialog";
import { IntegrationRow } from "@/components/app/integrations/integration-row";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute(
	"/_auth/dashboard/forms/$formId/integrations"
)({
	component: RouteComponent,
});

function RouteComponent() {
	const { formId } = Route.useParams();
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [dialogIntegrationId, setDialogIntegrationId] = useState<string | null>(
		null
	);
	const [editing, setEditing] = useState<IntegrationRecord | null>(null);
	const [eventsIntegrationId, setEventsIntegrationId] = useState<string | null>(
		null
	);
	const [deleteTarget, setDeleteTarget] = useState<IntegrationRecord | null>(
		null
	);

	const formQuery = useQuery(trpc.form.get.queryOptions({ id: formId }));
	const catalog = useQuery(trpc.integration.catalog.queryOptions());
	const list = useQuery(trpc.integration.list.queryOptions({ formId }));
	const lastRuns = useQuery(trpc.integration.lastRuns.queryOptions({ formId }));

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
	const remove = useMutation(
		trpc.integration.delete.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Integration removed");
				setDeleteTarget(null);
			},
		})
	);
	const test = useMutation(
		trpc.integration.test.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: () => toast.success("Test sent using the latest submission"),
		})
	);

	const catalogById = new Map<
		string,
		{ id: string; name: string; section: string }
	>((catalog.data ?? []).map((c) => [c.id, c]));
	// Email notifications moved to their own tab — don't offer adding a new
	// one here, but existing saved email integrations (if any) still show in
	// "Active integrations" above and remain editable.
	const notifications = (catalog.data ?? []).filter(
		(item) => item.section === "Notifications" && item.id !== "email"
	);
	const automation = (catalog.data ?? []).filter(
		(item) => item.section === "Automation"
	);
	const integrations = list.data ?? [];

	if (!formQuery.data) {
		return <Skeleton className="h-64 w-full" />;
	}

	return (
		<div className="max-w-3xl space-y-8">
			{integrations.length > 0 ? (
				<div className="space-y-2">
					<h3 className="font-medium text-sm">Active integrations</h3>
					<ItemGroup>
						{integrations.map((integration) => (
							<IntegrationRow
								integration={integration as IntegrationRecord}
								key={integration.id}
								lastRun={lastRuns.data?.[integration.id]}
								name={
									catalogById.get(integration.integrationId)?.name ??
									integration.integrationId
								}
								onDelete={() =>
									setDeleteTarget(integration as IntegrationRecord)
								}
								onEdit={() => setEditing(integration as IntegrationRecord)}
								onTest={() => test.mutate({ formId })}
								onToggle={(checked) =>
									update.mutate({
										formId,
										id: integration.id,
										status: checked ? "active" : "inactive",
									})
								}
								onViewEvents={() => setEventsIntegrationId(integration.id)}
							/>
						))}
					</ItemGroup>
				</div>
			) : null}

			<div className="space-y-6">
				<h3 className="font-medium text-sm">Add an integration</h3>
				<IntegrationCatalogue
					items={notifications}
					note={{
						href: `/dashboard/forms/${formId}/notifications`,
						label: "Email notifications now live in their own tab",
					}}
					onAdd={setDialogIntegrationId}
					title="Notifications"
				/>
				<IntegrationCatalogue
					items={automation}
					onAdd={setDialogIntegrationId}
					title="Automation"
				/>
			</div>

			{dialogIntegrationId ? (
				<IntegrationDialog
					existing={null}
					form={formQuery.data}
					integrationId={dialogIntegrationId}
					onOpenChange={(open) => {
						if (!open) {
							setDialogIntegrationId(null);
						}
					}}
					open
				/>
			) : null}

			{editing ? (
				<IntegrationDialog
					existing={editing}
					form={formQuery.data}
					integrationId={editing.integrationId}
					onOpenChange={(open) => {
						if (!open) {
							setEditing(null);
						}
					}}
					open
				/>
			) : null}

			<IntegrationEventsSheet
				formId={formId}
				integrationId={eventsIntegrationId}
				onOpenChange={(open) => {
					if (!open) {
						setEventsIntegrationId(null);
					}
				}}
			/>

			<ConfirmDialog
				description="This stops any further notifications or automations for this form."
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
				title="Delete this integration?"
			/>
		</div>
	);
}
