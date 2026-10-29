import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@StryveForms/ui/components/command";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	CheckIcon,
	FileTextIcon,
	LayoutTemplateIcon,
	MonitorIcon,
	MoonIcon,
	PlusIcon,
	SettingsIcon,
	ShieldIcon,
	SunIcon,
	UploadCloudIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import type { WorkspaceSummary } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

/** Global ⌘K palette: search forms, jump to sections, switch workspace, toggle theme. */
export default function CommandMenu({
	activeWorkspaceId,
	onNewForm,
	onOpenChange,
	open,
	setWorkspaceId,
	workspaces,
}: {
	activeWorkspaceId: string | null;
	onNewForm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	setWorkspaceId: (id: string) => void;
	workspaces: WorkspaceSummary[];
}) {
	const trpc = useTRPC();
	const navigate = useNavigate();
	const { setTheme } = useTheme();
	const { data: session } = authClient.useSession();
	const isAdmin = Boolean(session?.user.isAdmin);
	const [search, setSearch] = useState("");

	const formsQuery = useQuery({
		...trpc.form.list.queryOptions({
			search: search || undefined,
			workspaceId: activeWorkspaceId ?? "",
		}),
		enabled: Boolean(activeWorkspaceId) && open,
	});

	const goToForm = (formId: string) => {
		onOpenChange(false);
		navigate({ params: { formId }, to: "/dashboard/forms/$formId" });
	};

	const goTo = (
		to: "/dashboard/admin" | "/dashboard/settings" | "/dashboard/templates"
	) => {
		onOpenChange(false);
		navigate({ to });
	};

	const goToImport = (source: "opnform" | "jotform" | "stryveforms") => {
		onOpenChange(false);
		navigate({ search: { source, tab: "import" }, to: "/dashboard/settings" });
	};

	return (
		<CommandDialog
			description="Search forms, jump to a section, or run a command."
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) {
					setSearch("");
				}
			}}
			open={open}
			title="Command palette"
		>
			<Command shouldFilter={false}>
				<CommandInput
					onValueChange={setSearch}
					placeholder="Search forms or run a command…"
					value={search}
				/>
				<CommandList>
					<CommandEmpty>No results found.</CommandEmpty>

					{(formsQuery.data ?? []).length > 0 ? (
						<CommandGroup heading="Forms">
							{(formsQuery.data ?? []).slice(0, 8).map((form) => (
								<CommandItem
									key={form.id}
									onSelect={() => goToForm(form.id)}
									value={form.title}
								>
									<FileTextIcon /> {form.title}
								</CommandItem>
							))}
						</CommandGroup>
					) : null}

					<CommandSeparator />

					<CommandGroup heading="Actions">
						<CommandItem onSelect={onNewForm} value="new form create">
							<PlusIcon /> New form
						</CommandItem>
						<CommandItem
							onSelect={() => goTo("/dashboard/templates")}
							value="templates"
						>
							<LayoutTemplateIcon /> Browse templates
						</CommandItem>
						<CommandItem
							onSelect={() => goToImport("opnform")}
							value="import opnform migrate"
						>
							<UploadCloudIcon /> Import from OpnForm
						</CommandItem>
						<CommandItem
							onSelect={() => goToImport("jotform")}
							value="import jotform migrate"
						>
							<UploadCloudIcon /> Import from JotForm
						</CommandItem>
						<CommandItem
							onSelect={() => goToImport("stryveforms")}
							value="import workspace stryveforms backup restore"
						>
							<UploadCloudIcon /> Import a workspace
						</CommandItem>
						<CommandItem
							onSelect={() => goTo("/dashboard/settings")}
							value="settings"
						>
							<SettingsIcon /> Settings
						</CommandItem>
						{isAdmin ? (
							<CommandItem
								onSelect={() => goTo("/dashboard/admin")}
								value="admin"
							>
								<ShieldIcon /> Admin
							</CommandItem>
						) : null}
					</CommandGroup>

					{workspaces.length > 1 ? (
						<>
							<CommandSeparator />
							<CommandGroup heading="Switch workspace">
								{workspaces.map((workspace) => (
									<CommandItem
										key={workspace.id}
										onSelect={() => {
											setWorkspaceId(workspace.id);
											onOpenChange(false);
										}}
										value={`workspace ${workspace.name}`}
									>
										<span className="flex size-4 shrink-0 items-center justify-center text-sm">
											{workspace.icon ?? "📝"}
										</span>
										{workspace.name}
										{workspace.id === activeWorkspaceId ? (
											<CheckIcon className="ml-auto" />
										) : null}
									</CommandItem>
								))}
							</CommandGroup>
						</>
					) : null}

					<CommandSeparator />
					<CommandGroup heading="Theme">
						<CommandItem onSelect={() => setTheme("light")} value="theme light">
							<SunIcon /> Light
							<CommandShortcut>L</CommandShortcut>
						</CommandItem>
						<CommandItem onSelect={() => setTheme("dark")} value="theme dark">
							<MoonIcon /> Dark
							<CommandShortcut>D</CommandShortcut>
						</CommandItem>
						<CommandItem
							onSelect={() => setTheme("system")}
							value="theme system"
						>
							<MonitorIcon /> System
						</CommandItem>
					</CommandGroup>
				</CommandList>
				<div className="flex items-center gap-3 border-border border-t px-3 py-2 text-subtle-foreground text-xs">
					<span className="flex items-center gap-1">
						<kbd className="rounded border border-border bg-muted px-1 font-sans">
							↑↓
						</kbd>
						Navigate
					</span>
					<span className="flex items-center gap-1">
						<kbd className="rounded border border-border bg-muted px-1 font-sans">
							↵
						</kbd>
						Select
					</span>
					<span className="flex items-center gap-1">
						<kbd className="rounded border border-border bg-muted px-1 font-sans">
							esc
						</kbd>
						Close
					</span>
				</div>
			</Command>
		</CommandDialog>
	);
}
