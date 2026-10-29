import type { Database } from "@StryveForms/db";
import { user } from "@StryveForms/db/schema/auth";
import { instanceSettings, workspace } from "@StryveForms/db/schema/forms";
import type { EmailBranding } from "@StryveForms/emails/components/layout";
import type { EmailSettings } from "@StryveForms/emails/settings";
import type { WorkspaceBrand } from "@StryveForms/forms/brand";
import { count, eq } from "drizzle-orm";

import type { AppConfig } from "../context";

export const INSTANCE_ID = "default";
const CACHE_MS = 30_000;

export type InstanceSettings = typeof instanceSettings.$inferSelect;

let cached: { at: number; value: InstanceSettings } | null = null;

export function clearInstanceCache() {
	cached = null;
}

/** Branding and access rules of this installation (created on first read). */
export async function getInstanceSettings(
	db: Database
): Promise<InstanceSettings> {
	if (cached && Date.now() - cached.at < CACHE_MS) {
		return cached.value;
	}
	let [row] = await db
		.select()
		.from(instanceSettings)
		.where(eq(instanceSettings.id, INSTANCE_ID));
	if (!row) {
		[row] = await db
			.insert(instanceSettings)
			.values({ id: INSTANCE_ID })
			.onConflictDoNothing()
			.returning();
		[row] = row
			? [row]
			: await db
					.select()
					.from(instanceSettings)
					.where(eq(instanceSettings.id, INSTANCE_ID));
	}
	if (!row) {
		throw new Error("Could not load instance settings");
	}
	cached = { at: Date.now(), value: row };
	return row;
}

export async function hasUsers(db: Database): Promise<boolean> {
	const [row] = await db.select({ n: count() }).from(user);
	return (row?.n ?? 0) > 0;
}

/** Makes a relative URL (e.g. an uploaded logo) absolute for emails. */
function absolute(url: string | null, base: string): string | null {
	if (!url) {
		return null;
	}
	return url.startsWith("http")
		? url
		: `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * Branding used in every email this installation sends: the admin's saved email
 * wrapper settings, falling back to the instance's general branding. Pass
 * `workspaceId` for emails sent in a workspace context (submissions, invites…)
 * so the workspace's own accent colour/logo (if set) take priority.
 */
export async function emailBranding(
	db: Database,
	config: AppConfig,
	opts?: { workspaceId?: string }
): Promise<EmailBranding> {
	const settings = await getInstanceSettings(db);
	const emailSettings = (settings.emailSettings ??
		{}) as Partial<EmailSettings>;
	const branding: EmailBranding = {
		...emailSettings,
		accentColor: emailSettings.accentColor ?? settings.primaryColor,
		appName: settings.name || config.appName,
		appUrl: config.appUrl,
		logoDarkUrl: absolute(
			emailSettings.logoDarkUrl ?? settings.logoDarkUrl,
			config.appUrl
		),
		logoUrl: absolute(emailSettings.logoUrl ?? settings.logoUrl, config.appUrl),
	};
	if (opts?.workspaceId) {
		const [ws] = await db
			.select({ brand: workspace.brand })
			.from(workspace)
			.where(eq(workspace.id, opts.workspaceId));
		const brand = ws?.brand as WorkspaceBrand | undefined;
		if (brand?.color) {
			branding.accentColor = brand.color;
		}
		if (brand?.logoPicture) {
			branding.logoUrl = absolute(brand.logoPicture, config.appUrl);
		}
	}
	return branding;
}
