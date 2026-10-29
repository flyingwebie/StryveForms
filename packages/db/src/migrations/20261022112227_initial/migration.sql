CREATE TYPE "form_visibility" AS ENUM('public', 'draft', 'closed');--> statement-breakpoint
CREATE TYPE "submission_status" AS ENUM('completed', 'partial');--> statement-breakpoint
CREATE TYPE "workspace_role" AS ENUM('admin', 'user', 'readonly');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_token" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"abilities" jsonb DEFAULT '[]' NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"creator_id" text,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"visibility" "form_visibility" DEFAULT 'public'::"form_visibility" NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"properties" jsonb DEFAULT '[]' NOT NULL,
	"computed_variables" jsonb DEFAULT '[]' NOT NULL,
	"removed_properties" jsonb DEFAULT '[]' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"font_family" text,
	"custom_domain" text,
	"size" text DEFAULT 'md' NOT NULL,
	"border_radius" text DEFAULT 'small' NOT NULL,
	"theme" text DEFAULT 'default' NOT NULL,
	"presentation_style" text DEFAULT 'classic' NOT NULL,
	"width" text DEFAULT 'centered' NOT NULL,
	"layout_rtl" boolean DEFAULT false NOT NULL,
	"cover_picture" text,
	"cover_settings" jsonb,
	"logo_picture" text,
	"dark_mode" text DEFAULT 'light' NOT NULL,
	"color" text DEFAULT '#3B82F6' NOT NULL,
	"uppercase_labels" boolean DEFAULT false NOT NULL,
	"no_branding" boolean DEFAULT false NOT NULL,
	"transparent_background" boolean DEFAULT false NOT NULL,
	"translations" jsonb,
	"settings" jsonb DEFAULT '{}' NOT NULL,
	"custom_code" text,
	"custom_css" text,
	"submit_button_text" text,
	"database_fields_update" jsonb,
	"clear_empty_fields_on_update" boolean DEFAULT false NOT NULL,
	"re_fillable" boolean DEFAULT false NOT NULL,
	"re_fill_button_text" text,
	"submitted_text" text,
	"redirect_url" text,
	"use_captcha" boolean DEFAULT false NOT NULL,
	"captcha_provider" text DEFAULT 'recaptcha' NOT NULL,
	"closes_at" timestamp with time zone,
	"closed_text" text,
	"max_submissions_count" integer,
	"max_submissions_reached_text" text,
	"editable_submissions" boolean DEFAULT false NOT NULL,
	"editable_submissions_button_text" text,
	"pdf_download_enabled" boolean DEFAULT false NOT NULL,
	"pdf_download_button_text" text,
	"confetti_on_submission" boolean DEFAULT false NOT NULL,
	"show_progress_bar" boolean DEFAULT false NOT NULL,
	"auto_save" boolean DEFAULT true NOT NULL,
	"auto_focus" boolean DEFAULT true NOT NULL,
	"enable_partial_submissions" boolean DEFAULT false NOT NULL,
	"enable_ip_tracking" boolean DEFAULT false NOT NULL,
	"submission_retention_value" integer,
	"submission_retention_unit" text,
	"auto_increment_sequence" integer DEFAULT 0 NOT NULL,
	"can_be_indexed" boolean DEFAULT true NOT NULL,
	"password_hash" text,
	"seo_meta" jsonb DEFAULT '{}' NOT NULL,
	"analytics" jsonb DEFAULT '{}' NOT NULL,
	"legacy_opnform_id" integer,
	"legacy_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "form_integration" (
	"id" text PRIMARY KEY,
	"form_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"logic" jsonb,
	"settings" jsonb DEFAULT '{}' NOT NULL,
	"legacy_opnform_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "form_integration_event" (
	"id" serial PRIMARY KEY,
	"integration_id" text NOT NULL,
	"type" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_statistic" (
	"id" serial PRIMARY KEY,
	"form_id" text NOT NULL,
	"date" text NOT NULL,
	"data" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_submission" (
	"id" text PRIMARY KEY,
	"form_id" text NOT NULL,
	"public_id" text NOT NULL,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"status" "submission_status" DEFAULT 'completed'::"submission_status" NOT NULL,
	"completion_time" integer,
	"meta" jsonb DEFAULT '{}' NOT NULL,
	"legacy_opnform_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_version" (
	"id" text PRIMARY KEY,
	"form_id" text NOT NULL,
	"user_id" text,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_view" (
	"id" serial PRIMARY KEY,
	"form_id" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_job" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"source" text DEFAULT 'opnform' NOT NULL,
	"source_url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"options" jsonb DEFAULT '{}' NOT NULL,
	"progress" jsonb DEFAULT '{}' NOT NULL,
	"log" jsonb DEFAULT '[]' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_mapping" (
	"id" serial PRIMARY KEY,
	"source_url" text NOT NULL,
	"entity" text NOT NULL,
	"source_id" text NOT NULL,
	"target_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stored_file" (
	"id" text PRIMARY KEY,
	"workspace_id" text,
	"form_id" text,
	"submission_id" text,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text,
	"size" integer DEFAULT 0 NOT NULL,
	"temporary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template" (
	"id" text PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"short_description" text,
	"description" text,
	"image_url" text,
	"structure" jsonb NOT NULL,
	"questions" jsonb DEFAULT '[]' NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"publicly_listed" boolean DEFAULT false NOT NULL,
	"creator_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"icon" text,
	"settings" jsonb DEFAULT '{}' NOT NULL,
	"custom_domains" jsonb DEFAULT '[]' NOT NULL,
	"max_file_size" integer DEFAULT 50 NOT NULL,
	"legacy_opnform_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invite" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "workspace_role" DEFAULT 'user'::"workspace_role" NOT NULL,
	"token" text NOT NULL UNIQUE,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_member" (
	"workspace_id" text,
	"user_id" text,
	"role" "workspace_role" DEFAULT 'admin'::"workspace_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_member_pkey" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
CREATE INDEX "api_token_user_idx" ON "api_token" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "form_slug_unique" ON "form" ("slug");--> statement-breakpoint
CREATE INDEX "form_workspace_idx" ON "form" ("workspace_id");--> statement-breakpoint
CREATE INDEX "form_legacy_slug_idx" ON "form" ("legacy_slug");--> statement-breakpoint
CREATE INDEX "form_integration_form_idx" ON "form_integration" ("form_id");--> statement-breakpoint
CREATE INDEX "form_integration_event_idx" ON "form_integration_event" ("integration_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "form_statistic_form_date_unique" ON "form_statistic" ("form_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "form_submission_public_id_unique" ON "form_submission" ("public_id");--> statement-breakpoint
CREATE INDEX "form_submission_form_idx" ON "form_submission" ("form_id","created_at");--> statement-breakpoint
CREATE INDEX "form_version_form_idx" ON "form_version" ("form_id","created_at");--> statement-breakpoint
CREATE INDEX "form_view_form_idx" ON "form_view" ("form_id","created_at");--> statement-breakpoint
CREATE INDEX "import_job_user_idx" ON "import_job" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "import_mapping_unique" ON "import_mapping" ("source_url","entity","source_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stored_file_key_unique" ON "stored_file" ("key");--> statement-breakpoint
CREATE INDEX "stored_file_submission_idx" ON "stored_file" ("submission_id");--> statement-breakpoint
CREATE INDEX "workspace_invite_workspace_idx" ON "workspace_invite" ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_member_user_idx" ON "workspace_member" ("user_id");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form" ADD CONSTRAINT "form_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form" ADD CONSTRAINT "form_creator_id_user_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "form_integration" ADD CONSTRAINT "form_integration_form_id_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "form"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_integration_event" ADD CONSTRAINT "form_integration_event_integration_id_form_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "form_integration"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_statistic" ADD CONSTRAINT "form_statistic_form_id_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "form"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_submission" ADD CONSTRAINT "form_submission_form_id_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "form"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_version" ADD CONSTRAINT "form_version_form_id_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "form"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_version" ADD CONSTRAINT "form_version_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "form_view" ADD CONSTRAINT "form_view_form_id_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "form"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "import_mapping" ADD CONSTRAINT "import_mapping_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_form_id_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "form"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_submission_id_form_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "form_submission"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_creator_id_user_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD CONSTRAINT "workspace_invite_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD CONSTRAINT "workspace_invite_invited_by_id_user_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;