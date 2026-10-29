import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { ShareContent } from "@/components/app/share/share-content";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/dashboard/forms/$formId/share")({
	component: RouteComponent,
});

function RouteComponent() {
	const { formId } = Route.useParams();
	const trpc = useTRPC();
	const formQuery = useQuery(trpc.form.get.queryOptions({ id: formId }));

	if (!formQuery.data) {
		return <Skeleton className="h-64 w-full" />;
	}

	return (
		<div className="min-w-0">
			<ShareContent form={formQuery.data} />
		</div>
	);
}
