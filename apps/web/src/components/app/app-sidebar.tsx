import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubItem,
	SidebarSeparator,
} from "@StryveForms/ui/components/sidebar";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
	ChevronRightIcon,
	FileTextIcon,
	LayoutTemplateIcon,
	MessageSquareIcon,
	PlusIcon,
	SettingsIcon,
	ShieldIcon,
	SparklesIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";
import type { WorkspaceSummary } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

import FolderTree from "./folders/folder-tree";
import InstanceLogo from "./instance-logo";
import PoweredBy from "./powered-by";
import { SETTINGS_SECTIONS } from "./settings/settings-sections";
import UserMenu from "./user-menu";
import WorkspaceSwitcher from "./workspace-switcher";

type SectionKey = "forms" | "templates" | "assistant" | "settings";

const NAV_ITEMS: {
	icon: ComponentType<{ className?: string }>;
	key: SectionKey;
	label: string;
	to:
		| "/dashboard"
		| "/dashboard/templates"
		| "/dashboard/assistant"
		| "/dashboard/settings";
}[] = [
	{ icon: FileTextIcon, key: "forms", label: "Forms", to: "/dashboard" },
	{
		icon: LayoutTemplateIcon,
		key: "templates",
		label: "Templates",
		to: "/dashboard/templates",
	},
	{
		icon: SparklesIcon,
		key: "assistant",
		label: "Assistant",
		to: "/dashboard/assistant",
	},
	{
		icon: SettingsIcon,
		key: "settings",
		label: "Settings",
		to: "/dashboard/settings",
	},
];

/** Every section starts expanded the first time a browser sees this sidebar. */
const DEFAULT_EXPANDED: SectionKey[] = ["forms"];

function expandedSectionsStorageKey(workspaceId: string | null) {
	return `stryveforms.sidebar.sections.expanded.${workspaceId ?? "none"}`;
}

function readExpandedSections(workspaceId: string | null): Set<SectionKey> {
	if (typeof window === "undefined") {
		return new Set(DEFAULT_EXPANDED);
	}
	try {
		const raw = window.localStorage.getItem(
			expandedSectionsStorageKey(workspaceId)
		);
		return raw
			? new Set(JSON.parse(raw) as SectionKey[])
			: new Set(DEFAULT_EXPANDED);
	} catch {
		return new Set(DEFAULT_EXPANDED);
	}
}

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
		<SidebarMenuSub>
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

/** The settings page's own sections, so you can jump straight to one from the main sidebar. */
function SettingsSubNav({ activeTab }: { activeTab: string }) {
	return (
		<SidebarMenuSub>
			{SETTINGS_SECTIONS.map((section) => (
				<SidebarMenuSubItem key={section.value}>
					<Link
						className="flex h-7 min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground text-sm outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground"
						data-active={activeTab === section.value}
						search={{ tab: section.value }}
						to="/dashboard/settings"
					>
						<section.icon />
						<span className="truncate">{section.label}</span>
					</Link>
				</SidebarMenuSubItem>
			))}
		</SidebarMenuSub>
	);
}

/** One top-level nav row (Forms/Templates/Assistant/Settings) with its optional chevron + sub-list. */
function NavSectionItem({
	activeWorkspace,
	chatIdParam,
	folderParam,
	isActive,
	isExpanded,
	item,
	onToggle,
	settingsTabParam,
}: {
	activeWorkspace: WorkspaceSummary | null;
	chatIdParam: string | null;
	folderParam?: string;
	isActive: boolean;
	isExpanded: boolean;
	item: (typeof NAV_ITEMS)[number];
	onToggle: (key: SectionKey) => void;
	settingsTabParam?: string;
}) {
	// Forms/Templates/Assistant sub-content needs a workspace; Settings'
	// sections are static, but we still gate on one being picked so the
	// whole sidebar behaves consistently.
	const canExpand = Boolean(activeWorkspace);

	return (
		<SidebarMenuItem>
			<div className="group/nav-item relative flex items-center">
				<SidebarMenuButton
					className={canExpand ? "pr-7" : undefined}
					isActive={isActive}
					render={<Link to={item.to} />}
					tooltip={item.label}
				>
					<item.icon />
					<span>{item.label}</span>
				</SidebarMenuButton>
				{canExpand ? (
					<button
						aria-label={
							isExpanded ? `Collapse ${item.label}` : `Expand ${item.label}`
						}
						className="absolute right-1 flex size-5 shrink-0 items-center justify-center rounded text-sidebar-foreground/70 hover:bg-sidebar-accent group-data-[collapsible=icon]:hidden"
						onClick={(event) => {
							event.preventDefault();
							onToggle(item.key);
						}}
						type="button"
					>
						<ChevronRightIcon
							className={`size-3.5 transition-transform ${
								isExpanded ? "rotate-90" : ""
							}`}
						/>
					</button>
				) : null}
			</div>
			{isExpanded && activeWorkspace ? (
				<NavSectionContent
					activeWorkspace={activeWorkspace}
					chatIdParam={chatIdParam}
					folderParam={folderParam}
					item={item}
					settingsTabParam={settingsTabParam}
				/>
			) : null}
		</SidebarMenuItem>
	);
}

