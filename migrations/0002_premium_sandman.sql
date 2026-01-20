CREATE TYPE "public"."agent_architecture" AS ENUM('x64', 'x86', 'arm64');--> statement-breakpoint
CREATE TYPE "public"."agent_build_status" AS ENUM('pending', 'building', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."agent_platform" AS ENUM('windows', 'linux');--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('ollama', 'openai', 'anthropic', 'llama.cpp');--> statement-breakpoint
CREATE TYPE "public"."attack_object_type" AS ENUM('technique', 'tactic', 'group', 'software', 'mitigation', 'data-source', 'campaign');--> statement-breakpoint
CREATE TYPE "public"."attack_platform" AS ENUM('Windows', 'macOS', 'Linux', 'Cloud', 'Network', 'Containers', 'IaaS', 'SaaS', 'Office 365', 'Azure AD', 'Google Workspace', 'PRE');--> statement-breakpoint
CREATE TYPE "public"."empire_agent_status" AS ENUM('active', 'pending', 'lost', 'killed');--> statement-breakpoint
CREATE TYPE "public"."empire_listener_type" AS ENUM('http', 'https', 'http_foreign', 'http_hop', 'http_mapi', 'onedrive', 'redirector');--> statement-breakpoint
CREATE TYPE "public"."empire_task_status" AS ENUM('queued', 'sent', 'completed', 'error');--> statement-breakpoint
CREATE TYPE "public"."health_status" AS ENUM('healthy', 'degraded', 'unhealthy', 'critical');--> statement-breakpoint
CREATE TYPE "public"."implant_status" AS ENUM('registered', 'connected', 'idle', 'busy', 'disconnected', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."implant_type" AS ENUM('reconnaissance', 'exploitation', 'exfiltration', 'general');--> statement-breakpoint
CREATE TYPE "public"."install_method" AS ENUM('apt', 'pip', 'npm', 'go-install', 'cargo', 'docker', 'github-binary', 'github-source', 'manual');--> statement-breakpoint
CREATE TYPE "public"."install_status" AS ENUM('pending', 'installing', 'installed', 'failed', 'updating');--> statement-breakpoint
CREATE TYPE "public"."manager_task_type" AS ENUM('synthesis', 'status_update', 'question_generation', 'coordination', 'analysis');--> statement-breakpoint
CREATE TYPE "public"."ollama_model_status" AS ENUM('available', 'downloading', 'loading', 'loaded', 'unloaded', 'error');--> statement-breakpoint
CREATE TYPE "public"."output_format" AS ENUM('json', 'xml', 'csv', 'text', 'nmap-xml', 'custom');--> statement-breakpoint
CREATE TYPE "public"."parameter_type" AS ENUM('string', 'number', 'boolean', 'array', 'file', 'ip-address', 'cidr', 'url', 'port', 'enum');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('pending', 'answered', 'dismissed', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('context', 'scope', 'priority', 'classification', 'verification');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('hourly_status', 'milestone', 'roadblock', 'change_detection', 'issue_report');--> statement-breakpoint
CREATE TYPE "public"."rust_nexus_certificate_type" AS ENUM('ca', 'server', 'client');--> statement-breakpoint
CREATE TYPE "public"."rust_nexus_task_status" AS ENUM('queued', 'assigned', 'running', 'completed', 'failed', 'timeout', 'cancelled', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."rust_nexus_task_type" AS ENUM('shell_command', 'file_transfer', 'process_execution', 'network_scan', 'credential_harvest', 'privilege_escalation', 'lateral_movement', 'data_collection', 'persistence', 'custom');--> statement-breakpoint
CREATE TYPE "public"."tool_category" AS ENUM('reconnaissance', 'scanning', 'exploitation', 'post-exploitation', 'wireless', 'web-application', 'password-cracking', 'forensics', 'social-engineering', 'reporting', 'other');--> statement-breakpoint
CREATE TYPE "public"."tool_execution_status" AS ENUM('pending', 'running', 'completed', 'failed', 'timeout', 'cancelled');--> statement-breakpoint
CREATE TABLE "agent_activity_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"agent_page_role" text NOT NULL,
	"operation_id" uuid,
	"target_id" uuid,
	"report_type" "report_type" DEFAULT 'hourly_status' NOT NULL,
	"report_period_start" timestamp NOT NULL,
	"report_period_end" timestamp NOT NULL,
	"activity_summary" text,
	"key_metrics" json DEFAULT '{}'::json,
	"page_state" json DEFAULT '{}'::json,
	"changes_detected" json DEFAULT '[]'::json,
	"issues_reported" json DEFAULT '[]'::json,
	"recommendations" json DEFAULT '[]'::json,
	"status" text DEFAULT 'submitted' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	"metadata" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_builds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "agent_build_status" DEFAULT 'pending' NOT NULL,
	"platform" "agent_platform" NOT NULL,
	"architecture" "agent_architecture" DEFAULT 'x64' NOT NULL,
	"features" json DEFAULT '[]'::json,
	"binary_path" text,
	"binary_size" integer,
	"binary_hash" text,
	"build_log" text,
	"build_duration_ms" integer,
	"error_message" text,
	"metadata" json DEFAULT '{}'::json,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"platform" "agent_platform" NOT NULL,
	"architecture" "agent_architecture" DEFAULT 'x64' NOT NULL,
	"build_id" uuid,
	"certificate_id" uuid,
	"certificate_serial" text NOT NULL,
	"certificate_fingerprint" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_hash" text NOT NULL,
	"controller_url" text NOT NULL,
	"implant_type" "implant_type" DEFAULT 'general',
	"is_active" boolean DEFAULT true NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"metadata" json DEFAULT '{}'::json,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_download_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"bundle_id" uuid NOT NULL,
	"max_downloads" integer DEFAULT 1 NOT NULL,
	"current_downloads" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"allowed_ip_ranges" json DEFAULT '[]'::json,
	"description" text,
	"metadata" json DEFAULT '{}'::json,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"revoked_by" uuid,
	CONSTRAINT "agent_download_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "ai_enrichment_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vulnerability_id" uuid,
	"model_used" text NOT NULL,
	"provider" "ai_provider" DEFAULT 'ollama' NOT NULL,
	"enrichment_type" text NOT NULL,
	"prompt" text NOT NULL,
	"response" text,
	"tokens_used" integer,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"duration_ms" integer,
	"temperature" real DEFAULT 0.7,
	"max_tokens" integer,
	"success" boolean DEFAULT true,
	"error_message" text,
	"metadata" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid,
	"operation_id" uuid,
	"question" text NOT NULL,
	"question_type" "question_type" NOT NULL,
	"asked_by" uuid NOT NULL,
	"answer" text,
	"answer_source" text,
	"answered_by_user_id" uuid,
	"answered_by_agent_id" uuid,
	"evidence" json DEFAULT '{}'::json,
	"confidence" real,
	"status" "question_status" DEFAULT 'pending' NOT NULL,
	"follow_up_questions" json DEFAULT '[]'::json,
	"asked_at" timestamp DEFAULT now() NOT NULL,
	"answered_at" timestamp,
	"reviewed_at" timestamp,
	"user_feedback" text,
	"helpful" boolean,
	"metadata" json DEFAULT '{}'::json
);
--> statement-breakpoint
CREATE TABLE "attack_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attack_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"aliases" text[],
	"first_seen" timestamp,
	"last_seen" timestamp,
	"stix_id" text,
	"version" text,
	"created" timestamp,
	"modified" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"metadata" json DEFAULT '{}'::json,
	"external_references" json DEFAULT '[]'::json,
	"x_mitre_version" text,
	"x_mitre_first_seen_citation" text,
	"x_mitre_last_seen_citation" text,
	CONSTRAINT "attack_campaigns_attack_id_unique" UNIQUE("attack_id"),
	CONSTRAINT "attack_campaigns_stix_id_unique" UNIQUE("stix_id")
);
--> statement-breakpoint
CREATE TABLE "attack_data_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attack_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"stix_id" text,
	"platforms" "attack_platform"[],
	"collection_layers" text[],
	"data_components" json DEFAULT '[]'::json,
	"version" text,
	"created" timestamp,
	"modified" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"metadata" json DEFAULT '{}'::json,
	"external_references" json DEFAULT '[]'::json,
	"x_mitre_version" text,
	CONSTRAINT "attack_data_sources_attack_id_unique" UNIQUE("attack_id"),
	CONSTRAINT "attack_data_sources_stix_id_unique" UNIQUE("stix_id")
);
--> statement-breakpoint
CREATE TABLE "attack_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attack_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"aliases" text[],
	"stix_id" text,
	"version" text,
	"created" timestamp,
	"modified" timestamp,
	"deprecated" boolean DEFAULT false,
	"revoked" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"metadata" json DEFAULT '{}'::json,
	"external_references" json DEFAULT '[]'::json,
	"x_mitre_version" text,
	"x_mitre_contributors" text[],
	CONSTRAINT "attack_groups_attack_id_unique" UNIQUE("attack_id"),
	CONSTRAINT "attack_groups_stix_id_unique" UNIQUE("stix_id")
);
--> statement-breakpoint
CREATE TABLE "attack_mitigations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attack_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"stix_id" text,
	"version" text,
	"created" timestamp,
	"modified" timestamp,
	"deprecated" boolean DEFAULT false,
	"revoked" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"metadata" json DEFAULT '{}'::json,
	"external_references" json DEFAULT '[]'::json,
	"x_mitre_version" text,
	CONSTRAINT "attack_mitigations_attack_id_unique" UNIQUE("attack_id"),
	CONSTRAINT "attack_mitigations_stix_id_unique" UNIQUE("stix_id")
);
--> statement-breakpoint
CREATE TABLE "attack_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stix_id" text,
	"relationship_type" text NOT NULL,
	"source_type" "attack_object_type" NOT NULL,
	"source_ref" text NOT NULL,
	"target_type" "attack_object_type" NOT NULL,
	"target_ref" text NOT NULL,
	"description" text,
	"created" timestamp,
	"modified" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"metadata" json DEFAULT '{}'::json,
	CONSTRAINT "attack_relationships_stix_id_unique" UNIQUE("stix_id")
);
--> statement-breakpoint
CREATE TABLE "attack_software" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attack_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"software_type" text,
	"aliases" text[],
	"platforms" "attack_platform"[],
	"stix_id" text,
	"version" text,
	"created" timestamp,
	"modified" timestamp,
	"deprecated" boolean DEFAULT false,
	"revoked" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"metadata" json DEFAULT '{}'::json,
	"external_references" json DEFAULT '[]'::json,
	"x_mitre_version" text,
	"x_mitre_contributors" text[],
	"x_mitre_platforms" text[],
	CONSTRAINT "attack_software_attack_id_unique" UNIQUE("attack_id"),
	CONSTRAINT "attack_software_stix_id_unique" UNIQUE("stix_id")
);
--> statement-breakpoint
CREATE TABLE "attack_tactics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attack_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"short_name" text,
	"x_mitre_shortname" text,
	"stix_id" text,
	"created" timestamp,
	"modified" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"metadata" json DEFAULT '{}'::json,
	CONSTRAINT "attack_tactics_attack_id_unique" UNIQUE("attack_id"),
	CONSTRAINT "attack_tactics_stix_id_unique" UNIQUE("stix_id")
);
--> statement-breakpoint
CREATE TABLE "attack_technique_tactics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technique_id" uuid NOT NULL,
	"tactic_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attack_techniques" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attack_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_subtechnique" boolean DEFAULT false,
	"parent_technique_id" uuid,
	"stix_id" text,
	"kill_chain_phases" text[],
	"platforms" "attack_platform"[],
	"permissions_required" text[],
	"effective_permissions" text[],
	"defense_bypassed" text[],
	"data_sources" text[],
	"detection" text,
	"version" text,
	"created" timestamp,
	"modified" timestamp,
	"deprecated" boolean DEFAULT false,
	"revoked" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"metadata" json DEFAULT '{}'::json,
	"external_references" json DEFAULT '[]'::json,
	"x_mitre_version" text,
	"x_mitre_detection" text,
	"x_mitre_data_sources" text[],
	"x_mitre_contributors" text[],
	"x_mitre_platforms" text[],
	"x_mitre_is_subtechnique" boolean DEFAULT false,
	"x_mitre_impact_type" text[],
	CONSTRAINT "attack_techniques_attack_id_unique" UNIQUE("attack_id"),
	CONSTRAINT "attack_techniques_stix_id_unique" UNIQUE("stix_id")
);
--> statement-breakpoint
CREATE TABLE "empire_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"listener_id" uuid,
	"target_id" uuid,
	"operation_id" uuid,
	"empire_agent_id" text NOT NULL,
	"session_id" text NOT NULL,
	"name" text NOT NULL,
	"hostname" text,
	"internal_ip" text,
	"external_ip" text,
	"username" text,
	"high_integrity" boolean DEFAULT false,
	"process_name" text,
	"process_id" integer,
	"language" text,
	"language_version" text,
	"os_details" text,
	"architecture" text,
	"domain" text,
	"status" "empire_agent_status" DEFAULT 'pending',
	"checkin_time" timestamp,
	"lastseen_time" timestamp,
	"delay" integer DEFAULT 5,
	"jitter" integer DEFAULT 0,
	"lost_limit" integer DEFAULT 60,
	"kill_date" text,
	"working_hours" text,
	"session_key" text,
	"nonce" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"metadata" json DEFAULT '{}'::json
);
--> statement-breakpoint
CREATE TABLE "empire_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"agent_id" uuid,
	"operation_id" uuid,
	"empire_credential_id" text,
	"cred_type" text NOT NULL,
	"domain" text,
	"username" text NOT NULL,
	"password" text,
	"ntlm_hash" text,
	"sha256_hash" text,
	"host" text,
	"os" text,
	"sid" text,
	"notes" text,
	"harvested_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"metadata" json DEFAULT '{}'::json
);
--> statement-breakpoint
CREATE TABLE "empire_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"agent_id" uuid,
	"event_type" text NOT NULL,
	"event_name" text NOT NULL,
	"message" text,
	"username" text,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"event_data" json DEFAULT '{}'::json
);
--> statement-breakpoint
CREATE TABLE "empire_listeners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"empire_listener_id" text NOT NULL,
	"name" text NOT NULL,
	"listener_type" "empire_listener_type" NOT NULL,
	"listener_category" text,
	"host" text NOT NULL,
	"port" integer NOT NULL,
	"cert_path" text,
	"staging_key" text,
	"default_delay" integer DEFAULT 5,
	"default_jitter" integer DEFAULT 0,
	"default_lost_limit" integer DEFAULT 60,
	"kill_date" text,
	"working_hours" text,
	"redirect_target" text,
	"proxy_url" text,
	"proxy_username" text,
	"proxy_password" text,
	"user_agent" text,
	"headers" text,
	"cookie" text,
	"is_active" boolean DEFAULT true,
	"status" text DEFAULT 'stopped',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" uuid,
	"config" json DEFAULT '{}'::json
);
--> statement-breakpoint
CREATE TABLE "empire_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"module_name" text NOT NULL,
	"module_path" text NOT NULL,
	"language" text NOT NULL,
	"category" text,
	"description" text,
	"background" boolean DEFAULT false,
	"output_extension" text,
	"needs_admin" boolean DEFAULT false,
	"opsec_safe" boolean DEFAULT true,
	"software" text,
	"options" json DEFAULT '{}'::json,
	"comments" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "empire_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 1337 NOT NULL,
	"rest_api_url" text NOT NULL,
	"rest_api_port" integer DEFAULT 1337 NOT NULL,
	"socketio_url" text,
	"socketio_port" integer,
	"admin_username" text DEFAULT 'empireadmin' NOT NULL,
	"admin_password_hash" text NOT NULL,
	"api_token" text,
	"certificate_path" text,
	"is_active" boolean DEFAULT true,
	"version" text,
	"status" text DEFAULT 'disconnected',
	"last_heartbeat" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"metadata" json DEFAULT '{}'::json
);
--> statement-breakpoint
CREATE TABLE "empire_stagers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"listener_id" uuid,
	"stager_name" text NOT NULL,
	"stager_type" text NOT NULL,
	"language" text NOT NULL,
	"output_file" text,
	"base64_output" text,
	"listener_name" text,
	"user_agent" text,
	"proxy_url" text,
	"proxy_credentials" text,
	"binpath" text,
	"obfuscate" boolean DEFAULT false,
	"obfuscation_command" text,
	"bypass_amsi" boolean DEFAULT true,
	"bypass_uac" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"created_by" uuid,
	"config" json DEFAULT '{}'::json
);
--> statement-breakpoint
CREATE TABLE "empire_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"empire_task_id" text,
	"task_name" text NOT NULL,
	"module_name" text,
	"command" text NOT NULL,
	"parameters" json DEFAULT '{}'::json,
	"status" "empire_task_status" DEFAULT 'queued',
	"results" text,
	"user_output" text,
	"agent_output" text,
	"error_message" text,
	"queued_at" timestamp DEFAULT now(),
	"sent_at" timestamp,
	"completed_at" timestamp,
	"created_by" uuid,
	"metadata" json DEFAULT '{}'::json
);
--> statement-breakpoint
CREATE TABLE "empire_user_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"server_id" uuid NOT NULL,
	"permanent_token" text NOT NULL,
	"temporary_token" text,
	"token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_used" timestamp
);
--> statement-breakpoint
CREATE TABLE "github_tool_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_url" text NOT NULL,
	"tool_id" uuid,
	"repo_name" text,
	"detected_language" text,
	"detected_dependencies" json DEFAULT '[]'::json,
	"suggested_install_method" "install_method",
	"dockerfile_generated" text,
	"build_script_generated" text,
	"install_status" "install_status" DEFAULT 'pending' NOT NULL,
	"build_log" text,
	"error_message" text,
	"analyzed_at" timestamp,
	"installed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kasm_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid,
	"session_token" text,
	"kasm_session_id" text,
	"last_activity" timestamp DEFAULT now(),
	"activity_count" integer DEFAULT 0,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"terminated_at" timestamp,
	"metadata" json DEFAULT '{}'::json,
	CONSTRAINT "kasm_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "kasm_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"operation_id" uuid,
	"workspace_type" text NOT NULL,
	"workspace_name" text,
	"kasm_session_id" text NOT NULL,
	"kasm_container_id" text,
	"kasm_user_id" text,
	"status" text DEFAULT 'starting' NOT NULL,
	"access_url" text,
	"internal_ip" text,
	"cpu_limit" text DEFAULT '2',
	"memory_limit" text DEFAULT '4096M',
	"created_at" timestamp DEFAULT now(),
	"started_at" timestamp,
	"last_accessed" timestamp,
	"expires_at" timestamp NOT NULL,
	"terminated_at" timestamp,
	"metadata" json DEFAULT '{}'::json,
	"error_message" text,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kasm_workspaces_kasm_session_id_unique" UNIQUE("kasm_session_id")
);
--> statement-breakpoint
CREATE TABLE "ollama_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_name" text NOT NULL,
	"model_tag" text DEFAULT 'latest',
	"model_size" integer,
	"parameter_size" text,
	"quantization" text,
	"downloaded_at" timestamp DEFAULT now(),
	"last_used" timestamp,
	"usage_count" integer DEFAULT 0,
	"status" "ollama_model_status" DEFAULT 'available',
	"metadata" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ollama_models_model_name_unique" UNIQUE("model_name")
);
--> statement-breakpoint
CREATE TABLE "operation_attack_mapping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"technique_id" uuid NOT NULL,
	"tactic_id" uuid,
	"status" text DEFAULT 'planned',
	"coverage_percentage" integer DEFAULT 0,
	"evidence_text" text,
	"notes" text,
	"executed_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"metadata" json DEFAULT '{}'::json
);
--> statement-breakpoint
CREATE TABLE "operations_manager_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_type" "manager_task_type" NOT NULL,
	"task_name" text NOT NULL,
	"task_description" text,
	"operation_id" uuid,
	"manager_agent_id" uuid NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 5,
	"involved_agents" json DEFAULT '[]'::json,
	"reports_synthesized" json DEFAULT '[]'::json,
	"input_data" json DEFAULT '{}'::json,
	"output_data" json DEFAULT '{}'::json,
	"decisions" json DEFAULT '[]'::json,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"metadata" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rd_experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"hypothesis" text,
	"methodology" text,
	"tools_used" json DEFAULT '[]'::json,
	"targets" json DEFAULT '[]'::json,
	"status" text DEFAULT 'planned' NOT NULL,
	"results" json DEFAULT '{}'::json,
	"conclusions" text,
	"success" boolean,
	"executed_by_agent_id" uuid,
	"workflow_id" uuid,
	"execution_log" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "research_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"lead_agent_id" uuid,
	"assigned_agents" json DEFAULT '[]'::json,
	"objectives" text,
	"success_criteria" text,
	"findings" json DEFAULT '{}'::json,
	"artifacts" json DEFAULT '[]'::json,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "rust_nexus_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"implant_id" uuid,
	"certificate_type" "rust_nexus_certificate_type" NOT NULL,
	"serial_number" text NOT NULL,
	"fingerprint_sha256" text NOT NULL,
	"common_name" text NOT NULL,
	"organization" text,
	"organizational_unit" text,
	"country" text,
	"certificate_pem" text NOT NULL,
	"public_key_pem" text NOT NULL,
	"not_before" timestamp NOT NULL,
	"not_after" timestamp NOT NULL,
	"is_valid" boolean DEFAULT true,
	"revoked" boolean DEFAULT false,
	"revoked_at" timestamp,
	"revocation_reason" text,
	"revoked_by" uuid,
	"issuer_common_name" text NOT NULL,
	"issuer_fingerprint" text,
	"ca_certificate_id" uuid,
	"last_used_at" timestamp,
	"usage_count" integer DEFAULT 0,
	"rotation_scheduled_at" timestamp,
	"rotation_completed_at" timestamp,
	"successor_certificate_id" uuid,
	"metadata" json DEFAULT '{}'::json,
	"issued_by" uuid NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rust_nexus_certificates_serial_number_unique" UNIQUE("serial_number"),
	CONSTRAINT "rust_nexus_certificates_fingerprint_sha256_unique" UNIQUE("fingerprint_sha256")
);
--> statement-breakpoint
CREATE TABLE "rust_nexus_implants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid,
	"implant_name" text NOT NULL,
	"implant_type" "implant_type" NOT NULL,
	"version" text NOT NULL,
	"hostname" text NOT NULL,
	"os_type" text NOT NULL,
	"os_version" text,
	"architecture" text NOT NULL,
	"ip_address" text,
	"mac_address" text,
	"status" "implant_status" DEFAULT 'registered' NOT NULL,
	"last_heartbeat" timestamp,
	"connection_quality" integer DEFAULT 100,
	"certificate_serial" text NOT NULL,
	"certificate_fingerprint" text NOT NULL,
	"auth_token" text NOT NULL,
	"capabilities" json DEFAULT '[]'::json,
	"max_concurrent_tasks" integer DEFAULT 3,
	"ai_provider" text,
	"ai_model" text,
	"autonomy_level" integer DEFAULT 1,
	"total_tasks_completed" integer DEFAULT 0,
	"total_tasks_failed" integer DEFAULT 0,
	"total_bytes_transferred" integer DEFAULT 0,
	"average_response_time_ms" integer,
	"metadata" json DEFAULT '{}'::json,
	"tags" text[] DEFAULT '{}',
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"first_connection_at" timestamp,
	"last_connection_at" timestamp,
	"terminated_at" timestamp,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rust_nexus_implants_implant_name_unique" UNIQUE("implant_name"),
	CONSTRAINT "rust_nexus_implants_certificate_serial_unique" UNIQUE("certificate_serial")
);
--> statement-breakpoint
CREATE TABLE "rust_nexus_task_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"implant_id" uuid NOT NULL,
	"result_type" text NOT NULL,
	"result_data" text,
	"result_json" json,
	"file_path" text,
	"file_size" integer,
	"file_hash" text,
	"file_mime_type" text,
	"exit_code" integer,
	"execution_time_ms" integer NOT NULL,
	"memory_used_mb" integer,
	"cpu_usage_percent" integer,
	"parsed_successfully" boolean DEFAULT false,
	"parsing_errors" text,
	"extracted_data" json,
	"contains_credentials" boolean DEFAULT false,
	"contains_sensitive_data" boolean DEFAULT false,
	"security_flags" text[] DEFAULT '{}',
	"metadata" json DEFAULT '{}'::json,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rust_nexus_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"implant_id" uuid NOT NULL,
	"operation_id" uuid,
	"workflow_id" uuid,
	"task_type" "rust_nexus_task_type" NOT NULL,
	"task_name" text NOT NULL,
	"task_description" text,
	"command" text,
	"parameters" json DEFAULT '{}'::json,
	"environment_vars" json DEFAULT '{}'::json,
	"priority" integer DEFAULT 5,
	"timeout_seconds" integer DEFAULT 300,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"status" "rust_nexus_task_status" DEFAULT 'queued' NOT NULL,
	"progress_percentage" integer DEFAULT 0,
	"requires_ai_approval" boolean DEFAULT false,
	"ai_approved" boolean,
	"ai_reasoning" text,
	"assigned_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"execution_time_ms" integer,
	"error_message" text,
	"error_stack" text,
	"depends_on_task_ids" text[] DEFAULT '{}',
	"blocks_task_ids" text[] DEFAULT '{}',
	"metadata" json DEFAULT '{}'::json,
	"tags" text[] DEFAULT '{}',
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rust_nexus_telemetry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"implant_id" uuid NOT NULL,
	"cpu_usage_percent" integer,
	"memory_usage_mb" integer,
	"memory_total_mb" integer,
	"disk_usage_gb" integer,
	"disk_total_gb" integer,
	"network_latency_ms" integer,
	"network_bandwidth_kbps" integer,
	"packets_sent" integer,
	"packets_received" integer,
	"bytes_sent" integer,
	"bytes_received" integer,
	"process_count" integer,
	"thread_count" integer,
	"handle_count" integer,
	"uptime_seconds" integer,
	"active_tasks" integer DEFAULT 0,
	"queued_tasks" integer DEFAULT 0,
	"completed_tasks_last_hour" integer DEFAULT 0,
	"failed_tasks_last_hour" integer DEFAULT 0,
	"connection_drops_count" integer DEFAULT 0,
	"reconnection_attempts" integer DEFAULT 0,
	"last_connection_error" text,
	"health_status" "health_status" NOT NULL,
	"health_score" integer,
	"health_issues" text[] DEFAULT '{}',
	"anomaly_detected" boolean DEFAULT false,
	"anomaly_type" text,
	"anomaly_severity" text,
	"anomaly_description" text,
	"security_events_count" integer DEFAULT 0,
	"last_security_event" text,
	"last_security_event_at" timestamp,
	"ai_inference_count" integer DEFAULT 0,
	"ai_average_latency_ms" integer,
	"ai_error_count" integer DEFAULT 0,
	"custom_metrics" json DEFAULT '{}'::json,
	"metadata" json DEFAULT '{}'::json,
	"collected_at" timestamp NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"user_id" uuid,
	"operation_id" uuid,
	"target_id" uuid,
	"agent_id" uuid,
	"command" text NOT NULL,
	"parameters" json DEFAULT '{}'::json,
	"status" "tool_execution_status" DEFAULT 'pending' NOT NULL,
	"exit_code" integer,
	"stdout" text,
	"stderr" text,
	"parsed_output" json,
	"start_time" timestamp,
	"end_time" timestamp,
	"duration_ms" integer,
	"timeout_ms" integer DEFAULT 300000,
	"error_message" text,
	"metadata" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"security_tool_id" uuid,
	"research_value" text DEFAULT 'medium',
	"testing_status" text DEFAULT 'untested',
	"compatible_agents" json DEFAULT '[]'::json,
	"required_capabilities" text[] DEFAULT '{}',
	"last_tested_at" timestamp,
	"test_results" json DEFAULT '{}'::json,
	"known_issues" text[],
	"execution_count" integer DEFAULT 0,
	"success_rate" real DEFAULT 0,
	"avg_execution_time_seconds" integer,
	"usage_examples" json DEFAULT '[]'::json,
	"research_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_output_parsers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"parser_name" text NOT NULL,
	"parser_type" text NOT NULL,
	"output_format" "output_format" NOT NULL,
	"parser_code" text,
	"regex_patterns" json DEFAULT '{}'::json,
	"json_paths" json DEFAULT '{}'::json,
	"xml_paths" json DEFAULT '{}'::json,
	"description" text,
	"example_input" text,
	"example_output" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_parameters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"parameter_name" text NOT NULL,
	"parameter_type" "parameter_type" NOT NULL,
	"description" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"default_value" text,
	"validation_regex" text,
	"enum_values" json DEFAULT '[]'::json,
	"placeholder" text,
	"help_text" text,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" text NOT NULL,
	"name" text NOT NULL,
	"version" text,
	"category" "tool_category" NOT NULL,
	"description" text,
	"install_method" "install_method" NOT NULL,
	"install_command" text,
	"docker_image" text,
	"github_url" text,
	"binary_path" text NOT NULL,
	"config" json DEFAULT '{}'::json NOT NULL,
	"install_status" "install_status" DEFAULT 'pending' NOT NULL,
	"install_log" text,
	"validation_status" text,
	"last_validated" timestamp,
	"tags" json DEFAULT '[]'::json,
	"notes" text,
	"homepage" text,
	"documentation" text,
	"installed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tool_registry_tool_id_unique" UNIQUE("tool_id")
);
--> statement-breakpoint
CREATE TABLE "tool_test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"test_type" text NOT NULL,
	"test_command" text,
	"expected_exit_code" integer,
	"expected_output" text,
	"passed" boolean NOT NULL,
	"actual_exit_code" integer,
	"actual_output" text,
	"error_message" text,
	"execution_time_ms" integer,
	"tested_by" uuid,
	"tested_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operations" ADD COLUMN "hourly_reporting_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "operations" ADD COLUMN "management_status" json;--> statement-breakpoint
