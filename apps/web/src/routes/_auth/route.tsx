import {
	SidebarInset,
	SidebarProvider,
} from "@StryveForms/ui/components/sidebar";
import {
	createFileRoute,
	Outlet,
	redirect,
	useLocation,
} from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import AppHeader from "@/components/app/app-header";
import AppSidebar from "@/components/app/app-sidebar";
import SetupBanner from "@/components/app/setup-banner";
import { ShellProvider } from "@/components/app/shell-context";
import TwoFactorNudgeBanner from "@/components/app/two-factor-nudge-banner";
import { authClient } from "@/lib/auth-client";
import { useWorkspaces } from "@/lib/workspace";

export const Route = createFileRoute("/_auth")({
	ssr: false,
	component: AuthLayout,
	beforeLoad: async ({ location }) => {
		const session = await authClient.getSession();
		if (!session.data) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			});
		}
		return { session };
	},
});

function AuthLayout() {
	const { activeWorkspace, activeWorkspaceId, setWorkspaceId, workspaces } =
		useWorkspaces();
	// The page content scrolls inside this box (the header stays put), so new
	// pages start at the top here rather than relying on window scrolling.
	const scrollerRef = useRef<HTMLDivElement>(null);
	const { pathname } = useLocation();
	useEffect(() => {
		if (pathname) {
			scrollerRef.current?.scrollTo({ top: 0 });
		}
	}, [pathname]);

	return (
		<SidebarProvider>
			<ShellProvider
				activeWorkspaceId={activeWorkspaceId}
				setWorkspaceId={setWorkspaceId}
				workspaces={workspaces}
			>
				<AppSidebar
					activeWorkspace={activeWorkspace}
					setWorkspaceId={setWorkspaceId}
					variant="inset"
					workspaces={workspaces}
				/>
				<SidebarInset className="h-svh min-w-0 overflow-hidden md:peer-data-[variant=inset]:h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:shadow-xs">
					<AppHeader activeWorkspace={activeWorkspace} />
					<SetupBanner />
					<TwoFactorNudgeBanner />
					<div
						className="min-w-0 flex-1 overflow-y-auto"
						key={activeWorkspaceId ?? "none"}
						ref={scrollerRef}
					>
						<Outlet />
					</div>
				</SidebarInset>
			</ShellProvider>
		</SidebarProvider>
	);
}
