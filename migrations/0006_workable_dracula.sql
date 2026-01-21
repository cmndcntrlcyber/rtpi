CREATE TYPE "public"."agent_node_status" AS ENUM('pending', 'running', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."dependency_type" AS ENUM('required', 'optional', 'conditional');--> statement-breakpoint
CREATE TYPE "public"."workflow_instance_status" AS ENUM('pending', 'running', 'completed', 'failed', 'paused', 'cancelled');--> statement-breakpoint
CREATE TABLE "agent_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"capability" text NOT NULL,
	"input_types" json DEFAULT '[]'::json,
	"output_types" json DEFAULT '[]'::json,
	"priority" integer DEFAULT 0,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"metadata" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"depends_on_capability" text NOT NULL,
	"dependency_type" "dependency_type" DEFAULT 'required' NOT NULL,
	"condition" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attack_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"flow_data" json DEFAULT '{"nodes":[],"edges":[]}'::json NOT NULL,
	"is_template" boolean DEFAULT false,
	"is_shared" boolean DEFAULT false,
	"status" text DEFAULT 'draft',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" uuid NOT NULL,
	"metadata" json DEFAULT '{}'::json
);
--> statement-breakpoint
CREATE TABLE "nuclei_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" text NOT NULL,
	"name" text NOT NULL,
	"severity" "severity" NOT NULL,
	"category" text,
	"content" text NOT NULL,
	"file_path" text,
	"is_custom" boolean DEFAULT false NOT NULL,
	"generated_by_ai" boolean DEFAULT false NOT NULL,
	"target_vulnerability_id" uuid,
	"is_validated" boolean DEFAULT false NOT NULL,
	"validation_results" json DEFAULT '{}'::json,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"tags" json DEFAULT '[]'::json,
	"metadata" json DEFAULT '{}'::json,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nuclei_templates_template_id_unique" UNIQUE("template_id")
);
--> statement-breakpoint
CREATE TABLE "scan_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cron_expression" text NOT NULL,
	"tool_config" json NOT NULL,
	"targets" json NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run" timestamp,
	"next_run" timestamp,
	"run_count" integer DEFAULT 0,
	"failure_count" integer DEFAULT 0,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"workflow_data" json DEFAULT '{"nodes":[],"edges":[]}'::json NOT NULL,
	"is_template" boolean DEFAULT false,
	"is_shared" boolean DEFAULT false,
	"status" text DEFAULT 'draft',
	"category" text,
	"last_executed_at" timestamp,
	"execution_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" uuid NOT NULL,
	"metadata" json DEFAULT '{}'::json
);
--> statement-breakpoint
CREATE TABLE "workflow_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid,
	"operation_id" uuid,
	"status" "workflow_instance_status" DEFAULT 'pending' NOT NULL,
	"resolved_agents" json DEFAULT '[]'::json,
	"execution_graph" json DEFAULT '{}'::json,
	"current_phase" integer DEFAULT 0,
	"context" json DEFAULT '{}'::json,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_event" text,
	"required_capabilities" json DEFAULT '[]'::json NOT NULL,
	"optional_capabilities" json DEFAULT '[]'::json,
	"configuration" json DEFAULT '{}'::json,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "research_projects" ADD COLUMN "source_vulnerability_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_capabilities" ADD CONSTRAINT "agent_capabilities_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_dependencies" ADD CONSTRAINT "agent_dependencies_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attack_flows" ADD CONSTRAINT "attack_flows_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attack_flows" ADD CONSTRAINT "attack_flows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nuclei_templates" ADD CONSTRAINT "nuclei_templates_target_vulnerability_id_vulnerabilities_id_fk" FOREIGN KEY ("target_vulnerability_id") REFERENCES "public"."vulnerabilities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nuclei_templates" ADD CONSTRAINT "nuclei_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_schedules" ADD CONSTRAINT "scan_schedules_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_schedules" ADD CONSTRAINT "scan_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_workflows" ADD CONSTRAINT "tool_workflows_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_workflows" ADD CONSTRAINT "tool_workflows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_projects" ADD CONSTRAINT "research_projects_source_vulnerability_id_vulnerabilities_id_fk" FOREIGN KEY ("source_vulnerability_id") REFERENCES "public"."vulnerabilities"("id") ON DELETE set null ON UPDATE no action;