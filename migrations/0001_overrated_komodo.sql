DO $$ BEGIN
 CREATE TYPE "asset_status" AS ENUM('active', 'down', 'unreachable');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "asset_type" AS ENUM('host', 'domain', 'ip', 'network', 'url');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "discovery_method" AS ENUM('bbot', 'nuclei', 'nmap', 'manual');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "scan_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "task_status" AS ENUM('pending', 'in_progress', 'completed', 'failed', 'skipped');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "task_type" AS ENUM('analyze', 'exploit', 'report', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "workflow_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"workflow_type" text NOT NULL,
	"target_id" uuid,
	"operation_id" uuid,
	"current_agent_id" uuid,
	"current_task_id" uuid,
	"status" "workflow_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"metadata" json DEFAULT '{}'::json,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ax_module_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" json DEFAULT '{}'::json NOT NULL,
	"credentials" json DEFAULT '{}'::json,
	"rate_limit" integer,
	"timeout" integer DEFAULT 1800000,
	"last_used" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ax_module_configs_module_name_unique" UNIQUE("module_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ax_scan_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid,
	"tool_name" text NOT NULL,
	"status" "scan_status" DEFAULT 'pending' NOT NULL,
	"targets" json NOT NULL,
	"config" json DEFAULT '{}'::json,
	"results" json DEFAULT '{}'::json,
	"assets_found" integer DEFAULT 0,
	"services_found" integer DEFAULT 0,
	"vulnerabilities_found" integer DEFAULT 0,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration" integer,
	"error_message" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discovered_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"surface_assessment_id" uuid,
	"operation_id" uuid,
	"type" "asset_type" NOT NULL,
	"value" text NOT NULL,
	"hostname" text,
	"ip_address" text,
	"status" "asset_status" DEFAULT 'active' NOT NULL,
	"discovery_method" "discovery_method" NOT NULL,
	"operating_system" text,
	"tags" json DEFAULT '[]'::json,
	"metadata" json DEFAULT '{}'::json,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discovered_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"name" text NOT NULL,
	"port" integer NOT NULL,
	"protocol" text DEFAULT 'tcp' NOT NULL,
	"version" text,
	"banner" text,
	"state" text DEFAULT 'open' NOT NULL,
	"discovery_method" "discovery_method" NOT NULL,
	"metadata" json DEFAULT '{}'::json,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "surface_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"total_assets" integer DEFAULT 0 NOT NULL,
	"total_services" integer DEFAULT 0 NOT NULL,
	"total_vulnerabilities" integer DEFAULT 0 NOT NULL,
	"last_scan_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vulnerability_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"severity" "severity" NOT NULL,
	"cvss_vector" text,
	"cwe_id" text,
	"remediation_template" text,
	"poc_template" text,
	"impact_template" text,
	"exploitability_template" text,
	"tags" json DEFAULT '[]'::json,
	"references" json DEFAULT '[]'::json,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vulnerability_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vulnerability_id" uuid NOT NULL,
	"data" json NOT NULL,
	"changed_by" uuid,
	"change_description" text,
	"change_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workflow_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"task_id" uuid,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"context" json DEFAULT '{}'::json,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workflow_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"task_type" "task_type" NOT NULL,
	"task_name" text NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"sequence_order" integer NOT NULL,
	"input_data" json DEFAULT '{}'::json,
	"output_data" json DEFAULT '{}'::json,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD COLUMN "status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD COLUMN "ai_generated" json DEFAULT '{}'::json;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vulnerabilities" ADD CONSTRAINT "vulnerabilities_template_id_vulnerability_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "vulnerability_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_workflows" ADD CONSTRAINT "agent_workflows_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "targets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_workflows" ADD CONSTRAINT "agent_workflows_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_workflows" ADD CONSTRAINT "agent_workflows_current_agent_id_agents_id_fk" FOREIGN KEY ("current_agent_id") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_workflows" ADD CONSTRAINT "agent_workflows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ax_scan_results" ADD CONSTRAINT "ax_scan_results_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ax_scan_results" ADD CONSTRAINT "ax_scan_results_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discovered_assets" ADD CONSTRAINT "discovered_assets_surface_assessment_id_surface_assessments_id_fk" FOREIGN KEY ("surface_assessment_id") REFERENCES "surface_assessments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discovered_assets" ADD CONSTRAINT "discovered_assets_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discovered_services" ADD CONSTRAINT "discovered_services_asset_id_discovered_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "discovered_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "surface_assessments" ADD CONSTRAINT "surface_assessments_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vulnerability_templates" ADD CONSTRAINT "vulnerability_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vulnerability_versions" ADD CONSTRAINT "vulnerability_versions_vulnerability_id_vulnerabilities_id_fk" FOREIGN KEY ("vulnerability_id") REFERENCES "vulnerabilities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vulnerability_versions" ADD CONSTRAINT "vulnerability_versions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow_logs" ADD CONSTRAINT "workflow_logs_workflow_id_agent_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "agent_workflows"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow_logs" ADD CONSTRAINT "workflow_logs_task_id_workflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "workflow_tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_workflow_id_agent_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "agent_workflows"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
