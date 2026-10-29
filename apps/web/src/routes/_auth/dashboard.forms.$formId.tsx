import { Button } from "@StryveForms/ui/components/button";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
	ExternalLinkIcon,
	PencilIcon,
	Share2Icon,
	SparklesIcon,
} from "lucide-react";
import { useState } from "react";

import { PageBody } from "@/components/app/page-header";
import ShareDialog from "@/components/app/share/share-dialog";
import StatusBadge from "@/components/app/status-badge";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/dashboard/forms/$formId")({
	component: RouteComponent,
});

const TABS = [
	{
		label: "Submissions",
		to: "/dashboard/forms/$formId",
		withCount: true,
	},
	{
		label: "Analytics",
		to: "/dashboard/forms/$formId/analytics",
		withCount: false,
	},
	{
		label: "Summary",
		to: "/dashboard/forms/$formId/summary",
		withCount: false,
	},
	{ label: "Share", to: "/dashboard/forms/$formId/share", withCount: false },
	{
		label: "PDF templates",
		to: "/dashboard/forms/$formId/pdf",
		withCount: false,
	},
	{
		label: "Notifications",
		to: "/dashboard/forms/$formId/notifications",
		withCount: false,
	},
	{
		label: "Integrations",
		to: "/dashboard/forms/$formId/integrations",
		withCount: false,
	},
] as const;

const PROTOCOL_PATTERN = /^https?:\/\//;

/** `https://stryve.app/f/slug` → `stryve.app/f/slug`, for compact display. */
function stripProtocol(url: string): string {
	return url.replace(PROTOCOL_PATTERN, "");
}

function FormMetaLine({
	shareUrl,
	submissionsCount,
	updatedAt,
}: {
	shareUrl: string;
	submissionsCount: number;
	updatedAt: string;
}) {
	const updated = new Date(updatedAt);
	return (
		<p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-subtle-foreground">
			<span className="font-mono">{stripProtocol(shareUrl)}</span>
			<span aria-hidden="true">·</span>
			<span>
				{submissionsCount}{" "}
				{submissionsCount === 1 ? "submission" : "submissions"}
			</span>
			<span aria-hidden="true">·</span>
			<span>
				Updated{" "}
				{Number.isNaN(updated.getTime())
					? "recently"
					: formatDistanceToNow(updated, { addSuffix: true })}
			</span>
		</p>
	);
}

function RouteComponent() {
	const { formId } = Route.useParams();
	const trpc = useTRPC();
	const formQuery = useQuery(trpc.form.get.queryOptions({ id: formId }));
	const form = formQuery.data;
	const [shareOpen, setShareOpen] = useState(false);

	return (
		<div className="flex flex-col">
			<PageBody className="gap-3 pb-5">
				<div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
					<div className="min-w-0 space-y-1.5">
						{form ? (
							<div className="flex flex-wrap items-center gap-3">
								<h1 className="truncate font-semibold text-2xl tracking-tight">
									{form.title}
								</h1>
								<StatusBadge
									isClosed={form.visibility === "closed"}
									visibility={form.visibility}
								/>
							</div>
						) : (
							<Skeleton className="h-8 w-56" />
						)}
						{form ? (
							<FormMetaLine
								shareUrl={form.shareUrl}
								submissionsCount={form.submissionsCount}
								updatedAt={form.updatedAt}
							/>
						) : (
							<Skeleton className="h-4 w-72" />
						)}
					</div>
					<div className="flex shrink-0 items-center gap-2">
						{form ? (
							<>
								<Button
									render={
										<a
											href={`/forms/${form.slug}`}
											rel="noopener noreferrer"
											target="_blank"
										/>
									}
									variant="ghost"
								>
									<ExternalLinkIcon /> View form
								</Button>
								<Button onClick={() => setShareOpen(true)} variant="outline">
									<Share2Icon /> Share
								</Button>
								<Button
									render={
										<Link search={{ formId }} to="/dashboard/assistant" />
									}
									variant="soft"
								>
									<SparklesIcon /> Ask AI
								</Button>
								<Button
									render={<Link params={{ formId }} to="/editor/$formId" />}
								>
									<PencilIcon /> Edit form
								</Button>
							</>
						) : (
							<Skeleton className="h-9 w-80" />
						)}
					</div>
				</div>
			</PageBody>

			{form ? (
				<ShareDialog
					formId={form.id}
					onOpenChange={setShareOpen}
					open={shareOpen}
				/>
			) : null}

			<nav className="border-b">
				<div className="mx-auto flex w-full max-w-[1400px] gap-6 overflow-x-auto px-4 md:px-8">
					{TABS.map((tab) => (
						<Link
							activeOptions={{ exact: tab.to === "/dashboard/forms/$formId" }}
							className="relative flex items-center gap-1.5 whitespace-nowrap border-transparent border-b-2 py-2.5 text-muted-foreground text-sm hover:text-foreground data-[status=active]:border-primary data-[status=active]:font-medium data-[status=active]:text-foreground"
							key={tab.to}
							params={{ formId }}
							to={tab.to}
						>
							{tab.label}
							{tab.withCount && form ? (
								<span className="text-subtle-foreground text-xs tabular-nums">
									{form.submissionsCount}
								</span>
							) : null}
						</Link>
					))}
				</div>
			</nav>

			<PageBody>
				<Outlet />
			</PageBody>
		</div>
	);
}