/** The expanded sub-list under a nav row: folders, recent chats, or settings sections. */
function NavSectionContent({
	activeWorkspace,
	chatIdParam,
	folderParam,
	item,
	settingsTabParam,
}: {
	activeWorkspace: WorkspaceSummary;
	chatIdParam: string | null;
	folderParam?: string;
	item: (typeof NAV_ITEMS)[number];
	settingsTabParam?: string;
}) {
	if (item.key === "forms" || item.key === "templates") {
		return (
			<FolderTree
				activeFolderId={folderParam}
				basePath={item.to as "/dashboard" | "/dashboard/templates"}
				kind={item.key === "forms" ? "form" : "template"}
				workspaceId={activeWorkspace.id}
			/>
		);
	}
	if (item.key === "assistant") {
		return (
			<AssistantSubNav
				activeChatId={chatIdParam}
				workspaceId={activeWorkspace.id}
			/>
		);
	}
	return <SettingsSubNav activeTab={settingsTabParam ?? "workspace"} />;
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
	const settingsTabParam = useRouterState({
		select: (s) => (s.location.search as { tab?: string }).tab,
	});
	const { data: session } = authClient.useSession();
	const isAdmin = Boolean(session?.user.isAdmin);

	const [expanded, setExpanded] = useState<Set<SectionKey>>(() =>
		readExpandedSections(activeWorkspace?.id ?? null)
	);

	// The active workspace resolves async (after this component's first
	// render), so re-read its saved expand state once the id is known —
	// otherwise we're stuck with whatever "none" had.
	useEffect(() => {
		setExpanded(readExpandedSections(activeWorkspace?.id ?? null));
	}, [activeWorkspace?.id]);

	function toggleSection(key: SectionKey) {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			try {
				window.localStorage.setItem(
					expandedSectionsStorageKey(activeWorkspace?.id ?? null),
					JSON.stringify([...next])
				);
			} catch {
				// Storage can be unavailable (private browsing); ignore.
			}
			return next;
		});
	}

	return (
		<Sidebar collapsible="icon" variant={variant}>
			<SidebarHeader className="gap-3">
				<InstanceLogo className="px-2 pt-1" nameClassName="text-sm" />
				<WorkspaceSwitcher
					activeWorkspace={activeWorkspace}
					setWorkspaceId={setWorkspaceId}
					workspaces={workspaces}
				/>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Workspace</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{NAV_ITEMS.map((item) => (
								<NavSectionItem
									activeWorkspace={activeWorkspace}
									chatIdParam={chatIdParam}
									folderParam={folderParam}
									isActive={
										item.to === "/dashboard"
											? pathname === "/dashboard"
											: pathname.startsWith(item.to)
									}
									isExpanded={expanded.has(item.key)}
									item={item}
									key={item.key}
									onToggle={toggleSection}
									settingsTabParam={settingsTabParam}
								/>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				{isAdmin ? (
					<SidebarGroup>
						<SidebarGroupLabel>Instance</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										isActive={pathname.startsWith("/dashboard/admin")}
										render={<Link to="/dashboard/admin" />}
										tooltip="Admin"
									>
										<ShieldIcon />
										<span>Admin</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				) : null}
			</SidebarContent>
			<SidebarFooter className="gap-2">
				<UserMenu />
				<SidebarSeparator className="my-0" />
				<PoweredBy className="px-2 py-1" />
			</SidebarFooter>
		</Sidebar>
	);
}
