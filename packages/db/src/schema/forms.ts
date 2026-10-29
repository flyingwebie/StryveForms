import { defineRelationsPart } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

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
/*                          Instance (white-label) settings                   */
/* -------------------------------------------------------------------------- */

/** One row (id = "default") holding this installation's branding and access rules. */
export const instanceSettings = pgTable("instance_settings", {
	id: text("id").primaryKey(),
	name: text("name").default("StryveForms").notNull(),
	tagline: text("tagline"),
	logoUrl: text("logo_url"),
	logoDarkUrl: text("logo_dark_url"),
	faviconUrl: text("favicon_url"),
	primaryColor: text("primary_color").default("#7C3AED").notNull(),
	heroTitle: text("hero_title"),
	heroSubtitle: text("hero_subtitle"),
	/** `open`: anyone can sign up. `closed`: only people with a workspace invite. */
	registrationMode: text("registration_mode")
		.$type<"open" | "closed">()
		.default("open")
		.notNull(),
	/** When set, sign-ups are limited to these email domains (e.g. ["acme.com"]). */
	allowedEmailDomains: jsonb("allowed_email_domains")
		.$type<string[]>()
		.default([])
		.notNull(),
	supportEmail: text("support_email"),
	/** Email wrapper design (colours, logo, footer…). Shape: `EmailSettings` from @StryveForms/emails. */
	emailSettings: jsonb("email_settings")
		.$type<Record<string, unknown>>()
		.default({})
		.notNull(),
	/**
	 * Instance-wide AI agents & MCP toggles. Shape: `AgentSettings` from
	 * @StryveForms/api/services/agent/settings — `{ mcpEnabled, allowApiTokens,
	 * allowWriteTools }`. Read with defaults filled in via that module's
	 * `resolveAgentSettings`, never read raw off this column.
	 */
	agentSettings: jsonb("agent_settings")
		.$type<Record<string, unknown>>()
		.default({})
		.notNull(),
	/**
	 * Instance backup configuration: destinations, schedule, retention and the
	 * encrypted unattended passphrase. Shape: `BackupSettings` from
	 * @StryveForms/api/services/backup — read via that module's
	 * `resolveBackupSettings`, never raw off this column. Owner: engineer R
	 * (destinations.ts/scheduler.ts) builds on this; engineer P (backup core)
	 * owns the column itself.
	 */
	backupSettings: jsonb("backup_settings")
		.$type<Record<string, unknown>>()
		.default({})
		.notNull(),
	setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
	...timestamps,
});

/* -------------------------------------------------------------------------- */
/*                                 Workspaces                                 */
/* -------------------------------------------------------------------------- */

export const workspaceRole = pgEnum("workspace_role", [
	"admin",
	"user",
	"readonly",
]);

export const workspace = pgTable("workspace", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	icon: text("icon"),
	/** Workspace-wide settings: email sender, custom code, external file links… */
	settings: jsonb("settings")
		.$type<Record<string, unknown>>()
		.default({})
		.notNull(),
	customDomains: jsonb("custom_domains")
		.$type<string[]>()
		.default([])
		.notNull(),
	/** Brand guideline applied to the workspace's forms. Shape: `WorkspaceBrand` from @StryveForms/forms. */
	brand: jsonb("brand").$type<Record<string, unknown>>().default({}).notNull(),
	/** Max upload size per file, in MB. */
	maxFileSize: integer("max_file_size").default(50).notNull(),
	legacyOpnformId: integer("legacy_opnform_id"),
	...timestamps,
});

export const workspaceMember = pgTable(
	"workspace_member",
	{
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: workspaceRole("role").default("admin").notNull(),
		...timestamps,
	},
	(t) => [
		primaryKey({ columns: [t.workspaceId, t.userId] }),
		index("workspace_member_user_idx").on(t.userId),
	]
);

export const workspaceInvite = pgTable(
	"workspace_invite",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		role: workspaceRole("role").default("user").notNull(),
		token: text("token").notNull().unique(),
		status: text("status")
			.$type<"pending" | "accepted" | "cancelled">()
			.default("pending")
			.notNull(),
		invitedById: text("invited_by_id").references(() => user.id, {
			onDelete: "set null",
		}),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		...timestamps,
	},
	(t) => [index("workspace_invite_workspace_idx").on(t.workspaceId)]
);

