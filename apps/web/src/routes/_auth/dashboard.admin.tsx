import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	BotIcon,
	DatabaseBackupIcon,
	ImageIcon,
	MailIcon,
	PaletteIcon,
	ShieldIcon,
	UsersIcon,
} from "lucide-react";
import { z } from "zod";

import AdminAccessTab from "@/components/app/admin/access-tab";
import AdminBackupsTab from "@/components/app/admin/backups/backups-tab";
import AdminBrandingTab from "@/components/app/admin/branding-tab";
import AdminEmailsTab from "@/components/app/admin/emails-tab";
import AdminMcpTab from "@/components/app/admin/mcp-tab";
// Adds the "media" tab for Admin → "Images & Unsplash".
import AdminMediaTab from "@/components/app/admin/media-tab";
import AdminUsersTab from "@/components/app/admin/users-tab";
import SettingsShell, {
	type SettingsNavGroup,
} from "@/components/app/settings-shell";
import { authClient } from "@/lib/auth-client";

const TABS = [
	"branding",
	"emails",
	"access",
	"users",
	"agents",
	"media",
	"backups",
] as const;
const searchSchema = z.object({
	tab: z.enum(TABS).default("branding"),
});

export const Route = createFileRoute("/_auth/dashboard/admin")({
	component: RouteComponent,
	validateSearch: searchSchema,
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data?.user.isAdmin) {
			throw redirect({ to: "/dashboard" });
		}
	},
});

const GROUPS: SettingsNavGroup[] = [
	{
		items: [
			{
				description:
					"Instance name, logo, favicon, hero copy and brand colour shown across the whole app.",
				icon: PaletteIcon,
				label: "Branding",
				value: "branding",
			},
			{
				description:
					"Design every outgoing email (colours, logo, dark mode, social links) and send test emails.",
				icon: MailIcon,
				label: "Emails",
				value: "emails",
			},
			{
				description:
					"Sign-up mode and the email domains allowed to register on this instance.",
				icon: ShieldIcon,
				label: "Access",
				value: "access",
			},
			{
				description:
					"Every account on this instance, and who's an administrator.",
				icon: UsersIcon,
				label: "Users",
				value: "users",
			},
			{
				description:
					"Enable/disable the MCP server and personal API tokens for AI agents, and see connection instructions.",
				icon: BotIcon,
				label: "AI agents & MCP",
				value: "agents",
			},
			{
				description:
					"The Unsplash Access Key used by the image picker's Unsplash tab, with an enable toggle and a how-to.",
				icon: ImageIcon,
				label: "Images & Unsplash",
				value: "media",
			},
			{
				description:
					"Backup destinations, scheduled backups, retention, and restoring the whole instance from a backup.",
				icon: DatabaseBackupIcon,
				label: "Backups",
				value: "backups",
			},
		],
		label: "Instance",
	},
];

function RouteComponent() {
	const { tab } = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<SettingsShell
			groups={GROUPS}
			onValueChange={(value) =>
				navigate({ search: { tab: value as (typeof TABS)[number] } })
			}
			title="Admin settings"
			value={tab}
		>
			{tab === "branding" ? <AdminBrandingTab /> : null}
			{tab === "emails" ? <AdminEmailsTab /> : null}
			{tab === "access" ? <AdminAccessTab /> : null}
			{tab === "users" ? <AdminUsersTab /> : null}
			{tab === "agents" ? <AdminMcpTab /> : null}
			{tab === "media" ? <AdminMediaTab /> : null}
			{tab === "backups" ? <AdminBackupsTab /> : null}
		</SettingsShell>
	);
}