ALTER TABLE "operations" ADD COLUMN "last_manager_update" timestamp;--> statement-breakpoint
ALTER TABLE "agent_activity_reports" ADD CONSTRAINT "agent_activity_reports_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_activity_reports" ADD CONSTRAINT "agent_activity_reports_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_activity_reports" ADD CONSTRAINT "agent_activity_reports_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_builds" ADD CONSTRAINT "agent_builds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_bundles" ADD CONSTRAINT "agent_bundles_build_id_agent_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."agent_builds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_bundles" ADD CONSTRAINT "agent_bundles_certificate_id_rust_nexus_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."rust_nexus_certificates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_bundles" ADD CONSTRAINT "agent_bundles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_download_tokens" ADD CONSTRAINT "agent_download_tokens_bundle_id_agent_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."agent_bundles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_download_tokens" ADD CONSTRAINT "agent_download_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_download_tokens" ADD CONSTRAINT "agent_download_tokens_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_enrichment_logs" ADD CONSTRAINT "ai_enrichment_logs_vulnerability_id_vulnerabilities_id_fk" FOREIGN KEY ("vulnerability_id") REFERENCES "public"."vulnerabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_questions" ADD CONSTRAINT "asset_questions_asset_id_discovered_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."discovered_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_questions" ADD CONSTRAINT "asset_questions_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_questions" ADD CONSTRAINT "asset_questions_asked_by_agents_id_fk" FOREIGN KEY ("asked_by") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_questions" ADD CONSTRAINT "asset_questions_answered_by_user_id_users_id_fk" FOREIGN KEY ("answered_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_questions" ADD CONSTRAINT "asset_questions_answered_by_agent_id_agents_id_fk" FOREIGN KEY ("answered_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attack_technique_tactics" ADD CONSTRAINT "attack_technique_tactics_technique_id_attack_techniques_id_fk" FOREIGN KEY ("technique_id") REFERENCES "public"."attack_techniques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attack_technique_tactics" ADD CONSTRAINT "attack_technique_tactics_tactic_id_attack_tactics_id_fk" FOREIGN KEY ("tactic_id") REFERENCES "public"."attack_tactics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attack_techniques" ADD CONSTRAINT "attack_techniques_parent_technique_id_attack_techniques_id_fk" FOREIGN KEY ("parent_technique_id") REFERENCES "public"."attack_techniques"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_agents" ADD CONSTRAINT "empire_agents_server_id_empire_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."empire_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_agents" ADD CONSTRAINT "empire_agents_listener_id_empire_listeners_id_fk" FOREIGN KEY ("listener_id") REFERENCES "public"."empire_listeners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_agents" ADD CONSTRAINT "empire_agents_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_agents" ADD CONSTRAINT "empire_agents_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_credentials" ADD CONSTRAINT "empire_credentials_server_id_empire_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."empire_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_credentials" ADD CONSTRAINT "empire_credentials_agent_id_empire_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."empire_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_credentials" ADD CONSTRAINT "empire_credentials_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_events" ADD CONSTRAINT "empire_events_server_id_empire_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."empire_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_events" ADD CONSTRAINT "empire_events_agent_id_empire_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."empire_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_listeners" ADD CONSTRAINT "empire_listeners_server_id_empire_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."empire_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_listeners" ADD CONSTRAINT "empire_listeners_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_modules" ADD CONSTRAINT "empire_modules_server_id_empire_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."empire_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_stagers" ADD CONSTRAINT "empire_stagers_server_id_empire_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."empire_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_stagers" ADD CONSTRAINT "empire_stagers_listener_id_empire_listeners_id_fk" FOREIGN KEY ("listener_id") REFERENCES "public"."empire_listeners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_stagers" ADD CONSTRAINT "empire_stagers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_tasks" ADD CONSTRAINT "empire_tasks_server_id_empire_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."empire_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_tasks" ADD CONSTRAINT "empire_tasks_agent_id_empire_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."empire_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_tasks" ADD CONSTRAINT "empire_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_user_tokens" ADD CONSTRAINT "empire_user_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empire_user_tokens" ADD CONSTRAINT "empire_user_tokens_server_id_empire_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."empire_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_tool_installations" ADD CONSTRAINT "github_tool_installations_tool_id_tool_registry_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tool_registry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasm_sessions" ADD CONSTRAINT "kasm_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasm_sessions" ADD CONSTRAINT "kasm_sessions_workspace_id_kasm_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."kasm_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasm_workspaces" ADD CONSTRAINT "kasm_workspaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasm_workspaces" ADD CONSTRAINT "kasm_workspaces_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasm_workspaces" ADD CONSTRAINT "kasm_workspaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_attack_mapping" ADD CONSTRAINT "operation_attack_mapping_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_attack_mapping" ADD CONSTRAINT "operation_attack_mapping_technique_id_attack_techniques_id_fk" FOREIGN KEY ("technique_id") REFERENCES "public"."attack_techniques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_attack_mapping" ADD CONSTRAINT "operation_attack_mapping_tactic_id_attack_tactics_id_fk" FOREIGN KEY ("tactic_id") REFERENCES "public"."attack_tactics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_attack_mapping" ADD CONSTRAINT "operation_attack_mapping_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations_manager_tasks" ADD CONSTRAINT "operations_manager_tasks_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations_manager_tasks" ADD CONSTRAINT "operations_manager_tasks_manager_agent_id_agents_id_fk" FOREIGN KEY ("manager_agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rd_experiments" ADD CONSTRAINT "rd_experiments_project_id_research_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."research_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rd_experiments" ADD CONSTRAINT "rd_experiments_executed_by_agent_id_agents_id_fk" FOREIGN KEY ("executed_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rd_experiments" ADD CONSTRAINT "rd_experiments_workflow_id_agent_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."agent_workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_projects" ADD CONSTRAINT "research_projects_lead_agent_id_agents_id_fk" FOREIGN KEY ("lead_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_projects" ADD CONSTRAINT "research_projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rust_nexus_certificates" ADD CONSTRAINT "rust_nexus_certificates_implant_id_rust_nexus_implants_id_fk" FOREIGN KEY ("implant_id") REFERENCES "public"."rust_nexus_implants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rust_nexus_certificates" ADD CONSTRAINT "rust_nexus_certificates_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rust_nexus_certificates" ADD CONSTRAINT "rust_nexus_certificates_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rust_nexus_implants" ADD CONSTRAINT "rust_nexus_implants_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rust_nexus_implants" ADD CONSTRAINT "rust_nexus_implants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rust_nexus_task_results" ADD CONSTRAINT "rust_nexus_task_results_task_id_rust_nexus_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."rust_nexus_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rust_nexus_task_results" ADD CONSTRAINT "rust_nexus_task_results_implant_id_rust_nexus_implants_id_fk" FOREIGN KEY ("implant_id") REFERENCES "public"."rust_nexus_implants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rust_nexus_tasks" ADD CONSTRAINT "rust_nexus_tasks_implant_id_rust_nexus_implants_id_fk" FOREIGN KEY ("implant_id") REFERENCES "public"."rust_nexus_implants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rust_nexus_tasks" ADD CONSTRAINT "rust_nexus_tasks_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rust_nexus_tasks" ADD CONSTRAINT "rust_nexus_tasks_workflow_id_agent_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."agent_workflows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rust_nexus_tasks" ADD CONSTRAINT "rust_nexus_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rust_nexus_telemetry" ADD CONSTRAINT "rust_nexus_telemetry_implant_id_rust_nexus_implants_id_fk" FOREIGN KEY ("implant_id") REFERENCES "public"."rust_nexus_implants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_tool_id_tool_registry_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tool_registry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_library" ADD CONSTRAINT "tool_library_security_tool_id_security_tools_id_fk" FOREIGN KEY ("security_tool_id") REFERENCES "public"."security_tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_output_parsers" ADD CONSTRAINT "tool_output_parsers_tool_id_tool_registry_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tool_registry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_parameters" ADD CONSTRAINT "tool_parameters_tool_id_tool_registry_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tool_registry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_test_results" ADD CONSTRAINT "tool_test_results_tool_id_tool_registry_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tool_registry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_test_results" ADD CONSTRAINT "tool_test_results_tested_by_users_id_fk" FOREIGN KEY ("tested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;