/* -------------------------------------------------------------------------- */
/*                                    Forms                                   */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                                   Folders                                  */
/* -------------------------------------------------------------------------- */

/** Folders that organise a workspace's forms or templates in the sidebar. */
export const folder = pgTable(
	"folder",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		/** What the folder holds. */
		kind: text("kind").$type<"form" | "template">().default("form").notNull(),
		name: text("name").notNull(),
		/** Hex colour, e.g. "#7C3AED". */
		color: text("color"),
		/** lucide icon name or emoji. */
		icon: text("icon"),
		/** Optional parent for nested folders. */
		parentId: text("parent_id"),
		position: integer("position").default(0).notNull(),
		...timestamps,
	},
	(t) => [index("folder_workspace_idx").on(t.workspaceId, t.kind)]
);

export const formVisibility = pgEnum("form_visibility", [
	"public",
	"draft",
	"closed",
]);

export const form = pgTable(
	"form",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		creatorId: text("creator_id").references(() => user.id, {
			onDelete: "set null",
		}),
		folderId: text("folder_id").references(() => folder.id, {
			onDelete: "set null",
		}),
		title: text("title").notNull(),
		slug: text("slug").notNull(),
		visibility: formVisibility("visibility").default("public").notNull(),
		tags: jsonb("tags").$type<string[]>().default([]).notNull(),

		/** Ordered list of fields/blocks. Shape: `FormField[]` from @StryveForms/forms. */
		properties: jsonb("properties").$type<unknown[]>().default([]).notNull(),
		computedVariables: jsonb("computed_variables")
			.$type<unknown[]>()
			.default([])
			.notNull(),
		removedProperties: jsonb("removed_properties")
			.$type<unknown[]>()
			.default([])
			.notNull(),

		/* Customization */
		language: text("language").default("en").notNull(),
		fontFamily: text("font_family"),
		customDomain: text("custom_domain"),
		size: text("size").default("md").notNull(),
		borderRadius: text("border_radius").default("small").notNull(),
		theme: text("theme").default("default").notNull(),
		presentationStyle: text("presentation_style").default("classic").notNull(),
		width: text("width").default("centered").notNull(),
		layoutRtl: boolean("layout_rtl").default(false).notNull(),
		coverPicture: text("cover_picture"),
		coverSettings: jsonb("cover_settings").$type<Record<string, unknown>>(),
		logoPicture: text("logo_picture"),
		darkMode: text("dark_mode").default("light").notNull(),
		color: text("color").default("#3B82F6").notNull(),
		uppercaseLabels: boolean("uppercase_labels").default(false).notNull(),
		/** Follow the workspace brand guideline (see @StryveForms/forms/brand). */
		useWorkspaceBrand: boolean("use_workspace_brand").default(false).notNull(),
		/** Brand keys this form sets itself while following the workspace brand. */
		brandOverrides: jsonb("brand_overrides")
			.$type<string[]>()
			.default([])
			.notNull(),
		noBranding: boolean("no_branding").default(false).notNull(),
		transparentBackground: boolean("transparent_background")
			.default(false)
			.notNull(),
		translations: jsonb("translations").$type<Record<string, unknown>>(),
		settings: jsonb("settings")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),

		/* Custom code */
		customCode: text("custom_code"),
		customCss: text("custom_css"),

		/* Submission behaviour */
		submitButtonText: text("submit_button_text"),
		databaseFieldsUpdate: jsonb("database_fields_update").$type<string[]>(),
		clearEmptyFieldsOnUpdate: boolean("clear_empty_fields_on_update")
			.default(false)
			.notNull(),
		reFillable: boolean("re_fillable").default(false).notNull(),
		reFillButtonText: text("re_fill_button_text"),
		submittedText: text("submitted_text"),
		redirectUrl: text("redirect_url"),
		useCaptcha: boolean("use_captcha").default(false).notNull(),
		captchaProvider: text("captcha_provider").default("recaptcha").notNull(),
		closesAt: timestamp("closes_at", { withTimezone: true }),
		closedText: text("closed_text"),
		maxSubmissionsCount: integer("max_submissions_count"),
		maxSubmissionsReachedText: text("max_submissions_reached_text"),
		editableSubmissions: boolean("editable_submissions")
			.default(false)
			.notNull(),
		editableSubmissionsButtonText: text("editable_submissions_button_text"),
		pdfDownloadEnabled: boolean("pdf_download_enabled")
			.default(false)
			.notNull(),
		pdfDownloadButtonText: text("pdf_download_button_text"),
		confettiOnSubmission: boolean("confetti_on_submission")
			.default(false)
			.notNull(),
		showProgressBar: boolean("show_progress_bar").default(false).notNull(),
		autoSave: boolean("auto_save").default(true).notNull(),
		autoFocus: boolean("auto_focus").default(true).notNull(),
		enablePartialSubmissions: boolean("enable_partial_submissions")
			.default(false)
			.notNull(),
		enableIpTracking: boolean("enable_ip_tracking").default(false).notNull(),
		submissionRetentionValue: integer("submission_retention_value"),
		submissionRetentionUnit: text("submission_retention_unit"),
		autoIncrementSequence: integer("auto_increment_sequence")
			.default(0)
			.notNull(),

		/* Security & privacy */
		canBeIndexed: boolean("can_be_indexed").default(true).notNull(),
		/** Hashed access password (Bun.password). Null = no password. */
		passwordHash: text("password_hash"),

		/* SEO & analytics */
		seoMeta: jsonb("seo_meta")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		analytics: jsonb("analytics")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),

		/* Migration bookkeeping */
		legacyOpnformId: integer("legacy_opnform_id"),
		legacySlug: text("legacy_slug"),

		...timestamps,
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(t) => [
		uniqueIndex("form_slug_unique").on(t.slug),
		index("form_workspace_idx").on(t.workspaceId),
		index("form_legacy_slug_idx").on(t.legacySlug),
	]
);

