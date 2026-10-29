import {
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { workspace } from "./forms";

const timestamps = {
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
};

/* -------------------------------------------------------------------------- */
/*                                Backup jobs                                 */
/* -------------------------------------------------------------------------- */

/**
 * One row per background backup/export/import run: workspace exports and
 * imports (anyone who can create workspaces), and full instance backups and
 * restores (instance admins only). See packages/api/src/services/backup —
 * CONTRACT.md documents the full shape of `options`/`progress`/`log`/`result`.
 */
export const backupJobKind = pgEnum("backup_job_kind", [
	"workspace_export",
	"workspace_import",
	"instance_backup",
	"instance_restore",
]);

export const backupJobStatus = pgEnum("backup_job_status", [
	"pending",
	"running",
	"completed",
	"failed",
	"cancelled",
]);

export const backupJobTrigger = pgEnum("backup_job_trigger", [
	"manual",
	"scheduled",
	"safety",
	"cli",
]);

export const backupJob = pgTable(
	"backup_job",
	{
		id: text("id").primaryKey(),
		kind: backupJobKind("kind").notNull(),
		status: backupJobStatus("status").default("pending").notNull(),
		trigger: backupJobTrigger("trigger").default("manual").notNull(),
		/** Null for scheduled/safety instance backups, which have no acting user. */
		userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
		/** Set for workspace_export/workspace_import; null for instance-scoped jobs. */
		workspaceId: text("workspace_id").references(() => workspace.id, {
			onDelete: "set null",
		}),
		/** Backup destination id (see instance_settings.backup_settings), when not a manual download. */
		destinationId: text("destination_id"),
		/** Job-kind-specific input: includeUploads, includeSecrets, uploadKey, members[]… */
		options: jsonb("options")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		/** Live progress shown in the UI: counts done/total per entity. */
		progress: jsonb("progress")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		log: jsonb("log")
			.$type<{ at: string; level: string; message: string }[]>()
			.default([])
			.notNull(),
		/** Final summary: counts, warnings, slug changes, members added… (see CONTRACT.md). */
		result: jsonb("result").$type<Record<string, unknown> | null>(),
		/** Storage key of the finished archive (exports/… or tmp/backups/…), once written. */
		fileKey: text("file_key"),
		fileName: text("file_name"),
		sizeBytes: integer("size_bytes"),
		error: text("error"),
		/** Finished exports/backups are purged after this (see services/maintenance.ts). */
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		startedAt: timestamp("started_at", { withTimezone: true }),
		finishedAt: timestamp("finished_at", { withTimezone: true }),
		...timestamps,
	},
	(t) => [
		index("backup_job_user_idx").on(t.userId),
		index("backup_job_workspace_idx").on(t.workspaceId),
		index("backup_job_status_idx").on(t.status),
		index("backup_job_expires_idx").on(t.expiresAt),
	]
);
