import { Button } from "@StryveForms/ui/components/button";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ExternalLinkIcon, PencilIcon, Share2Icon } from "lucide-react";
import { useState } from "react";

import { AskAiButton } from "@/components/app/ai/ask-ai-button";
import ShareDialog from "@/components/app/share/share-dialog";
import StatusBadge from "@/components/app/status-badge";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/dashboard/forms/$formId")({
	component: RouteComponent,
});

const TABS = [
	{ label: "Submissions", to: "/dashboard/forms/$formId" },
	{ label: "Analytics", to: "/dashboard/forms/$formId/analytics" },
	{ label: "Summary", to: "/dashboard/forms/$formId/summary" },
	{ label: "Share", to: "/dashboard/forms/$formId/share" },
	{ label: "PDF templates", to: "/dashboard/forms/$formId/pdf" },
	{
		label: "Email notifications",
		to: "/dashboard/forms/$formId/notifications",
	},
	{ label: "Integrations", to: "/dashboard/forms/$formId/integrations" },
] as const;

function RouteComponent() {
	const { formId } = Route.useParams();
	const trpc = useTRPC();
	const formQuery = useQuery(trpc.form.get.queryOptions({ id: formId }));
	const form = formQuery.data;
	const [shareOpen, setShareOpen] = useState(false);

	return (
		<div className="flex flex-col">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b p-6 pb-4">
				<div className="flex items-center gap-3">
					{form ? (
						<>
							<h1 className="font-semibold text-2xl">{form.title}</h1>
							<StatusBadge
								isClosed={form.visibility === "closed"}
								visibility={form.visibility}
							/>
						</>
					) : (
						<Skeleton className="h-8 w-48" />
					)}
				</div>
				<div className="flex items-center gap-2">
					{form ? (
						<Button
							render={
								<a
									href={`/forms/${form.slug}`}
									rel="noopener noreferrer"
									target="_blank"
								/>
							}
							variant="outline"
						>
							<ExternalLinkIcon /> View form
						</Button>
					) : (
						<Button disabled variant="outline">
							<ExternalLinkIcon /> View form
						</Button>
					)}
					<Button
						disabled={!form}
						onClick={() => setShareOpen(true)}
						variant="outline"
					>
						<Share2Icon /> Share
					</Button>
					<AskAiButton formId={formId} size="default" variant="outline" />
					<Button render={<Link params={{ formId }} to="/editor/$formId" />}>
						<PencilIcon /> Edit form
					</Button>
				</div>
			</div>

			{form ? (
				<ShareDialog
					formId={form.id}
					onOpenChange={setShareOpen}
					open={shareOpen}
				/>
			) : null}

			<nav className="flex gap-1 overflow-x-auto border-b px-6">
				{TABS.map((tab) => (
					<Link
						activeOptions={{ exact: tab.to === "/dashboard/forms/$formId" }}
						className="px-3 py-2.5 text-muted-foreground text-sm hover:text-foreground data-[status=active]:border-foreground data-[status=active]:border-b-2 data-[status=active]:font-medium data-[status=active]:text-foreground"
						key={tab.to}
						params={{ formId }}
						to={tab.to}
					>
						{tab.label}
					</Link>
				))}
			</nav>

			<div className="flex-1 p-6">
				<Outlet />
			</div>
		</div>
	);
}
