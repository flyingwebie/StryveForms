import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@StryveForms/ui/components/sidebar";
import { useNavigate } from "@tanstack/react-router";
import {
	CheckIcon,
	ChevronsUpDownIcon,
	PlusIcon,
	UploadIcon,
} from "lucide-react";
import { useState } from "react";

import EntityIcon from "@/components/app/icons/entity-icon";
import { useInstance } from "@/lib/instance";
import type { WorkspaceSummary } from "@/lib/workspace";

import CreateWorkspaceDialog from "./create-workspace-dialog";

export default function WorkspaceSwitcher({
	activeWorkspace,
	setWorkspaceId,
	workspaces,
}: {
	activeWorkspace: WorkspaceSummary | null;
	setWorkspaceId: (id: string) => void;
	workspaces: WorkspaceSummary[];
}) {
	const [createOpen, setCreateOpen] = useState(false);
	const instance = useInstance();
	const fallbackColor = instance?.primaryColor;
	const navigate = useNavigate();

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
						<span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-base">
							<EntityIcon
								color={activeWorkspace?.brandColor ?? fallbackColor}
								fallback="📝"
								icon={activeWorkspace?.icon}
								size={16}
							/>
						</span>
						<div className="flex min-w-0 flex-col">
							<span className="truncate font-medium">
								{activeWorkspace?.name ?? "Select workspace"}
							</span>
							<span className="truncate text-muted-foreground text-xs capitalize">
								{activeWorkspace?.role ?? ""}
							</span>
						</div>
						<ChevronsUpDownIcon className="ml-auto text-muted-foreground" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-64">
						<DropdownMenuGroup>
							<DropdownMenuLabel>Workspaces</DropdownMenuLabel>
							{workspaces.map((workspace) => (
								<DropdownMenuItem
									key={workspace.id}
									onClick={() => setWorkspaceId(workspace.id)}
								>
									<span className="flex size-5 shrink-0 items-center justify-center text-sm">
										<EntityIcon
											color={workspace.brandColor ?? fallbackColor}
											fallback="📝"
											icon={workspace.icon}
											size={14}
										/>
									</span>
									<span className="flex min-w-0 flex-1 flex-col">
										<span className="truncate">{workspace.name}</span>
										<span className="text-muted-foreground text-xs capitalize">
											{workspace.role} · {workspace.formsCount} form
											{workspace.formsCount === 1 ? "" : "s"}
										</span>
									</span>
									{workspace.id === activeWorkspace?.id ? (
										<CheckIcon className="size-4 shrink-0" />
									) : null}
								</DropdownMenuItem>
							))}
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => setCreateOpen(true)}>
							<PlusIcon /> New workspace
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() =>
								navigate({
									search: { source: "stryveforms", tab: "import" },
									to: "/dashboard/settings",
								})
							}
						>
							<UploadIcon /> Import a workspace
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
			<CreateWorkspaceDialog
				onCreated={setWorkspaceId}
				onOpenChange={setCreateOpen}
				open={createOpen}
			/>
		</SidebarMenu>
	);
}
