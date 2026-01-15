import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  json,
  pgEnum,
  real,
} from "drizzle-orm/pg-core";

// ============================================================================
// ENUMERATIONS
// ============================================================================

export const userRoleEnum = pgEnum("user_role", ["admin", "operator", "viewer"]);
export const authMethodEnum = pgEnum("auth_method", ["local", "google_oauth", "certificate", "api_key"]);
export const operationStatusEnum = pgEnum("operation_status", ["planning", "active", "paused", "completed", "cancelled"]);
export const targetTypeEnum = pgEnum("target_type", ["ip", "domain", "url", "network", "range"]);
export const severityEnum = pgEnum("severity", ["critical", "high", "medium", "low", "informational"]);
export const agentTypeEnum = pgEnum("agent_type", ["openai", "anthropic", "mcp_server", "custom"]);
export const agentStatusEnum = pgEnum("agent_status", ["idle", "running", "error", "stopped"]);
export const containerStatusEnum = pgEnum("container_status", ["running", "stopped", "paused", "restarting", "dead"]);
export const assetTypeEnum = pgEnum("asset_type", ["host", "domain", "ip", "network", "url"]);
export const discoveryMethodEnum = pgEnum("discovery_method", ["bbot", "nuclei", "nmap", "manual"]);
export const assetStatusEnum = pgEnum("asset_status", ["active", "down", "unreachable"]);
export const scanStatusEnum = pgEnum("scan_status", ["pending", "running", "completed", "failed", "cancelled"]);

// rust-nexus enums
export const implantTypeEnum = pgEnum("implant_type", ["reconnaissance", "exploitation", "exfiltration", "general"]);
export const implantStatusEnum = pgEnum("implant_status", ["registered", "connected", "idle", "busy", "disconnected", "terminated"]);
export const rustNexusTaskTypeEnum = pgEnum("rust_nexus_task_type", [
  "shell_command",
  "file_transfer",
  "process_execution",
  "network_scan",
  "credential_harvest",
  "privilege_escalation",
  "lateral_movement",
  "data_collection",
  "persistence",
  "custom",
]);
export const rustNexusTaskStatusEnum = pgEnum("rust_nexus_task_status", ["queued", "assigned", "running", "completed", "failed", "timeout", "cancelled", "retrying"]);
export const rustNexusCertificateTypeEnum = pgEnum("rust_nexus_certificate_type", ["ca", "server", "client"]);
export const healthStatusEnum = pgEnum("health_status", ["healthy", "degraded", "unhealthy", "critical"]);

// Ollama AI enums
export const ollamaModelStatusEnum = pgEnum("ollama_model_status", ["available", "downloading", "loading", "loaded", "unloaded", "error"]);
export const aiProviderEnum = pgEnum("ai_provider", ["ollama", "openai", "anthropic", "llama.cpp"]);

// Agent deployment enums
export const agentBuildStatusEnum = pgEnum("agent_build_status", ["pending", "building", "completed", "failed", "cancelled"]);
export const agentPlatformEnum = pgEnum("agent_platform", ["windows", "linux"]);
export const agentArchitectureEnum = pgEnum("agent_architecture", ["x64", "x86", "arm64"]);

// Empire C2 enums
export const empireListenerTypeEnum = pgEnum("empire_listener_type", [
  "http",
  "https",
  "http_foreign",
  "http_hop",
  "http_mapi",
  "onedrive",
  "redirector",
]);
export const empireAgentStatusEnum = pgEnum("empire_agent_status", [
  "active",
  "pending",
  "lost",
  "killed",
]);
export const empireTaskStatusEnum = pgEnum("empire_task_status", [
  "queued",
  "sent",
  "completed",
  "error",
]);

// ATT&CK enums
export const attackObjectTypeEnum = pgEnum("attack_object_type", [
  "technique",
  "tactic",
  "group",
  "software",
  "mitigation",
  "data-source",
  "campaign",
]);
export const attackPlatformEnum = pgEnum("attack_platform", [
  "Windows",
  "macOS",
  "Linux",
  "Cloud",
  "Network",
  "Containers",
  "IaaS",
  "SaaS",
  "Office 365",
  "Azure AD",
  "Google Workspace",
  "PRE",
]);

