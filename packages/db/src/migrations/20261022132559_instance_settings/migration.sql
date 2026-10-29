CREATE TABLE "instance_settings" (
	"id" text PRIMARY KEY,
	"name" text DEFAULT 'StryveForms' NOT NULL,
	"tagline" text,
	"logo_url" text,
	"logo_dark_url" text,
	"favicon_url" text,
	"primary_color" text DEFAULT '#7C3AED' NOT NULL,
	"hero_title" text,
	"hero_subtitle" text,
	"registration_mode" text DEFAULT 'open' NOT NULL,
	"allowed_email_domains" jsonb DEFAULT '[]' NOT NULL,
	"support_email" text,
	"setup_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;