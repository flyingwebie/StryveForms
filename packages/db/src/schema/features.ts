import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { form, workspace } from "./forms";

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
/*                                PDF templates                               */
/* -------------------------------------------------------------------------- */

/**
 * A PDF layout generated for each submission: an uploaded PDF (or blank
 * pages) with zones that print answers or static text.
 */
export const pdfTemplate = pgTable(
	"pdf_template",
	{
		id: text("id").primaryKey(),
		formId: text("form_id")
			.notNull()
			.references(() => form.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		/** File name pattern, e.g. "{form_title}-{submission_id}". */
		filenamePattern: text("filename_pattern")
			.default("{form_title}-{submission_id}")
			.notNull(),
		/** Storage key of the uploaded base PDF; null = created from scratch. */
		sourceFileKey: text("source_file_key"),
		/** Page sizes (points) and backgrounds. */
		pages: jsonb("pages").$type<unknown[]>().default([]).notNull(),
		/** Positioned zones (field answer, static text, image…) per page. */
		zones: jsonb("zones").$type<unknown[]>().default([]).notNull(),
		/** Extra options (fonts, margins, attach to emails…). */
		settings: jsonb("settings")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		enabled: boolean("enabled").default(true).notNull(),
		creatorId: text("creator_id").references(() => user.id, {
			onDelete: "set null",
		}),
		...timestamps,
	},
	(t) => [index("pdf_template_form_idx").on(t.formId)]
);

/* -------------------------------------------------------------------------- */
/*                                AI assistant                                */
/* -------------------------------------------------------------------------- */

/** A workspace's own AI provider key (bring your own key), encrypted at rest. */
export const aiCredential = pgTable(
	"ai_credential",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		/** openai, anthropic, gemini, openrouter, ollama… */
		provider: text("provider").notNull(),
		model: text("model").notNull(),
		/** AES-GCM encrypted API key (never returned to the browser). */
		encryptedKey: text("encrypted_key"),
		/** Custom endpoint (Ollama, OpenAI-compatible gateways). */
		baseUrl: text("base_url"),
		createdBy: text("created_by").references(() => user.id, {
			onDelete: "set null",
		}),
		...timestamps,
	},
	(t) => [uniqueIndex("ai_credential_workspace_idx").on(t.workspaceId)]
);

/** A conversation with the assistant, optionally about one form. */
export const aiChat = pgTable(
	"ai_chat",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		formId: text("form_id").references(() => form.id, {
			onDelete: "set null",
		}),
		title: text("title").default("New chat").notNull(),
		messages: jsonb("messages").$type<unknown[]>().default([]).notNull(),
		...timestamps,
	},
	(t) => [index("ai_chat_user_idx").on(t.workspaceId, t.userId)]
);
