import type { Database } from "@StryveForms/db";
import { form, workspace, workspaceMember } from "@StryveForms/db/schema/forms";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";

export type WorkspaceRole = "admin" | "user" | "readonly";

/**
 * What each role may do. Mirrors OpnForm's policies:
 * - admin: everything, including members and workspace settings
 * - user: create and edit forms, manage submissions and integrations
 * - readonly: view forms and submissions only
 */
export type Permission = "view" | "edit" | "manage";

const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
	admin: ["view", "edit", "manage"],
	readonly: ["view"],
	user: ["view", "edit"],
};

export function roleAllows(
	role: WorkspaceRole,
	permission: Permission
): boolean {
	return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Fine-grained capabilities a workspace admin can turn on/off per role from
 * the "Roles & permissions" settings page, on top of the broad view/edit/manage
 * levels above. Admin is always allowed everything and can't be changed.
 */
export const CAPABILITIES = [
	{
		description:
			"See this workspace's forms and the responses submitted to them.",
		key: "view_forms",
		label: "View forms & submissions",
	},
	{
		description: "Build new forms and change existing ones.",
		key: "edit_forms",
		label: "Create & edit forms",
	},
	{
		description: "Permanently remove a form.",
		key: "delete_forms",
		label: "Delete forms",
	},
	{
		description: "Make a form live, or stop it from accepting new responses.",
		key: "publish_forms",
		label: "Publish & close forms",
	},
	{
		description: "Edit, delete, or export submitted responses.",
		key: "manage_submissions",
		label: "Manage submissions",
	},
	{
		description:
			"Connect webhooks, email notifications and other integrations.",
		key: "manage_integrations",
		label: "Manage integrations & notifications",
	},
	{
		description: "Create and edit PDF documents generated from submissions.",
		key: "manage_pdf_templates",
		label: "Manage PDF templates",
	},
	{
		description: "Ask the AI assistant to help build or improve forms.",
		key: "use_ai_assistant",
		label: "Use the AI assistant",
	},
	{
		description: "Create, rename and organize folders and saved templates.",
		key: "manage_folders",
		label: "Manage folders & templates",
	},
	{
		description: "Invite, remove, and change the role of workspace members.",
		key: "manage_members",
		label: "Manage members",
	},
	{
		description:
			"Change workspace name, brand, email sending and other settings.",
		key: "manage_workspace",
		label: "Manage workspace settings & brand",
	},
	{
		description: "Bring forms and submissions in from OpnForm or JotForm.",
		key: "import_data",
		label: "Import forms",
	},
	{
		description:
			"Download this workspace as a file to back it up or load it into another instance.",
		key: "export_workspace",
		label: "Export workspace",
	},
] as const;

export type Capability = (typeof CAPABILITIES)[number]["key"];
export type CapabilityRole = Exclude<WorkspaceRole, "admin">;

/**
 * Today's actual behaviour, kept as the out-of-the-box matrix: Members can do
 * everything except manage members/workspace settings; Read only members can
 * only view (the AI assistant and submission-export reads are "view"-gated
 * today, so they stay available — the toggle lets an admin tighten that).
 */
const DEFAULT_CAPABILITIES: Record<
	CapabilityRole,
	Record<Capability, boolean>
> = {
	readonly: {
		delete_forms: false,
		edit_forms: false,
		export_workspace: false,
		import_data: false,
		manage_folders: false,
		manage_integrations: false,
		manage_members: false,
		manage_pdf_templates: false,
		manage_submissions: false,
		manage_workspace: false,
		publish_forms: false,
		use_ai_assistant: true,
		view_forms: true,
	},
	user: {
		delete_forms: true,
		edit_forms: true,
		export_workspace: false,
		import_data: true,
		manage_folders: true,
		manage_integrations: true,
		manage_members: false,
		manage_pdf_templates: true,
		manage_submissions: true,
		manage_workspace: false,
		publish_forms: true,
		use_ai_assistant: true,
		view_forms: true,
	},
};

/** Per-role capability overrides saved in `workspace.settings.rolePermissions`. */
export type RolePermissionOverrides = Partial<
	Record<CapabilityRole, Partial<Record<Capability, boolean>>>
>;

function overridesFromSettings(
	settings: Record<string, unknown> | null | undefined
): RolePermissionOverrides {
	const value = (settings ?? {}) as { rolePermissions?: unknown };
	return (value.rolePermissions as RolePermissionOverrides | undefined) ?? {};
}

/** The full admin/user/readonly × capability matrix, defaults merged with saved overrides. */
export function effectiveCapabilityMatrix(
	settings: Record<string, unknown> | null | undefined
): Record<WorkspaceRole, Record<Capability, boolean>> {
	const overrides = overridesFromSettings(settings);
	const allTrue = Object.fromEntries(
		CAPABILITIES.map((c) => [c.key, true])
	) as Record<Capability, boolean>;
	const merge = (role: CapabilityRole) => ({
		...DEFAULT_CAPABILITIES[role],
		...overrides[role],
	});
	return { admin: allTrue, readonly: merge("readonly"), user: merge("user") };
}

export function roleAllowsCapability(
	role: WorkspaceRole,
	capability: Capability,
	settings?: Record<string, unknown> | null
): boolean {
	if (role === "admin") {
		return true;
	}
	return effectiveCapabilityMatrix(settings)[role][capability];
}

export async function getMembership(
	db: Database,
	workspaceId: string,
	userId: string
) {
	const [row] = await db
		.select()
		.from(workspaceMember)
		.where(
			and(
				eq(workspaceMember.workspaceId, workspaceId),
				eq(workspaceMember.userId, userId)
			)
		)
		.limit(1);
	return row ?? null;
}

/**
 * Checks the user may act in this workspace. Pass `capability` to additionally
 * (or instead — see below) enforce one of the fine-grained "Roles &
 * permissions" toggles.
 *
 * When `capability` is given it is the sole gate: its default value already
 * encodes the equivalent of the broad `permission` check (see
 * `DEFAULT_CAPABILITIES` in this file), so passing it lets an admin override
 * even an otherwise `manage`-only action (e.g. let a Member manage members)
 * without changing behaviour for anyone who hasn't customised the matrix.
 * Callers that don't pass `capability` keep the exact behaviour they had before.
 */
export async function requireWorkspace(
	db: Database,
	workspaceId: string,
	userId: string,
	permission: Permission = "view",
	capability?: Capability
) {
	const membership = await getMembership(db, workspaceId, userId);
	if (!membership) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });
	}
	if (capability) {
		const [row] = await db
			.select({ settings: workspace.settings })
			.from(workspace)
			.where(eq(workspace.id, workspaceId))
			.limit(1);
		if (!roleAllowsCapability(membership.role, capability, row?.settings)) {
			const label =
				CAPABILITIES.find((c) => c.key === capability)?.label ?? capability;
			throw new TRPCError({
				code: "FORBIDDEN",
				message: `Your role doesn't have the "${label}" permission in this workspace`,
			});
		}
		return membership;
	}
	if (!roleAllows(membership.role, permission)) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You don't have permission to do this in this workspace",
		});
	}
	return membership;
}

/** Loads a (non-deleted) form and checks the user may act on it. */
export async function requireForm(
	db: Database,
	formId: string,
	userId: string,
	permission: Permission = "view",
	capability?: Capability
) {
	const [row] = await db
		.select()
		.from(form)
		.where(and(eq(form.id, formId), isNull(form.deletedAt)))
		.limit(1);
	if (!row) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Form not found" });
	}
	const membership = await requireWorkspace(
		db,
		row.workspaceId,
		userId,
		permission,
		capability
	);
	return { form: row, membership };
}