export const submissionStatus = pgEnum("submission_status", [
	"completed",
	"partial",
]);

export const formSubmission = pgTable(
	"form_submission",
	{
		id: text("id").primaryKey(),
		formId: text("form_id")
			.notNull()
			.references(() => form.id, { onDelete: "cascade" }),
		/** Unguessable id used for public “edit your submission” links. */
		publicId: text("public_id").notNull(),
		data: jsonb("data").$type<Record<string, unknown>>().default({}).notNull(),
		status: submissionStatus("status").default("completed").notNull(),
		/** Seconds the respondent spent filling the form. */
		completionTime: integer("completion_time"),
		meta: jsonb("meta").$type<Record<string, unknown>>().default({}).notNull(),
		legacyOpnformId: integer("legacy_opnform_id"),
		...timestamps,
	},
	(t) => [
		uniqueIndex("form_submission_public_id_unique").on(t.publicId),
		index("form_submission_form_idx").on(t.formId, t.createdAt),
	]
);

export const formView = pgTable(
	"form_view",
	{
		id: serial("id").primaryKey(),
		formId: text("form_id")
			.notNull()
			.references(() => form.id, { onDelete: "cascade" }),
		meta: jsonb("meta").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [index("form_view_form_idx").on(t.formId, t.createdAt)]
);

/** Daily rollups (also used to hold imported OpnForm statistics). */
export const formStatistic = pgTable(
	"form_statistic",
	{
		id: serial("id").primaryKey(),
		formId: text("form_id")
			.notNull()
			.references(() => form.id, { onDelete: "cascade" }),
		date: text("date").notNull(),
		data: jsonb("data").$type<{ views?: number }>().default({}).notNull(),
	},
	(t) => [uniqueIndex("form_statistic_form_date_unique").on(t.formId, t.date)]
);

export const formVersion = pgTable(
	"form_version",
	{
		id: text("id").primaryKey(),
		formId: text("form_id")
			.notNull()
			.references(() => form.id, { onDelete: "cascade" }),
		userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
		snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [index("form_version_form_idx").on(t.formId, t.createdAt)]
);

/* -------------------------------------------------------------------------- */
/*                                Integrations                                */
/* -------------------------------------------------------------------------- */

export const formIntegration = pgTable(
	"form_integration",
	{
		id: text("id").primaryKey(),
		formId: text("form_id")
			.notNull()
			.references(() => form.id, { onDelete: "cascade" }),
		/** Integration type, e.g. `email`, `webhook`, `slack`, `discord`, `telegram`. */
		integrationId: text("integration_id").notNull(),
		status: text("status")
			.$type<"active" | "inactive">()
			.default("active")
			.notNull(),
		data: jsonb("data").$type<Record<string, unknown>>().default({}).notNull(),
		logic: jsonb("logic").$type<Record<string, unknown> | null>(),
		settings: jsonb("settings")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		legacyOpnformId: integer("legacy_opnform_id"),
		...timestamps,
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(t) => [index("form_integration_form_idx").on(t.formId)]
);

export const formIntegrationEvent = pgTable(
	"form_integration_event",
	{
		id: serial("id").primaryKey(),
		integrationId: text("integration_id")
			.notNull()
			.references(() => formIntegration.id, { onDelete: "cascade" }),
		type: text("type").$type<"success" | "error">().notNull(),
		data: jsonb("data").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [index("form_integration_event_idx").on(t.integrationId, t.createdAt)]
);

/* -------------------------------------------------------------------------- */
/*                                    Files                                   */
/* -------------------------------------------------------------------------- */

export const storedFile = pgTable(
	"stored_file",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id").references(() => workspace.id, {
			onDelete: "cascade",
		}),
		formId: text("form_id").references(() => form.id, { onDelete: "cascade" }),
		submissionId: text("submission_id").references(() => formSubmission.id, {
			onDelete: "cascade",
		}),
		/** `upload` = respondent file, `asset` = form image/logo/cover, `signature`. */
		kind: text("kind").$type<"upload" | "asset" | "signature">().notNull(),
		/** Key inside the storage driver (local disk or S3). */
		key: text("key").notNull(),
		originalName: text("original_name").notNull(),
		mimeType: text("mime_type"),
		size: integer("size").default(0).notNull(),
		/** Temporary uploads not yet attached to a submission. */
		temporary: boolean("temporary").default(false).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		uniqueIndex("stored_file_key_unique").on(t.key),
		index("stored_file_submission_idx").on(t.submissionId),
	]
);

/* -------------------------------------------------------------------------- */
/*                          Templates & API tokens                            */
/* -------------------------------------------------------------------------- */

/**
 * Form templates. `workspaceId` null = built-in/public template; otherwise a
 * custom template saved by a workspace.
 */
export const template = pgTable("template", {
	id: text("id").primaryKey(),
	workspaceId: text("workspace_id").references(() => workspace.id, {
		onDelete: "cascade",
	}),
	folderId: text("folder_id").references(() => folder.id, {
		onDelete: "set null",
	}),
	category: text("category"),
	color: text("color"),
	icon: text("icon"),
	slug: text("slug").notNull().unique(),
	name: text("name").notNull(),
	shortDescription: text("short_description"),
	description: text("description"),
	imageUrl: text("image_url"),
	structure: jsonb("structure").$type<Record<string, unknown>>().notNull(),
	questions: jsonb("questions")
		.$type<{ question: string; answer: string }[]>()
		.default([])
		.notNull(),
	tags: jsonb("tags").$type<string[]>().default([]).notNull(),
	publiclyListed: boolean("publicly_listed").default(false).notNull(),
	creatorId: text("creator_id").references(() => user.id, {
		onDelete: "set null",
	}),
	...timestamps,
});

export const apiToken = pgTable(
	"api_token",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		/** SHA-256 of the token. The plain token is only shown once. */
		tokenHash: text("token_hash").notNull().unique(),
		abilities: jsonb("abilities").$type<string[]>().default([]).notNull(),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [index("api_token_user_idx").on(t.userId)]
);

/* -------------------------------------------------------------------------- */
/*                              OpnForm migration                             */
/* -------------------------------------------------------------------------- */

export const importJob = pgTable(
	"import_job",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		source: text("source")
			.$type<"opnform" | "jotform">()
			.default("opnform")
			.notNull(),
		/** Base URL of the source API, e.g. https://api.opnform.com */
		sourceUrl: text("source_url").notNull(),
		status: text("status")
			.$type<"pending" | "running" | "completed" | "failed" | "cancelled">()
			.default("pending")
			.notNull(),
		/** What the user selected: workspaces, forms and options. */
		options: jsonb("options")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		progress: jsonb("progress")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		log: jsonb("log")
			.$type<{ at: string; level: string; message: string }[]>()
			.default([])
			.notNull(),
		error: text("error"),
		startedAt: timestamp("started_at", { withTimezone: true }),
		finishedAt: timestamp("finished_at", { withTimezone: true }),
		...timestamps,
	},
	(t) => [index("import_job_user_idx").on(t.userId)]
);

