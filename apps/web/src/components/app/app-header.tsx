import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@StryveForms/ui/components/breadcrumb";
import { Button } from "@StryveForms/ui/components/button";
import { Kbd } from "@StryveForms/ui/components/kbd";
import { Separator } from "@StryveForms/ui/components/separator";
import { SidebarTrigger } from "@StryveForms/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { PlusIcon, SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";

import type { WorkspaceSummary } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

import CommandMenu from "./command-menu";
import NewFormDialog from "./new-form-dialog";
import ThemeToggle from "./theme-toggle";

const FORM_TAB_LABELS: Record<string, string> = {
	analytics: "Analytics",
	integrations: "Integrations",
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

/** Sticky dashboard header: breadcrumb trail, ⌘K search, theme toggle, New form. */
export default function AppHeader({
	activeWorkspace,
	activeWorkspaceId,
	setWorkspaceId,
	workspaces,
}: {
	activeWorkspace: WorkspaceSummary | null;
	activeWorkspaceId: string | null;
	setWorkspaceId: (id: string) => void;
	workspaces: WorkspaceSummary[];
}) {
	const [commandOpen, setCommandOpen] = useState(false);
	const [newFormOpen, setNewFormOpen] = useState(false);
	const crumbs = useBreadcrumbTrail(activeWorkspace);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				setCommandOpen((open) => !open);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	return (
		<header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur-sm">
			<SidebarTrigger />
			<Separator className="h-5" orientation="vertical" />
			<Breadcrumb>
				<BreadcrumbList>
					{crumbs.map((crumb, index) => {
						const isLast = index === crumbs.length - 1;
						return (
							<span className="flex items-center gap-1.5" key={crumb.label}>
								<BreadcrumbItem>
									{isLast || !crumb.to ? (
										<BreadcrumbPage className="truncate">
											{crumb.label}
										</BreadcrumbPage>
									) : (
										<BreadcrumbLink
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

			<div className="ml-auto flex items-center gap-2">
				<Button
					className="text-muted-foreground"
					onClick={() => setCommandOpen(true)}
					size="sm"
					variant="outline"
				>
					<SearchIcon /> Search
					<Kbd className="ml-1">⌘K</Kbd>
				</Button>
				<ThemeToggle />
				<Button
					disabled={!activeWorkspaceId}
					onClick={() => setNewFormOpen(true)}
					size="sm"
				>
					<PlusIcon /> New form
				</Button>
			</div>

			{activeWorkspaceId ? (
				<NewFormDialog
					onOpenChange={setNewFormOpen}
					open={newFormOpen}
					workspaceId={activeWorkspaceId}
				/>
			) : null}

			<CommandMenu
				activeWorkspaceId={activeWorkspaceId}
				onNewForm={() => {
					setCommandOpen(false);
					setNewFormOpen(true);
				}}
				onOpenChange={setCommandOpen}
				open={commandOpen}
				setWorkspaceId={setWorkspaceId}
				workspaces={workspaces}
			/>
		</header>
	);
}
