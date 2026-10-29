ALTER TABLE "form" ADD COLUMN "use_workspace_brand" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "form" ADD COLUMN "brand_overrides" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "email_settings" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "brand" jsonb DEFAULT '{}' NOT NULL;