/** Maps OpnForm ids to StryveForms ids so re-running an import updates instead of duplicating. */
export const importMapping = pgTable(
	"import_mapping",
	{
		id: serial("id").primaryKey(),
		/** Normalised source base URL so two OpnForm instances never collide. */
		sourceUrl: text("source_url").notNull(),
		entity: text("entity")
			.$type<"workspace" | "form" | "submission" | "integration" | "file">()
			.notNull(),
		sourceId: text("source_id").notNull(),
		targetId: text("target_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		uniqueIndex("import_mapping_unique").on(
			t.sourceUrl,
			t.entity,
			t.sourceId,
			t.userId
		),
	]
);

/* -------------------------------------------------------------------------- */
/*                                  Relations                                 */
/* -------------------------------------------------------------------------- */

export const formRelations = defineRelationsPart(
	{
		user,
		workspace,
		workspaceMember,
		workspaceInvite,
		form,
		formSubmission,
		formView,
		formIntegration,
		formIntegrationEvent,
		formVersion,
		storedFile,
	},
	(r) => ({
		workspace: {
			members: r.many.workspaceMember({
				from: r.workspace.id,
				to: r.workspaceMember.workspaceId,
			}),
			forms: r.many.form({ from: r.workspace.id, to: r.form.workspaceId }),
			invites: r.many.workspaceInvite({
				from: r.workspace.id,
				to: r.workspaceInvite.workspaceId,
			}),
		},
		workspaceMember: {
			workspace: r.one.workspace({
				from: r.workspaceMember.workspaceId,
				to: r.workspace.id,
				optional: false,
			}),
			user: r.one.user({
				from: r.workspaceMember.userId,
				to: r.user.id,
				optional: false,
			}),
		},
		workspaceInvite: {
			workspace: r.one.workspace({
				from: r.workspaceInvite.workspaceId,
				to: r.workspace.id,
				optional: false,
			}),
		},
		form: {
			workspace: r.one.workspace({
				from: r.form.workspaceId,
				to: r.workspace.id,
				optional: false,
			}),
			creator: r.one.user({ from: r.form.creatorId, to: r.user.id }),
			submissions: r.many.formSubmission({
				from: r.form.id,
				to: r.formSubmission.formId,
			}),
			integrations: r.many.formIntegration({
				from: r.form.id,
				to: r.formIntegration.formId,
			}),
			versions: r.many.formVersion({
				from: r.form.id,
				to: r.formVersion.formId,
			}),
		},
		formSubmission: {
			form: r.one.form({
				from: r.formSubmission.formId,
				to: r.form.id,
				optional: false,
			}),
			files: r.many.storedFile({
				from: r.formSubmission.id,
				to: r.storedFile.submissionId,
			}),
		},
		formIntegration: {
			form: r.one.form({
				from: r.formIntegration.formId,
				to: r.form.id,
				optional: false,
			}),
			events: r.many.formIntegrationEvent({
				from: r.formIntegration.id,
				to: r.formIntegrationEvent.integrationId,
			}),
		},
		formIntegrationEvent: {
			integration: r.one.formIntegration({
				from: r.formIntegrationEvent.integrationId,
				to: r.formIntegration.id,
				optional: false,
			}),
		},
	})
);
