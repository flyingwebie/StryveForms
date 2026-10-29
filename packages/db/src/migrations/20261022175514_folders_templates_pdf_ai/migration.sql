CREATE TABLE "ai_chat" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"form_id" text,
	"title" text DEFAULT 'New chat' NOT NULL,
	"messages" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_credential" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"encrypted_key" text,
	"base_url" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pdf_template" (
	"id" text PRIMARY KEY,
	"form_id" text NOT NULL,
	"name" text NOT NULL,
	"filename_pattern" text DEFAULT '{form_title}-{submission_id}' NOT NULL,
	"source_file_key" text,
	"pages" jsonb DEFAULT '[]' NOT NULL,
	"zones" jsonb DEFAULT '[]' NOT NULL,
	"settings" jsonb DEFAULT '{}' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"creator_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folder" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"kind" text DEFAULT 'form' NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"icon" text,
	"parent_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form" ADD COLUMN "folder_id" text;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "folder_id" text;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "icon" text;--> statement-breakpoint
CREATE INDEX "ai_chat_user_idx" ON "ai_chat" ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credential_workspace_idx" ON "ai_credential" ("workspace_id");--> statement-breakpoint
CREATE INDEX "pdf_template_form_idx" ON "pdf_template" ("form_id");--> statement-breakpoint
CREATE INDEX "folder_workspace_idx" ON "folder" ("workspace_id","kind");--> statement-breakpoint
ALTER TABLE "ai_chat" ADD CONSTRAINT "ai_chat_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ai_chat" ADD CONSTRAINT "ai_chat_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ai_chat" ADD CONSTRAINT "ai_chat_form_id_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "form"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "ai_credential" ADD CONSTRAINT "ai_credential_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ai_credential" ADD CONSTRAINT "ai_credential_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "pdf_template" ADD CONSTRAINT "pdf_template_form_id_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "form"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pdf_template" ADD CONSTRAINT "pdf_template_creator_id_user_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form" ADD CONSTRAINT "form_folder_id_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folder"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_folder_id_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folder"("id") ON DELETE SET NULL;