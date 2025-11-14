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
