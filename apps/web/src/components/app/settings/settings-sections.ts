import type { LucideIcon } from "lucide-react";
import {
	ArchiveIcon,
	CodeIcon,
	InfoIcon,
	MailIcon,
	PaletteIcon,
	ShieldIcon,
	SlidersHorizontalIcon,
	SparklesIcon,
	UploadIcon,
	UserIcon,
	UsersIcon,
} from "lucide-react";

/**
 * The sections of the settings page (`/dashboard/settings?tab=<value>`).
 * Both the settings page and the sidebar's "Settings" group read this list,
 * so add or rename sections here only.
 */
export const SETTINGS_TABS = [
	"workspace",
	"brand",
	"members",
	"roles",
	"email",
	"import",
	"backup",
	"ai",
	"account",
	"developers",
	"about",
] as const;

export type SettingsSectionValue = (typeof SETTINGS_TABS)[number];

export type SettingsSectionGroup = "Workspace" | "Personal" | "About";

export interface SettingsSection {
	description: string;
	group: SettingsSectionGroup;
	icon: LucideIcon;
	label: string;
	value: SettingsSectionValue;
}

export const SETTINGS_GROUP_ORDER: SettingsSectionGroup[] = [
	"Workspace",
	"Personal",
	"About",
];

export const SETTINGS_SECTIONS: SettingsSection[] = [
	{
		description: "Name and icon shown across the app, and workspace deletion.",
		group: "Workspace",
		icon: SlidersHorizontalIcon,
		label: "General",
		value: "workspace",
	},
	{
		description:
			"The default colours, font and layout every new form in this workspace follows.",
		group: "Workspace",
		icon: PaletteIcon,
		label: "Brand",
		value: "brand",
	},
	{
		description: "Who can access this workspace, and their role.",
		group: "Workspace",
		icon: UsersIcon,
		label: "Members",
		value: "members",
	},
	{
		description:
			"Fine-tune what Members and Read only users are allowed to do.",
		group: "Workspace",
		icon: ShieldIcon,
		label: "Roles & permissions",
		value: "roles",
	},
	{
		description:
			"Sender addresses, reply-to, and an optional custom SMTP server for notification emails.",
		group: "Workspace",
		icon: MailIcon,
		label: "Email sending",
		value: "email",
	},
	{
		description:
			"Bring forms and submissions over from OpnForm or JotForm, or load a StryveForms export as a new workspace.",
		group: "Workspace",
		icon: UploadIcon,
		label: "Import",
		value: "import",
	},
	{
		description:
			"Download a copy of this workspace, or load one you exported before. Only shown to people with the Export workspace permission.",
		group: "Workspace",
		icon: ArchiveIcon,
		label: "Backup & export",
		value: "backup",
	},
	{
		description:
			"Connect an AI provider to use the assistant in this workspace.",
		group: "Workspace",
		icon: SparklesIcon,
		label: "AI assistant",
		value: "ai",
	},
	{
		description: "Your name, password, and active sessions.",
		group: "Personal",
		icon: UserIcon,
		label: "Account",
		value: "account",
	},
	{
		description:
			"Personal API tokens for the CLI and other scripts, and how to connect an AI agent over MCP.",
		group: "Personal",
		icon: CodeIcon,
		label: "Developers",
		value: "developers",
	},
	{
		description: "Version, license and source code.",
		group: "About",
		icon: InfoIcon,
		label: "About",
		value: "about",
	},
];
