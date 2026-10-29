import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import BackupExportSection from "@/components/app/backup/export-section";
import ImportCenter from "@/components/app/import/import-center";
import AboutSettingsTab from "@/components/app/settings/about-tab";
import AccountSettingsTab from "@/components/app/settings/account-tab";
import AiSettingsTab from "@/components/app/settings/ai-tab";
import BrandSettingsTab from "@/components/app/settings/brand-tab";
import DeveloperSettingsTab from "@/components/app/settings/developer-tab";
import EmailSettingsTab from "@/components/app/settings/email-tab";
import MembersSettingsTab from "@/components/app/settings/members-tab";
import RolesSettingsTab from "@/components/app/settings/roles-tab";
import {
	SETTINGS_GROUP_ORDER,
	SETTINGS_SECTIONS,
	SETTINGS_TABS,
} from "@/components/app/settings/settings-sections";
import WorkspaceSettingsTab from "@/components/app/settings/workspace-tab";
import SettingsShell, {
	type SettingsNavGroup,
} from "@/components/app/settings-shell";
import { useWorkspaces, type WorkspaceSummary } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

const TABS = SETTINGS_TABS;
const searchSchema = z.object({
	/** Opens the import wizard for this source right away. */
	source: z.enum(["opnform", "jotform", "stryveforms"]).optional(),
	tab: z.enum(TABS).default("workspace"),
});

export const Route = createFileRoute("/_auth/dashboard/settings")({
	component: RouteComponent,
	validateSearch: searchSchema,
});

/** Hides a settings section from the nav+body unless its filter allows it. */
function buildGroups(hidden: Set<(typeof TABS)[number]>): SettingsNavGroup[] {
	return SETTINGS_GROUP_ORDER.map((group) => ({
		items: SETTINGS_SECTIONS.filter(
			(section) => section.group === group && !hidden.has(section.value)
		).map(({ description, icon, label, value }) => ({
			description,
			icon,
			label,
			value,
		})),
		label: group,
	}));
}

/** The settings page's main content, split out to keep RouteComponent simple. */
function SettingsTabContent({
	activeWorkspace,
	canExport,
	source,
	tab,
}: {
	activeWorkspace: WorkspaceSummary | null;
	canExport: boolean;
	source: "opnform" | "jotform" | "stryveforms" | undefined;
	tab: (typeof TABS)[number];
}) {
	if (tab === "import") {
		return <ImportCenter initialSource={source} />;
	}
	if (tab === "account") {
		return <AccountSettingsTab />;
	}
	if (tab === "developers") {
		return <DeveloperSettingsTab />;
	}
	if (tab === "about") {
		return <AboutSettingsTab />;
	}
	if (!activeWorkspace) {
		return null;
	}
	const key = activeWorkspace.id;
	if (tab === "workspace") {
		return <WorkspaceSettingsTab key={key} workspace={activeWorkspace} />;
	}
	if (tab === "brand") {
		return <BrandSettingsTab key={key} workspace={activeWorkspace} />;
	}
	if (tab === "members") {
		return <MembersSettingsTab key={key} workspace={activeWorkspace} />;
	}
	if (tab === "roles") {
		return <RolesSettingsTab key={key} workspace={activeWorkspace} />;
	}
	if (tab === "email") {
		return <EmailSettingsTab key={key} workspace={activeWorkspace} />;
	}
	if (tab === "backup") {
		return canExport ? (
			<BackupExportSection key={key} workspace={activeWorkspace} />
		) : null;
	}
	if (tab === "ai") {
		return <AiSettingsTab key={key} workspace={activeWorkspace} />;
	}
	return null;
}

function RouteComponent() {
	const { source, tab } = Route.useSearch();
	const navigate = Route.useNavigate();
	const { activeWorkspace } = useWorkspaces();
	const trpc = useTRPC();

	// "Backup & export" only shows for people with the export_workspace
	// capability; the server enforces this too, this just avoids a dead link.
	const permissions = useQuery({
		...trpc.workspace.myPermissions.queryOptions({
			workspaceId: activeWorkspace?.id ?? "",
		}),
		enabled: Boolean(activeWorkspace),
	});
	const canExport = permissions.data?.capabilities.export_workspace ?? false;
	const hidden = new Set<(typeof TABS)[number]>(canExport ? [] : ["backup"]);
	const groups = buildGroups(hidden);

	return (
		<SettingsShell
			groups={groups}
			onValueChange={(value) =>
				navigate({ search: { tab: value as (typeof TABS)[number] } })
			}
			title="Settings"
			value={tab}
		>
			<SettingsTabContent
				activeWorkspace={activeWorkspace}
				canExport={canExport}
				source={source}
				tab={tab}
			/>
		</SettingsShell>
	);
}
