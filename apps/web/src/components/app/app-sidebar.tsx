import { Kbd } from "@StryveForms/ui/components/kbd";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubItem,
} from "@StryveForms/ui/components/sidebar";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
	FileTextIcon,
	LayoutTemplateIcon,
	MessageSquareIcon,
	PlusIcon,
	SearchIcon,
	SettingsIcon,
	ShieldCheckIcon,
	SparklesIcon,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import type { WorkspaceSummary } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

import FolderTree from "./folders/folder-tree";
import InstanceLogo from "./instance-logo";
import PoweredBy from "./powered-by";
import { useShell } from "./shell-context";
import UserMenu from "./user-menu";
import WorkspaceSwitcher from "./workspace-switcher";

const ACTIVE_ITEM =
	"data-active:font-medium data-active:shadow-xs data-active:ring-1 data-active:ring-sidebar-border data-active:[&>svg]:text-primary";

const PRIMARY_NAV = [
	{ icon: FileTextIcon, label: "Forms", to: "/dashboard" },
	{ icon: LayoutTemplateIcon, label: "Templates", to: "/dashboard/templates" },
	{ icon: SparklesIcon, label: "Assistant", to: "/dashboard/assistant" },
] as const;

/** Recent chats + "New chat", read-only view of the Assistant page's own chat list. */
function AssistantSubNav({
	activeChatId,
	workspaceId,
}: {
	activeChatId: string | null;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const navigate = useNavigate();
	const chatsQuery = useQuery(trpc.ai.chat.list.queryOptions({ workspaceId }));
	const createChat = useMutation(trpc.ai.chat.create.mutationOptions());
	const chats = (chatsQuery.data ?? []).slice(0, 8);

	return (
		<SidebarMenuSub className="mx-0 translate-x-0 gap-0.5 border-l-0 px-0">
			<SidebarMenuSubItem>
				<button
					className="flex h-7 w-full min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground text-sm outline-hidden ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground"
					disabled={createChat.isPending}
					onClick={() => {
						createChat.mutate(
							{ workspaceId },
							{
								onSuccess: (data) =>
									navigate({
										search: { chatId: data.id },
										to: "/dashboard/assistant",
									}),
							}
						);
					}}
					type="button"
				>
					<PlusIcon />
					<span>New chat</span>
				</button>
			</SidebarMenuSubItem>
			{chats.length === 0 ? (
				<SidebarMenuSubItem>
					<span className="block px-2 py-1 text-muted-foreground text-xs">
						No chats yet
					</span>
				</SidebarMenuSubItem>
			) : null}
			{chats.map((chat) => (
				<SidebarMenuSubItem key={chat.id}>
					<Link
						className="flex h-7 min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground text-sm outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground"
						data-active={activeChatId === chat.id}
						search={{ chatId: chat.id }}
						to="/dashboard/assistant"
					>
						<MessageSquareIcon />
						<span className="truncate">{chat.title ?? "Untitled chat"}</span>
					</Link>
				</SidebarMenuSubItem>
			))}
		</SidebarMenuSub>
	);
}

/** Sidebar "Search or jump to…" button that opens the ⌘K command palette. */
function SearchButton() {
	const { openCommandMenu } = useShell();
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton
					className="h-8.5 border border-sidebar-border bg-background text-muted-foreground shadow-xs hover:bg-background hover:text-foreground group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:shadow-none"
					onClick={openCommandMenu}
					tooltip="Search (⌘K)"
				>
					<SearchIcon />
					<span className="flex-1 text-[13px]">Search or jump to…</span>
					<Kbd className="group-data-[collapsible=icon]:hidden">⌘K</Kbd>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

export default function AppSidebar({
	activeWorkspace,
	setWorkspaceId,
	workspaces,
	variant = "sidebar",
}: {
	activeWorkspace: WorkspaceSummary | null;
	setWorkspaceId: (id: string) => void;
	workspaces: WorkspaceSummary[];
	variant?: "sidebar" | "floating" | "inset";
}) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const folderParam = useRouterState({
		select: (s) => (s.location.search as { folder?: string }).folder,
	});
	const chatIdParam = useRouterState({
		select: (s) => (s.location.search as { chatId?: string }).chatId ?? null,
	});
	const { data: session } = authClient.useSession();
	const isAdmin = Boolean(session?.user.isAdmin);

	const onTemplates = pathname.startsWith("/dashboard/templates");
	const onAssistant = pathname.startsWith("/dashboard/assistant");

	const isActive = (to: string) =>
		to === "/dashboard"
			? pathname === "/dashboard" || pathname.startsWith("/dashboard/forms")
			: pathname.startsWith(to);

	return (
		<Sidebar collapsible="icon" variant={variant}>
			<SidebarHeader className="gap-2 pt-3">
				<InstanceLogo
					className="px-2 group-data-[collapsible=icon]:hidden"
					size="sm"
				/>
				<InstanceLogo
					className="mx-auto hidden group-data-[collapsible=icon]:block"
					mode="icon"
					size="sm"
				/>
				<WorkspaceSwitcher
					activeWorkspace={activeWorkspace}
					setWorkspaceId={setWorkspaceId}
					workspaces={workspaces}
				/>
				<SearchButton />
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup className="pt-1">
					<SidebarGroupContent>
						<SidebarMenu className="gap-0.5">
							{PRIMARY_NAV.map((item) => (
								<SidebarMenuItem key={item.to}>
									<SidebarMenuButton
										className={ACTIVE_ITEM}
										isActive={isActive(item.to)}
										render={<Link to={item.to} />}
										tooltip={item.label}
									>
										<item.icon />
										<span>{item.label}</span>
									</SidebarMenuButton>
									{item.to === "/dashboard" && activeWorkspace ? (
										<SidebarMenuBadge className="text-muted-foreground">
											{activeWorkspace.formsCount}
										</SidebarMenuBadge>
									) : null}
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{activeWorkspace ? (
					<SidebarGroup className="group-data-[collapsible=icon]:hidden">
						{onAssistant ? (
							<>
								<SidebarGroupLabel className="text-[11px] uppercase tracking-wider">
									Recent chats
								</SidebarGroupLabel>
								<SidebarGroupContent>
									<AssistantSubNav
										activeChatId={chatIdParam}
										workspaceId={activeWorkspace.id}
									/>
								</SidebarGroupContent>
							</>
						) : (
							<SidebarGroupContent>
								<FolderTree
									activeFolderId={folderParam}
									basePath={onTemplates ? "/dashboard/templates" : "/dashboard"}
									kind={onTemplates ? "template" : "form"}
									label={onTemplates ? "Template folders" : "Folders"}
									workspaceId={activeWorkspace.id}
								/>
							</SidebarGroupContent>
						)}
					</SidebarGroup>
				) : null}

				<SidebarGroup>
					<SidebarGroupLabel className="text-[11px] uppercase tracking-wider">
						Manage
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu className="gap-0.5">
							<SidebarMenuItem>
								<SidebarMenuButton
									className={ACTIVE_ITEM}
									isActive={pathname.startsWith("/dashboard/settings")}
									render={<Link to="/dashboard/settings" />}
									tooltip="Settings"
								>
									<SettingsIcon />
									<span>Settings</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							{isAdmin ? (
								<SidebarMenuItem>
									<SidebarMenuButton
										className={ACTIVE_ITEM}
										isActive={pathname.startsWith("/dashboard/admin")}
										render={<Link to="/dashboard/admin" />}
										tooltip="Admin"
									>
										<ShieldCheckIcon />
										<span>Admin</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							) : null}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter className="gap-2 pb-3">
				<PoweredBy />
				<UserMenu />
			</SidebarFooter>
		</Sidebar>
	);
}
