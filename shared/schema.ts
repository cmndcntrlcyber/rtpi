import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  json,
  pgEnum,
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