// ============================================================================
// AUTHENTICATION & USER MANAGEMENT TABLES (5 tables)
// ============================================================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("operator"),
  authMethod: authMethodEnum("auth_method").notNull().default("local"),
  googleId: text("google_id").unique(),
  certificateFingerprint: text("certificate_fingerprint").unique(),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  lastLogin: timestamp("last_login"),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  sid: text("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  details: json("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").notNull().default(true),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  permissions: json("permissions").notNull().default([]),
  rateLimit: integer("rate_limit").notNull().default(100),
  lastUsed: timestamp("last_used"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const passwordHistory = pgTable("password_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// OPERATIONS MANAGEMENT TABLES (6 tables)
// ============================================================================

export const operations = pgTable("operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  status: operationStatusEnum("status").notNull().default("planning"),
  objectives: text("objectives"),
  scope: text("scope"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  teamMembers: json("team_members").default([]),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const targets = pgTable("targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: targetTypeEnum("type").notNull(),
  value: text("value").notNull(),
  description: text("description"),
  priority: integer("priority").notNull().default(3),
  tags: json("tags").default([]),
  operationId: uuid("operation_id").references(() => operations.id, { onDelete: "cascade" }),
  discoveredServices: json("discovered_services"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const vulnerabilities = pgTable("vulnerabilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: severityEnum("severity").notNull(),
  cvssScore: integer("cvss_score"),
  cvssVector: text("cvss_vector"),
  cveId: text("cve_id"),
  cweId: text("cwe_id"),
  targetId: uuid("target_id").references(() => targets.id, { onDelete: "cascade" }),
  operationId: uuid("operation_id").references(() => operations.id, { onDelete: "cascade" }),
  templateId: uuid("template_id").references(() => vulnerabilityTemplates.id),
  proofOfConcept: text("proof_of_concept"),
  remediation: text("remediation"),
  references: json("references").default([]),
  affectedServices: json("affected_services"),
  exploitability: text("exploitability"),
  impact: text("impact"),
  status: text("status").notNull().default("open"),
  aiGenerated: json("ai_generated").default({}), // Tracks which fields were AI-generated
  discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
  verifiedAt: timestamp("verified_at"),
  remediatedAt: timestamp("remediated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const vulnerabilityTemplates = pgTable("vulnerability_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  category: text("category").notNull(), // "web", "network", "mobile", "api", "cloud"
  description: text("description").notNull(),
  severity: severityEnum("severity").notNull(),
  cvssVector: text("cvss_vector"),
  cweId: text("cwe_id"),
  remediationTemplate: text("remediation_template"),
  pocTemplate: text("poc_template"),
  impactTemplate: text("impact_template"),
  exploitabilityTemplate: text("exploitability_template"),
  tags: json("tags").default([]),
  references: json("references").default([]),
  isActive: boolean("is_active").notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const vulnerabilityVersions = pgTable("vulnerability_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  vulnerabilityId: uuid("vulnerability_id").notNull().references(() => vulnerabilities.id, { onDelete: "cascade" }),
  data: json("data").notNull(),
  changedBy: uuid("changed_by").references(() => users.id),
  changeDescription: text("change_description"),
  changeType: text("change_type"), // "create", "update", "ai_generation"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: agentTypeEnum("type").notNull(),
  status: agentStatusEnum("status").notNull().default("idle"),
  config: json("config"), // Contains: model, systemPrompt, loopEnabled, loopPartnerId, maxLoopIterations, loopExitCondition, flowOrder, enabledTools, mcpServerId
  capabilities: json("capabilities").default([]),
  lastActivity: timestamp("last_activity"),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  tasksFailed: integer("tasks_failed").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimetype: text("mimetype").notNull(),
  size: integer("size").notNull(),
  path: text("path").notNull(),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  operationId: uuid("operation_id").references(() => operations.id, { onDelete: "cascade" }),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// MCP ORCHESTRATION TABLES (4 tables)
// ============================================================================

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  deviceId: text("device_id").notNull().unique(),
  certificateFingerprint: text("certificate_fingerprint").notNull(),
  isBlocked: boolean("is_blocked").notNull().default(false),
  lastSeen: timestamp("last_seen"),
  ipAddress: text("ip_address"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const mcpServers = pgTable("mcp_servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  deviceId: uuid("device_id").references(() => devices.id, { onDelete: "cascade" }),
  command: text("command").notNull(),
  args: json("args").default([]),
  env: json("env").default({}),
  status: agentStatusEnum("status").notNull().default("stopped"),
  pid: integer("pid"),
  autoRestart: boolean("auto_restart").notNull().default(true),
  maxRestarts: integer("max_restarts").notNull().default(3),
  restartCount: integer("restart_count").notNull().default(0),
  uptime: timestamp("uptime"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const certificates = pgTable("certificates", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  fingerprint: text("fingerprint").notNull().unique(),
  subject: text("subject").notNull(),
  issuer: text("issuer").notNull(),
  serialNumber: text("serial_number"),
  validFrom: timestamp("valid_from").notNull(),
  validTo: timestamp("valid_to").notNull(),
  isRevoked: boolean("is_revoked").notNull().default(false),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const serverLogs = pgTable("server_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id").references(() => mcpServers.id, { onDelete: "cascade" }),
  level: text("level").notNull(),
  message: text("message").notNull(),
  context: json("context"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// ============================================================================
// INFRASTRUCTURE MONITORING TABLES (2 tables)
// ============================================================================

export const containers = pgTable("containers", {
  id: uuid("id").primaryKey().defaultRandom(),
  containerId: text("container_id").notNull().unique(),
  name: text("name").notNull(),
  image: text("image").notNull(),
  status: containerStatusEnum("status").notNull(),
  ports: json("ports"),
  environment: json("environment"),
  created: timestamp("created").notNull(),
  started: timestamp("started"),
  lastChecked: timestamp("last_checked").notNull().defaultNow(),
});

export const healthChecks = pgTable("health_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  service: text("service").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  details: json("details"),
  failureCount: integer("failure_count").notNull().default(0),
  lastCheck: timestamp("last_check").notNull().defaultNow(),
  nextCheck: timestamp("next_check"),
});

// ============================================================================
// REPORTS & TEMPLATES TABLES (2 tables)
// ============================================================================

export const reportStatusEnum = pgEnum("report_status", ["draft", "completed", "archived"]);
export const reportFormatEnum = pgEnum("report_format", ["pdf", "docx", "html", "markdown"]);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "operation_summary", "vulnerability_assessment", etc.
  status: reportStatusEnum("status").notNull().default("draft"),
  format: reportFormatEnum("format").notNull().default("pdf"),
  operationId: uuid("operation_id").references(() => operations.id, { onDelete: "set null" }),
  templateId: uuid("template_id").references(() => reportTemplates.id),
  content: json("content"),
  generatedBy: uuid("generated_by").notNull().references(() => users.id),
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const reportTemplates = pgTable("report_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  type: text("type").notNull(), // "operation_summary", "vulnerability_assessment", "bug_bounty", etc.
  format: reportFormatEnum("format").notNull().default("pdf"),
  structure: json("structure").notNull(), // Template structure/sections
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================================================
// SECURITY TOOLS TABLE (1 table)
// ============================================================================

export const toolStatusEnum = pgEnum("tool_status", ["available", "running", "stopped", "error"]);
export const workflowStatusEnum = pgEnum("workflow_status", ["pending", "running", "completed", "failed", "cancelled"]);
export const taskStatusEnum = pgEnum("task_status", ["pending", "in_progress", "completed", "failed", "skipped"]);
export const taskTypeEnum = pgEnum("task_type", ["analyze", "exploit", "report", "custom"]);

export const securityTools = pgTable("security_tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category").notNull(), // "reconnaissance", "exploitation", "web_security", etc.
  description: text("description"),
  status: toolStatusEnum("status").notNull().default("available"),
  command: text("command"), // Command to execute tool
  dockerImage: text("docker_image"), // Docker image if containerized
  endpoint: text("endpoint"), // URL if web-based
  configPath: text("config_path"), // Path to config files
  version: text("version"),
  lastUsed: timestamp("last_used"),
  usageCount: integer("usage_count").notNull().default(0),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================================================
// FILE UPLOADS TABLE (for tool uploads like Burp Suite JAR)
// ============================================================================

export const toolUploads = pgTable("tool_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  toolId: uuid("tool_id").references(() => securityTools.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimetype: text("mimetype").notNull(),
  size: integer("size").notNull(),
  path: text("path").notNull(),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// AGENT WORKFLOW SYSTEM TABLES (3 tables)
// ============================================================================

export const agentWorkflows = pgTable("agent_workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  workflowType: text("workflow_type").notNull(), // 'penetration_test', 'vulnerability_scan', etc.
  targetId: uuid("target_id").references(() => targets.id, { onDelete: "cascade" }),
  operationId: uuid("operation_id").references(() => operations.id, { onDelete: "cascade" }),
  currentAgentId: uuid("current_agent_id").references(() => agents.id),
  currentTaskId: uuid("current_task_id"),
  status: workflowStatusEnum("status").notNull().default("pending"),
  progress: integer("progress").notNull().default(0), // 0-100 percentage
  metadata: json("metadata").default({}),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const workflowTasks = pgTable("workflow_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").notNull().references(() => agentWorkflows.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  taskType: taskTypeEnum("task_type").notNull(),
  taskName: text("task_name").notNull(),
  status: taskStatusEnum("status").notNull().default("pending"),
  sequenceOrder: integer("sequence_order").notNull(), // Order of execution in workflow
  inputData: json("input_data").default({}),
  outputData: json("output_data").default({}),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const workflowLogs = pgTable("workflow_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").notNull().references(() => agentWorkflows.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => workflowTasks.id, { onDelete: "cascade" }),
  level: text("level").notNull(), // 'info', 'warning', 'error', 'debug'
  message: text("message").notNull(),
  context: json("context").default({}),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// ============================================================================
// SURFACE ASSESSMENT TABLES (5 tables)
// ============================================================================

export const surfaceAssessments = pgTable("surface_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").notNull().references(() => operations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  totalAssets: integer("total_assets").notNull().default(0),
  totalServices: integer("total_services").notNull().default(0),
  totalVulnerabilities: integer("total_vulnerabilities").notNull().default(0),
  lastScanAt: timestamp("last_scan_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const discoveredAssets = pgTable("discovered_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  surfaceAssessmentId: uuid("surface_assessment_id").references(() => surfaceAssessments.id, { onDelete: "cascade" }),
  operationId: uuid("operation_id").references(() => operations.id, { onDelete: "cascade" }),
  type: assetTypeEnum("type").notNull(),
  value: text("value").notNull(), // IP, domain, URL
  hostname: text("hostname"),
  ipAddress: text("ip_address"),
  status: assetStatusEnum("status").notNull().default("active"),
  discoveryMethod: discoveryMethodEnum("discovery_method").notNull(),
  operatingSystem: text("operating_system"),
  tags: json("tags").default([]),
  metadata: json("metadata").default({}),
  discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const discoveredServices = pgTable("discovered_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id").notNull().references(() => discoveredAssets.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // HTTP, SSH, FTP, etc.
  port: integer("port").notNull(),
  protocol: text("protocol").notNull().default("tcp"), // tcp, udp
  version: text("version"),
  banner: text("banner"),
  state: text("state").notNull().default("open"), // open, filtered, closed
  discoveryMethod: discoveryMethodEnum("discovery_method").notNull(),
  metadata: json("metadata").default({}),
  discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const axScanResults = pgTable("ax_scan_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").references(() => operations.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(), // bbot, nuclei, xsstrike, etc.
  status: scanStatusEnum("status").notNull().default("pending"),
  targets: json("targets").notNull(), // Array of target URLs/IPs
  config: json("config").default({}),
  results: json("results").default({}),
  assetsFound: integer("assets_found").default(0),
  servicesFound: integer("services_found").default(0),
  vulnerabilitiesFound: integer("vulnerabilities_found").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // seconds
  errorMessage: text("error_message"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const axModuleConfigs = pgTable("ax_module_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleName: text("module_name").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  config: json("config").notNull().default({}),
  credentials: json("credentials").default({}), // Encrypted API keys, etc.
  rateLimit: integer("rate_limit"),
  timeout: integer("timeout").default(1800000), // 30 min default
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================================================
// TOOL FRAMEWORK TABLES (6 tables)
// Enhancement: Standardized tool configuration, GitHub auto-installer, testing
// ============================================================================

export const toolCategoryEnum = pgEnum("tool_category", [
  "reconnaissance",
  "scanning",
  "exploitation",
  "post-exploitation",
  "wireless",
  "web-application",
  "password-cracking",
  "forensics",
  "social-engineering",
  "reporting",
  "other",
]);

export const parameterTypeEnum = pgEnum("parameter_type", [
  "string",
  "number",
  "boolean",
  "array",
  "file",
  "ip-address",
  "cidr",
  "url",
  "port",
  "enum",
]);

export const installMethodEnum = pgEnum("install_method", [
  "apt",
  "pip",
  "npm",
  "go-install",
  "cargo",
  "docker",
  "github-binary",
  "github-source",
  "manual",
]);

export const outputFormatEnum = pgEnum("output_format", [
  "json",
  "xml",
  "csv",
  "text",
  "nmap-xml",
  "custom",
]);

export const toolExecutionStatusEnum = pgEnum("tool_execution_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "timeout",
  "cancelled",
]);

export const installStatusEnum = pgEnum("install_status", [
  "pending",
  "installing",
  "installed",
  "failed",
  "updating",
]);

export const toolRegistry = pgTable("tool_registry", {
  id: uuid("id").primaryKey().defaultRandom(),
  toolId: text("tool_id").unique().notNull(), // Short identifier (e.g., 'nmap', 'metasploit')
  name: text("name").notNull(),
  version: text("version"),
  category: toolCategoryEnum("category").notNull(),
  description: text("description"),

  // Installation
  installMethod: installMethodEnum("install_method").notNull(),
  installCommand: text("install_command"),
  dockerImage: text("docker_image"),
  githubUrl: text("github_url"),
  binaryPath: text("binary_path").notNull(),

  // Configuration (full ToolConfiguration as JSONB)
  config: json("config").notNull().default({}),

  // Status
  installStatus: installStatusEnum("install_status").notNull().default("pending"),
  installLog: text("install_log"),
  validationStatus: text("validation_status"), // 'validated', 'pending', 'failed'
  lastValidated: timestamp("last_validated"),

  // Metadata
  tags: json("tags").default([]),
  notes: text("notes"),
  homepage: text("homepage"),
  documentation: text("documentation"),

  // Timestamps
  installedAt: timestamp("installed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const toolParameters = pgTable("tool_parameters", {
  id: uuid("id").primaryKey().defaultRandom(),
  toolId: uuid("tool_id").notNull().references(() => toolRegistry.id, { onDelete: "cascade" }),

  // Parameter definition
  parameterName: text("parameter_name").notNull(),
  parameterType: parameterTypeEnum("parameter_type").notNull(),
  description: text("description").notNull(),
  required: boolean("required").notNull().default(false),
  defaultValue: text("default_value"),

  // Validation
  validationRegex: text("validation_regex"),
  enumValues: json("enum_values").default([]),

  // UI hints
  placeholder: text("placeholder"),
  helpText: text("help_text"),
  displayOrder: integer("display_order").default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const toolExecutions = pgTable("tool_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  toolId: uuid("tool_id").notNull().references(() => toolRegistry.id, { onDelete: "cascade" }),

  // Context
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  operationId: uuid("operation_id").references(() => operations.id, { onDelete: "cascade" }),
  targetId: uuid("target_id").references(() => targets.id, { onDelete: "set null" }),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),

  // Execution details
  command: text("command").notNull(),
  parameters: json("parameters").default({}),
  status: toolExecutionStatusEnum("status").notNull().default("pending"),

  // Results
  exitCode: integer("exit_code"),
  stdout: text("stdout"),
  stderr: text("stderr"),
  parsedOutput: json("parsed_output"),

  // Performance
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  durationMs: integer("duration_ms"),
  timeoutMs: integer("timeout_ms").default(300000), // 5 minutes default

  // Metadata
  errorMessage: text("error_message"),
  metadata: json("metadata").default({}),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const toolOutputParsers = pgTable("tool_output_parsers", {
  id: uuid("id").primaryKey().defaultRandom(),
  toolId: uuid("tool_id").notNull().references(() => toolRegistry.id, { onDelete: "cascade" }),

  // Parser configuration
  parserName: text("parser_name").notNull(),
  parserType: text("parser_type").notNull(), // 'json', 'xml', 'regex', 'custom'
  outputFormat: outputFormatEnum("output_format").notNull(),

  // Parser implementation
  parserCode: text("parser_code"), // JavaScript/TypeScript parser function
  regexPatterns: json("regex_patterns").default({}),
  jsonPaths: json("json_paths").default({}),
  xmlPaths: json("xml_paths").default({}),

  // Metadata
  description: text("description"),
  exampleInput: text("example_input"),
  exampleOutput: json("example_output"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const githubToolInstallations = pgTable("github_tool_installations", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubUrl: text("github_url").notNull(),
  toolId: uuid("tool_id").references(() => toolRegistry.id, { onDelete: "cascade" }),

  // Analysis results
  repoName: text("repo_name"),
  detectedLanguage: text("detected_language"),
  detectedDependencies: json("detected_dependencies").default([]),
  suggestedInstallMethod: installMethodEnum("suggested_install_method"),

  // Build artifacts
  dockerfileGenerated: text("dockerfile_generated"),
  buildScriptGenerated: text("build_script_generated"),

  // Installation tracking
  installStatus: installStatusEnum("install_status").notNull().default("pending"),
  buildLog: text("build_log"),
  errorMessage: text("error_message"),

  // Timestamps
  analyzedAt: timestamp("analyzed_at"),
  installedAt: timestamp("installed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const toolTestResults = pgTable("tool_test_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  toolId: uuid("tool_id").notNull().references(() => toolRegistry.id, { onDelete: "cascade" }),

  // Test configuration
  testType: text("test_type").notNull(), // 'syntax', 'execution', 'output-parsing'
  testCommand: text("test_command"),
  expectedExitCode: integer("expected_exit_code"),
  expectedOutput: text("expected_output"),

  // Test results
  passed: boolean("passed").notNull(),
  actualExitCode: integer("actual_exit_code"),
  actualOutput: text("actual_output"),
  errorMessage: text("error_message"),
  executionTimeMs: integer("execution_time_ms"),

  // Metadata
  testedBy: uuid("tested_by").references(() => users.id, { onDelete: "set null" }),
  testedAt: timestamp("tested_at").notNull().defaultNow(),
});

// ============================================================================
// EMPIRE C2 INTEGRATION TABLES (9 tables)
// ============================================================================

export const empireServers = pgTable("empire_servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull().default(1337),
  restApiUrl: text("rest_api_url").notNull(),
  restApiPort: integer("rest_api_port").notNull().default(1337),
  socketioUrl: text("socketio_url"),
  socketioPort: integer("socketio_port"),
  adminUsername: text("admin_username").notNull().default("empireadmin"),
  adminPasswordHash: text("admin_password_hash").notNull(),
  apiToken: text("api_token"),
  certificatePath: text("certificate_path"),
  isActive: boolean("is_active").default(true),
  version: text("version"),
  status: text("status").default("disconnected"),
  lastHeartbeat: timestamp("last_heartbeat"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  metadata: json("metadata").default({}),
});

export const empireUserTokens = pgTable("empire_user_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serverId: uuid("server_id").notNull().references(() => empireServers.id, { onDelete: "cascade" }),
  permanentToken: text("permanent_token").notNull(),
  temporaryToken: text("temporary_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastUsed: timestamp("last_used"),
});

export const empireListeners = pgTable("empire_listeners", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id").notNull().references(() => empireServers.id, { onDelete: "cascade" }),
  empireListenerId: text("empire_listener_id").notNull(),
  name: text("name").notNull(),
  listenerType: empireListenerTypeEnum("listener_type").notNull(),
  listenerCategory: text("listener_category"),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  certPath: text("cert_path"),
  stagingKey: text("staging_key"),
  defaultDelay: integer("default_delay").default(5),
  defaultJitter: integer("default_jitter").default(0),
  defaultLostLimit: integer("default_lost_limit").default(60),
  killDate: text("kill_date"),
  workingHours: text("working_hours"),
  redirectTarget: text("redirect_target"),
  proxyUrl: text("proxy_url"),
  proxyUsername: text("proxy_username"),
  proxyPassword: text("proxy_password"),
  userAgent: text("user_agent"),
  headers: text("headers"),
  cookie: text("cookie"),
  isActive: boolean("is_active").default(true),
  status: text("status").default("stopped"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  config: json("config").default({}),
});

export const empireStagers = pgTable("empire_stagers", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id").notNull().references(() => empireServers.id, { onDelete: "cascade" }),
  listenerId: uuid("listener_id").references(() => empireListeners.id, { onDelete: "set null" }),
  stagerName: text("stager_name").notNull(),
  stagerType: text("stager_type").notNull(),
  language: text("language").notNull(),
  outputFile: text("output_file"),
  base64Output: text("base64_output"),
  listenerName: text("listener_name"),
  userAgent: text("user_agent"),
  proxyUrl: text("proxy_url"),
  proxyCredentials: text("proxy_credentials"),
  binpath: text("binpath"),
  obfuscate: boolean("obfuscate").default(false),
  obfuscationCommand: text("obfuscation_command"),
  bypassAmsi: boolean("bypass_amsi").default(true),
  bypassUac: boolean("bypass_uac").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  config: json("config").default({}),
});

export const empireAgents = pgTable("empire_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id").notNull().references(() => empireServers.id, { onDelete: "cascade" }),
  listenerId: uuid("listener_id").references(() => empireListeners.id, { onDelete: "set null" }),
  targetId: uuid("target_id").references(() => targets.id, { onDelete: "set null" }),
  operationId: uuid("operation_id").references(() => operations.id, { onDelete: "set null" }),
  empireAgentId: text("empire_agent_id").notNull(),
  sessionId: text("session_id").notNull(),
  name: text("name").notNull(),
  hostname: text("hostname"),
  internalIp: text("internal_ip"),
  externalIp: text("external_ip"),
  username: text("username"),
  highIntegrity: boolean("high_integrity").default(false),
  processName: text("process_name"),
  processId: integer("process_id"),
  language: text("language"),
  languageVersion: text("language_version"),
  osDetails: text("os_details"),
  architecture: text("architecture"),
  domain: text("domain"),
  status: empireAgentStatusEnum("status").default("pending"),
  checkinTime: timestamp("checkin_time"),
  lastseenTime: timestamp("lastseen_time"),
  delay: integer("delay").default(5),
  jitter: integer("jitter").default(0),
  lostLimit: integer("lost_limit").default(60),
  killDate: text("kill_date"),
  workingHours: text("working_hours"),
  sessionKey: text("session_key"),
  nonce: text("nonce"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  metadata: json("metadata").default({}),
});

export const empireTasks = pgTable("empire_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id").notNull().references(() => empireServers.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").notNull().references(() => empireAgents.id, { onDelete: "cascade" }),
  empireTaskId: text("empire_task_id"),
  taskName: text("task_name").notNull(),
  moduleName: text("module_name"),
  command: text("command").notNull(),
  parameters: json("parameters").default({}),
  status: empireTaskStatusEnum("status").default("queued"),
  results: text("results"),
  userOutput: text("user_output"),
  agentOutput: text("agent_output"),
  errorMessage: text("error_message"),
  queuedAt: timestamp("queued_at").defaultNow(),
  sentAt: timestamp("sent_at"),
  completedAt: timestamp("completed_at"),
  createdBy: uuid("created_by").references(() => users.id),
  metadata: json("metadata").default({}),
});

export const empireModules = pgTable("empire_modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id").notNull().references(() => empireServers.id, { onDelete: "cascade" }),
  moduleName: text("module_name").notNull(),
  modulePath: text("module_path").notNull(),
  language: text("language").notNull(),
  category: text("category"),
  description: text("description"),
  background: boolean("background").default(false),
  outputExtension: text("output_extension"),
  needsAdmin: boolean("needs_admin").default(false),
  opsecSafe: boolean("opsec_safe").default(true),
  software: text("software"),
  options: json("options").default({}),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const empireCredentials = pgTable("empire_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id").notNull().references(() => empireServers.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").references(() => empireAgents.id, { onDelete: "set null" }),
  operationId: uuid("operation_id").references(() => operations.id, { onDelete: "set null" }),
  empireCredentialId: text("empire_credential_id"),
  credType: text("cred_type").notNull(),
  domain: text("domain"),
  username: text("username").notNull(),
  password: text("password"),
  ntlmHash: text("ntlm_hash"),
  sha256Hash: text("sha256_hash"),
  host: text("host"),
  os: text("os"),
  sid: text("sid"),
  notes: text("notes"),
  harvestedAt: timestamp("harvested_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: json("metadata").default({}),
});

export const empireEvents = pgTable("empire_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id").notNull().references(() => empireServers.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").references(() => empireAgents.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  eventName: text("event_name").notNull(),
  message: text("message"),
  username: text("username"),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  eventData: json("event_data").default({}),
});

// ============================================================================
// MITRE ATT&CK INTEGRATION TABLES (10 tables)
// ============================================================================

export const attackTactics = pgTable("attack_tactics", {
  id: uuid("id").primaryKey().defaultRandom(),
  attackId: text("attack_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  shortName: text("short_name"),
  xMitreShortname: text("x_mitre_shortname"),
  stixId: text("stix_id").unique(),
  created: timestamp("created"),
  modified: timestamp("modified"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  metadata: json("metadata").default({}),
});

export const attackTechniques = pgTable("attack_techniques", {
  id: uuid("id").primaryKey().defaultRandom(),
  attackId: text("attack_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isSubtechnique: boolean("is_subtechnique").default(false),
  parentTechniqueId: uuid("parent_technique_id").references((): any => attackTechniques.id, { onDelete: "set null" }),
  stixId: text("stix_id").unique(),
  killChainPhases: text("kill_chain_phases").array(),
  platforms: attackPlatformEnum("platforms").array(),
  permissionsRequired: text("permissions_required").array(),
  effectivePermissions: text("effective_permissions").array(),
  defenseBypassed: text("defense_bypassed").array(),
  dataSources: text("data_sources").array(),
  detection: text("detection"),
  version: text("version"),
  created: timestamp("created"),
  modified: timestamp("modified"),
  deprecated: boolean("deprecated").default(false),
  revoked: boolean("revoked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  metadata: json("metadata").default({}),
  externalReferences: json("external_references").default([]),
  xMitreVersion: text("x_mitre_version"),
  xMitreDetection: text("x_mitre_detection"),
  xMitreDataSources: text("x_mitre_data_sources").array(),
  xMitreContributors: text("x_mitre_contributors").array(),
  xMitrePlatforms: text("x_mitre_platforms").array(),
  xMitreIsSubtechnique: boolean("x_mitre_is_subtechnique").default(false),
  xMitreImpactType: text("x_mitre_impact_type").array(),
});

export const attackGroups = pgTable("attack_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  attackId: text("attack_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  aliases: text("aliases").array(),
  stixId: text("stix_id").unique(),
  version: text("version"),
  created: timestamp("created"),
  modified: timestamp("modified"),
  deprecated: boolean("deprecated").default(false),
  revoked: boolean("revoked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  metadata: json("metadata").default({}),
  externalReferences: json("external_references").default([]),
  xMitreVersion: text("x_mitre_version"),
  xMitreContributors: text("x_mitre_contributors").array(),
});

export const attackSoftware = pgTable("attack_software", {
  id: uuid("id").primaryKey().defaultRandom(),
  attackId: text("attack_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  softwareType: text("software_type"),
  aliases: text("aliases").array(),
  platforms: attackPlatformEnum("platforms").array(),
  stixId: text("stix_id").unique(),
  version: text("version"),
  created: timestamp("created"),
  modified: timestamp("modified"),
  deprecated: boolean("deprecated").default(false),
  revoked: boolean("revoked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  metadata: json("metadata").default({}),
  externalReferences: json("external_references").default([]),
  xMitreVersion: text("x_mitre_version"),
  xMitreContributors: text("x_mitre_contributors").array(),
  xMitrePlatforms: text("x_mitre_platforms").array(),
});

export const attackMitigations = pgTable("attack_mitigations", {
  id: uuid("id").primaryKey().defaultRandom(),
  attackId: text("attack_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  stixId: text("stix_id").unique(),
  version: text("version"),
  created: timestamp("created"),
  modified: timestamp("modified"),
  deprecated: boolean("deprecated").default(false),
  revoked: boolean("revoked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  metadata: json("metadata").default({}),
  externalReferences: json("external_references").default([]),
  xMitreVersion: text("x_mitre_version"),
});

export const attackDataSources = pgTable("attack_data_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  attackId: text("attack_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  stixId: text("stix_id").unique(),
  platforms: attackPlatformEnum("platforms").array(),
  collectionLayers: text("collection_layers").array(),
  dataComponents: json("data_components").default([]),
  version: text("version"),
  created: timestamp("created"),
  modified: timestamp("modified"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  metadata: json("metadata").default({}),
  externalReferences: json("external_references").default([]),
  xMitreVersion: text("x_mitre_version"),
});

export const attackCampaigns = pgTable("attack_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  attackId: text("attack_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  aliases: text("aliases").array(),
  firstSeen: timestamp("first_seen"),
  lastSeen: timestamp("last_seen"),
  stixId: text("stix_id").unique(),
  version: text("version"),
  created: timestamp("created"),
  modified: timestamp("modified"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  metadata: json("metadata").default({}),
  externalReferences: json("external_references").default([]),
  xMitreVersion: text("x_mitre_version"),
  xMitreFirstSeenCitation: text("x_mitre_first_seen_citation"),
  xMitreLastSeenCitation: text("x_mitre_last_seen_citation"),
});

export const attackRelationships = pgTable("attack_relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  stixId: text("stix_id").unique(),
  relationshipType: text("relationship_type").notNull(),
  sourceType: attackObjectTypeEnum("source_type").notNull(),
  sourceRef: text("source_ref").notNull(),
  targetType: attackObjectTypeEnum("target_type").notNull(),
  targetRef: text("target_ref").notNull(),
  description: text("description"),
  created: timestamp("created"),
  modified: timestamp("modified"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  metadata: json("metadata").default({}),
});

export const operationAttackMapping = pgTable("operation_attack_mapping", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").notNull().references(() => operations.id, { onDelete: "cascade" }),
  techniqueId: uuid("technique_id").notNull().references(() => attackTechniques.id, { onDelete: "cascade" }),
  tacticId: uuid("tactic_id").references(() => attackTactics.id, { onDelete: "set null" }),
  status: text("status").default("planned"),
  coveragePercentage: integer("coverage_percentage").default(0),
  evidenceText: text("evidence_text"),
  notes: text("notes"),
  executedAt: timestamp("executed_at"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  metadata: json("metadata").default({}),
});

export const attackTechniqueTactics = pgTable("attack_technique_tactics", {
  id: uuid("id").primaryKey().defaultRandom(),
  techniqueId: uuid("technique_id").notNull().references(() => attackTechniques.id, { onDelete: "cascade" }),
  tacticId: uuid("tactic_id").notNull().references(() => attackTactics.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// Kasm Workspaces Integration
// ============================================================================

export const kasmWorkspaces = pgTable("kasm_workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  operationId: uuid("operation_id").references(() => operations.id, { onDelete: "set null" }),

  // Workspace configuration
  workspaceType: text("workspace_type").notNull(), // 'vscode', 'burp', 'kali', 'firefox', 'empire'
  workspaceName: text("workspace_name"),

  // Kasm identifiers
  kasmSessionId: text("kasm_session_id").notNull().unique(),
  kasmContainerId: text("kasm_container_id"),
  kasmUserId: text("kasm_user_id"),

  // Status and access
  status: text("status").notNull().default("starting"), // 'starting', 'running', 'stopped', 'failed'
  accessUrl: text("access_url"),
  internalIp: text("internal_ip"),

  // Resource limits
  cpuLimit: text("cpu_limit").default("2"), // CPU cores
  memoryLimit: text("memory_limit").default("4096M"), // Memory limit

  // Lifecycle management
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  lastAccessed: timestamp("last_accessed"),
  expiresAt: timestamp("expires_at").notNull(),
  terminatedAt: timestamp("terminated_at"),

  // Metadata
  metadata: json("metadata").default({}),
  errorMessage: text("error_message"),

  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const kasmSessions = pgTable("kasm_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").references(() => kasmWorkspaces.id, { onDelete: "cascade" }),

  // Session tracking
  sessionToken: text("session_token").unique(),
  kasmSessionId: text("kasm_session_id"),

  // Activity tracking
  lastActivity: timestamp("last_activity").defaultNow(),
  activityCount: integer("activity_count").default(0),

  // Connection info
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  // Session lifecycle
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  terminatedAt: timestamp("terminated_at"),

  metadata: json("metadata").default({}),
});

// ============================================================================
// RUST-NEXUS AGENTIC IMPLANTS INTEGRATION (5 tables)
// ============================================================================

export const rustNexusImplants = pgTable("rust_nexus_implants", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").references(() => operations.id, { onDelete: "cascade" }),

  // Implant Identity
  implantName: text("implant_name").notNull().unique(),
  implantType: implantTypeEnum("implant_type").notNull(),
  version: text("version").notNull(),

  // Target System Information
  hostname: text("hostname").notNull(),
  osType: text("os_type").notNull(),
  osVersion: text("os_version"),
  architecture: text("architecture").notNull(), // 'x86', 'x64', 'arm', 'arm64'
  ipAddress: text("ip_address"),
  macAddress: text("mac_address"),

  // Connection Status
  status: implantStatusEnum("status").notNull().default("registered"),
  lastHeartbeat: timestamp("last_heartbeat"),
  connectionQuality: integer("connection_quality").default(100),

  // Authentication
  certificateSerial: text("certificate_serial").notNull().unique(),
  certificateFingerprint: text("certificate_fingerprint").notNull(),
  authToken: text("auth_token").notNull(),

  // Capabilities
  capabilities: json("capabilities").default([]),
  maxConcurrentTasks: integer("max_concurrent_tasks").default(3),

  // AI Configuration
  aiProvider: text("ai_provider"), // 'openai', 'anthropic', 'local-llama', 'proxy'
  aiModel: text("ai_model"),
  autonomyLevel: integer("autonomy_level").default(1),

  // Statistics
  totalTasksCompleted: integer("total_tasks_completed").default(0),
  totalTasksFailed: integer("total_tasks_failed").default(0),
  totalBytesTransferred: integer("total_bytes_transferred").default(0),
  averageResponseTimeMs: integer("average_response_time_ms"),

  // Metadata
  metadata: json("metadata").default({}),
  tags: text("tags").array().default([]),

  // Timestamps
  registeredAt: timestamp("registered_at").notNull().defaultNow(),
  firstConnectionAt: timestamp("first_connection_at"),
  lastConnectionAt: timestamp("last_connection_at"),
  terminatedAt: timestamp("terminated_at"),

  // Audit
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const rustNexusTasks = pgTable("rust_nexus_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  implantId: uuid("implant_id").notNull().references(() => rustNexusImplants.id, { onDelete: "cascade" }),
  operationId: uuid("operation_id").references(() => operations.id, { onDelete: "cascade" }),
  workflowId: uuid("workflow_id").references(() => agentWorkflows.id, { onDelete: "set null" }),

  // Task Definition
  taskType: rustNexusTaskTypeEnum("task_type").notNull(),
  taskName: text("task_name").notNull(),
  taskDescription: text("task_description"),

  // Task Payload
  command: text("command"),
  parameters: json("parameters").default({}),
  environmentVars: json("environment_vars").default({}),

  // Execution Control
  priority: integer("priority").default(5),
  timeoutSeconds: integer("timeout_seconds").default(300),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),

  // Status Tracking
  status: rustNexusTaskStatusEnum("status").notNull().default("queued"),
  progressPercentage: integer("progress_percentage").default(0),

  // AI Decision Making
  requiresAiApproval: boolean("requires_ai_approval").default(false),
  aiApproved: boolean("ai_approved"),
  aiReasoning: text("ai_reasoning"),

  // Execution Metadata
  assignedAt: timestamp("assigned_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  executionTimeMs: integer("execution_time_ms"),

  // Error Handling
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),

  // Dependencies
  dependsOnTaskIds: text("depends_on_task_ids").array().default([]),
  blocksTaskIds: text("blocks_task_ids").array().default([]),

  // Metadata
  metadata: json("metadata").default({}),
  tags: text("tags").array().default([]),

  // Audit
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const rustNexusTaskResults = pgTable("rust_nexus_task_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => rustNexusTasks.id, { onDelete: "cascade" }),
  implantId: uuid("implant_id").notNull().references(() => rustNexusImplants.id, { onDelete: "cascade" }),

  // Result Data
  resultType: text("result_type").notNull(), // 'stdout', 'stderr', 'file', 'json', 'binary', 'error'
  resultData: text("result_data"),
  resultJson: json("result_json"),

  // File Results
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  fileHash: text("file_hash"),
  fileMimeType: text("file_mime_type"),

  // Execution Metrics
  exitCode: integer("exit_code"),
  executionTimeMs: integer("execution_time_ms").notNull(),
  memoryUsedMb: integer("memory_used_mb"),
  cpuUsagePercent: integer("cpu_usage_percent"),

  // Output Parsing
  parsedSuccessfully: boolean("parsed_successfully").default(false),
  parsingErrors: text("parsing_errors"),
  extractedData: json("extracted_data"),

  // Security Indicators
  containsCredentials: boolean("contains_credentials").default(false),
  containsSensitiveData: boolean("contains_sensitive_data").default(false),
  securityFlags: text("security_flags").array().default([]),

  // Metadata
  metadata: json("metadata").default({}),

  // Timestamps
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rustNexusCertificates = pgTable("rust_nexus_certificates", {
  id: uuid("id").primaryKey().defaultRandom(),
  implantId: uuid("implant_id").references(() => rustNexusImplants.id, { onDelete: "cascade" }),

  // Certificate Identity
  certificateType: rustNexusCertificateTypeEnum("certificate_type").notNull(),
  serialNumber: text("serial_number").notNull().unique(),
  fingerprintSha256: text("fingerprint_sha256").notNull().unique(),

  // Subject Information
  commonName: text("common_name").notNull(),
  organization: text("organization"),
  organizationalUnit: text("organizational_unit"),
  country: text("country"),

  // Certificate Data
  certificatePem: text("certificate_pem").notNull(),
  publicKeyPem: text("public_key_pem").notNull(),

  // Validity
  notBefore: timestamp("not_before").notNull(),
  notAfter: timestamp("not_after").notNull(),
  isValid: boolean("is_valid").default(true),

  // Revocation
  revoked: boolean("revoked").default(false),
  revokedAt: timestamp("revoked_at"),
  revocationReason: text("revocation_reason"),
  revokedBy: uuid("revoked_by").references(() => users.id),

  // CA Information
  issuerCommonName: text("issuer_common_name").notNull(),
  issuerFingerprint: text("issuer_fingerprint"),
  caCertificateId: uuid("ca_certificate_id"),

  // Usage Tracking
  lastUsedAt: timestamp("last_used_at"),
  usageCount: integer("usage_count").default(0),

  // Rotation
  rotationScheduledAt: timestamp("rotation_scheduled_at"),
  rotationCompletedAt: timestamp("rotation_completed_at"),
  successorCertificateId: uuid("successor_certificate_id"),

  // Metadata
  metadata: json("metadata").default({}),

  // Audit
  issuedBy: uuid("issued_by").notNull().references(() => users.id),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const rustNexusTelemetry = pgTable("rust_nexus_telemetry", {
  id: uuid("id").primaryKey().defaultRandom(),
  implantId: uuid("implant_id").notNull().references(() => rustNexusImplants.id, { onDelete: "cascade" }),

  // System Metrics
  cpuUsagePercent: integer("cpu_usage_percent"),
  memoryUsageMb: integer("memory_usage_mb"),
  memoryTotalMb: integer("memory_total_mb"),
  diskUsageGb: integer("disk_usage_gb"),
  diskTotalGb: integer("disk_total_gb"),

  // Network Metrics
  networkLatencyMs: integer("network_latency_ms"),
  networkBandwidthKbps: integer("network_bandwidth_kbps"),
  packetsSent: integer("packets_sent"),
  packetsReceived: integer("packets_received"),
  bytesSent: integer("bytes_sent"),
  bytesReceived: integer("bytes_received"),

  // Process Metrics
  processCount: integer("process_count"),
  threadCount: integer("thread_count"),
  handleCount: integer("handle_count"),
  uptimeSeconds: integer("uptime_seconds"),

  // Task Metrics
  activeTasks: integer("active_tasks").default(0),
  queuedTasks: integer("queued_tasks").default(0),
  completedTasksLastHour: integer("completed_tasks_last_hour").default(0),
  failedTasksLastHour: integer("failed_tasks_last_hour").default(0),

  // Connection Metrics
  connectionDropsCount: integer("connection_drops_count").default(0),
  reconnectionAttempts: integer("reconnection_attempts").default(0),
  lastConnectionError: text("last_connection_error"),

  // Health Status
  healthStatus: healthStatusEnum("health_status").notNull(),
  healthScore: integer("health_score"),
  healthIssues: text("health_issues").array().default([]),

  // Anomaly Detection
  anomalyDetected: boolean("anomaly_detected").default(false),
  anomalyType: text("anomaly_type"),
  anomalySeverity: text("anomaly_severity"), // 'low', 'medium', 'high', 'critical'
  anomalyDescription: text("anomaly_description"),

  // Security Events
  securityEventsCount: integer("security_events_count").default(0),
  lastSecurityEvent: text("last_security_event"),
  lastSecurityEventAt: timestamp("last_security_event_at"),

  // AI Metrics (if implant has local AI)
  aiInferenceCount: integer("ai_inference_count").default(0),
  aiAverageLatencyMs: integer("ai_average_latency_ms"),
  aiErrorCount: integer("ai_error_count").default(0),

  // Custom Metrics
  customMetrics: json("custom_metrics").default({}),

  // Metadata
  metadata: json("metadata").default({}),

  // Timestamps
  collectedAt: timestamp("collected_at").notNull(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// OLLAMA AI INTEGRATION TABLES
// Enhancement #08 - Ollama AI
// ============================================================================

export const ollamaModels = pgTable("ollama_models", {
  id: uuid("id").primaryKey().defaultRandom(),
  modelName: text("model_name").notNull().unique(),
  modelTag: text("model_tag").default("latest"),
  modelSize: integer("model_size"), // Size in bytes (using integer for now)
  parameterSize: text("parameter_size"), // e.g., "8b", "7b"
  quantization: text("quantization"), // e.g., "q4_0", "q8_0"
  downloadedAt: timestamp("downloaded_at").defaultNow(),
  lastUsed: timestamp("last_used"),
  usageCount: integer("usage_count").default(0),
  status: ollamaModelStatusEnum("status").default("available"),
  metadata: json("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiEnrichmentLogs = pgTable("ai_enrichment_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  vulnerabilityId: uuid("vulnerability_id").references(() => vulnerabilities.id, { onDelete: "cascade" }),
  modelUsed: text("model_used").notNull(), // e.g., "llama3:8b", "qwen2.5-coder:7b", "gpt-4"
  provider: aiProviderEnum("provider").notNull().default("ollama"),
  enrichmentType: text("enrichment_type").notNull(), // e.g., "description", "impact", "remediation", "cve_matching"
  prompt: text("prompt").notNull(),
  response: text("response"),
  tokensUsed: integer("tokens_used"), // Total tokens (prompt + completion)
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  durationMs: integer("duration_ms"), // Time taken for inference
  temperature: real("temperature").default(0.7),
  maxTokens: integer("max_tokens"),
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  metadata: json("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// AGENT DEPLOYMENT TABLES
// Enhancement #04 - Agentic Implants Deployment
// ============================================================================

// Agent builds table - tracks Docker-based compilation jobs
export const agentBuilds = pgTable("agent_builds", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Build configuration
  status: agentBuildStatusEnum("status").notNull().default("pending"),
  platform: agentPlatformEnum("platform").notNull(),
  architecture: agentArchitectureEnum("architecture").notNull().default("x64"),
  features: json("features").default([]), // Cargo feature flags: anti-debug, anti-vm, etc.

  // Build output
  binaryPath: text("binary_path"),
  binarySize: integer("binary_size"),
  binaryHash: text("binary_hash"), // SHA256 hash

  // Build logs and metrics
  buildLog: text("build_log"),
  buildDurationMs: integer("build_duration_ms"),

  // Error handling
  errorMessage: text("error_message"),

  // Metadata
  metadata: json("metadata").default({}),

  // Audit
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Agent bundles table - stores generated agent packages (binary + certs + config)
export const agentBundles = pgTable("agent_bundles", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Bundle identification
  name: text("name").notNull(),
  platform: agentPlatformEnum("platform").notNull(),
  architecture: agentArchitectureEnum("architecture").notNull().default("x64"),

  // Associated build
  buildId: uuid("build_id").references(() => agentBuilds.id, { onDelete: "set null" }),

  // Certificate info
  certificateId: uuid("certificate_id").references(() => rustNexusCertificates.id, { onDelete: "set null" }),
  certificateSerial: text("certificate_serial").notNull(),
  certificateFingerprint: text("certificate_fingerprint").notNull(),

  // Bundle file
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  fileHash: text("file_hash").notNull(), // SHA256 hash

  // Configuration
  controllerUrl: text("controller_url").notNull(),
  implantType: implantTypeEnum("implant_type").default("general"),

  // Status
  isActive: boolean("is_active").notNull().default(true),
  downloadCount: integer("download_count").notNull().default(0),

  // Metadata
  metadata: json("metadata").default({}),

  // Audit
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

// Agent download tokens table - shareable download links for customers
export const agentDownloadTokens = pgTable("agent_download_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Token identification
  token: text("token").notNull().unique(),
  bundleId: uuid("bundle_id").notNull().references(() => agentBundles.id, { onDelete: "cascade" }),

  // Token constraints
  maxDownloads: integer("max_downloads").notNull().default(1),
  currentDownloads: integer("current_downloads").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),

  // Access control (optional)
  allowedIpRanges: json("allowed_ip_ranges").default([]), // CIDR ranges

  // Metadata
  description: text("description"),
  metadata: json("metadata").default({}),

  // Audit
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
  revokedAt: timestamp("revoked_at"),
  revokedBy: uuid("revoked_by").references(() => users.id),
});
