CREATE TYPE "backup_job_kind" AS ENUM('workspace_export', 'workspace_import', 'instance_backup', 'instance_restore');--> statement-breakpoint
CREATE TYPE "backup_job_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "backup_job_trigger" AS ENUM('manual', 'scheduled', 'safety', 'cli');--> statement-breakpoint
CREATE TABLE "backup_job" (
	"id" text PRIMARY KEY,
	"kind" "backup_job_kind" NOT NULL,
	"status" "backup_job_status" DEFAULT 'pending'::"backup_job_status" NOT NULL,
	"trigger" "backup_job_trigger" DEFAULT 'manual'::"backup_job_trigger" NOT NULL,
	"user_id" text,
	"workspace_id" text,
	"destination_id" text,
	"options" jsonb DEFAULT '{}' NOT NULL,
	"progress" jsonb DEFAULT '{}' NOT NULL,
	"log" jsonb DEFAULT '[]' NOT NULL,
	"result" jsonb,
	"file_key" text,
	"file_name" text,
	"size_bytes" integer,
	"error" text,
	"expires_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "backup_settings" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX "backup_job_user_idx" ON "backup_job" ("user_id");--> statement-breakpoint
CREATE INDEX "backup_job_workspace_idx" ON "backup_job" ("workspace_id");--> statement-breakpoint
CREATE INDEX "backup_job_status_idx" ON "backup_job" ("status");--> statement-breakpoint
CREATE INDEX "backup_job_expires_idx" ON "backup_job" ("expires_at");--> statement-breakpoint
ALTER TABLE "backup_job" ADD CONSTRAINT "backup_job_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "backup_job" ADD CONSTRAINT "backup_job_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE SET NULL;