import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@StryveForms/ui/components/breadcrumb";
import { Separator } from "@StryveForms/ui/components/separator";
import { SidebarTrigger } from "@StryveForms/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";

import type { WorkspaceSummary } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

import ThemeToggle from "./theme-toggle";

const FORM_TAB_LABELS: Record<string, string> = {
	analytics: "Analytics",
	integrations: "Integrations",
	notifications: "Notifications",
	pdf: "PDF templates",
	share: "Share",
	summary: "Summary",
};

const SECTION_LABELS: Record<string, string> = {
	admin: "Admin",
	assistant: "Assistant",
	import: "Import",
	settings: "Settings",
	templates: "Templates",
};

const FORM_PATH_PATTERN = /^\/dashboard\/forms\/([^/]+)(?:\/([^/]+))?/;

function useBreadcrumbTrail(activeWorkspace: WorkspaceSummary | null) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const trpc = useTRPC();

	const match = pathname.match(FORM_PATH_PATTERN);
	const formId = match?.[1];
	const tabSegment = match?.[2];

	const formQuery = useQuery({
		...trpc.form.get.queryOptions({ id: formId ?? "" }),
		enabled: Boolean(formId),
	});

	const crumbs: { label: string; to?: string; params?: { formId: string } }[] =
		[];

	if (activeWorkspace) {
		crumbs.push({ label: activeWorkspace.name });
	}

	if (formId) {
		crumbs.push({ label: "Forms", to: "/dashboard" });
		crumbs.push({
			label: formQuery.data?.title ?? "Loading…",
			params: { formId },
			to: "/dashboard/forms/$formId",
		});
		crumbs.push({
			label: tabSegment
				? (FORM_TAB_LABELS[tabSegment] ?? tabSegment)
				: "Submissions",
		});
	} else {
		const [, , section] = pathname.split("/");
		crumbs.push({
			label: section ? (SECTION_LABELS[section] ?? "Forms") : "Forms",
		});
	}

	return crumbs;
}

/** Top bar of the main panel: sidebar toggle, breadcrumb trail and theme toggle. */
export default function AppHeader({
	activeWorkspace,
}: {
	activeWorkspace: WorkspaceSummary | null;
}) {
	const crumbs = useBreadcrumbTrail(activeWorkspace);

	return (
		<header className="sticky top-0 z-10 flex h-13 shrink-0 items-center gap-2 border-b bg-background px-3 md:px-4">
			<SidebarTrigger className="text-muted-foreground" />
			<Separator className="mr-1 h-4" orientation="vertical" />
			<Breadcrumb className="min-w-0">
				<BreadcrumbList className="flex-nowrap">
					{crumbs.map((crumb, index) => {
						const isLast = index === crumbs.length - 1;
						return (
							<span
								className="flex min-w-0 items-center gap-1.5"
								key={`${crumb.to ?? "page"}-${crumb.label}`}
							>
								<BreadcrumbItem className="min-w-0">
									{isLast || !crumb.to ? (
										<BreadcrumbPage
											className={
												isLast
													? "truncate font-medium"
													: "truncate font-medium text-muted-foreground"
											}
										>
											{crumb.label}
										</BreadcrumbPage>
									) : (
										<BreadcrumbLink
											className="truncate font-medium"
											render={
												<Link
													params={crumb.params}
													to={crumb.to as "/dashboard"}
												/>
											}
										>
											{crumb.label}
										</BreadcrumbLink>
									)}
								</BreadcrumbItem>
								{isLast ? null : <BreadcrumbSeparator />}
							</span>
						);
					})}
				</BreadcrumbList>
			</Breadcrumb>

			<div className="ml-auto flex items-center gap-1">
				<ThemeToggle />
			</div>
		</header>
	);
}
