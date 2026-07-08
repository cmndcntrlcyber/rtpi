// Side-effect import: runs dotenv.config() at import time so .env is loaded
// BEFORE any subsequent import evaluates module-level code (e.g. service
// singletons that read process.env in their constructor). Required for ESM
// because import statements hoist above executable code — `dotenv.config()`
// on line 2 of the module body would otherwise run too late.
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { writeFileSync, unlinkSync } from "fs";
import { logger } from "./lib/logger";
import { requestIdMiddleware } from "./middleware/request-id";
import { metricsRegistry, httpRequestDuration } from "./lib/metrics";
import { waitForDatabase } from "./db";
import { client as dbClient } from "./db";
import { sessionMiddleware, redisClient, connectRedis } from "./auth/session";
import passport from "./auth/strategies/local";
import "./auth/strategies/google";
import "./auth/strategies/apikey";
import { apiLimiter } from "./middleware/rate-limit";
import authRoutes from "./api/v1/auth";
import operationsRoutes from "./api/v1/operations";
import targetsRoutes from "./api/v1/targets";
import vulnerabilitiesRoutes from "./api/v1/vulnerabilities";
import vulnerabilityTemplatesRoutes from "./api/v1/vulnerability-templates";
import agentsRoutes from "./api/v1/agents";
import devicesRoutes from "./api/v1/devices";
import mcpServersRoutes from "./api/v1/mcp-servers";
import containersRoutes from "./api/v1/containers";
import healthChecksRoutes from "./api/v1/health-checks";
import reportsRoutes from "./api/v1/reports";
import toolsRoutes from "./api/v1/tools";
import skillImportRoutes from "./api/v1/skill-import";
import toolSkillsRoutes from "./api/v1/tool-skills";
import skillsCatalogRoutes from "./api/v1/skills-catalog";
import skillsRoutes from "./api/v1/skills";
import orchestratorRoutes from "./api/v1/orchestrator";
import settingsRoutes from "./api/v1/settings";
import agentLoopsRoutes from "./api/v1/agent-loops";
import agentMcpRoutes from "./api/v1/agent-mcp";
import agentWorkflowsRoutes from "./api/v1/agent-workflows";
import agentFlowsRoutes from "./api/v1/agent-flows";
import metasploitRoutes from "./api/v1/metasploit";
import surfaceAssessmentRoutes from "./api/v1/surface-assessment";
import usersRoutes from "./api/v1/users";
import empireRoutes from "./api/v1/empire";
import sliverRoutes from "./api/v1/sliver";
import attackRoutes from "./api/v1/attack";
import attackFlowsRoutes from "./api/v1/attack-flows";
import workbenchRoutes from "./api/v1/workbench";
import researchRoutes from "./api/v1/research";
import toolMigrationRoutes from "./api/v1/tool-migration";
import toolWorkflowsRoutes from "./api/v1/tool-workflows";
import agentToolValidationRoutes from "./api/v1/agent-tool-validation";
import kasmWorkspacesRoutes from "./api/v1/kasm-workspaces";
import kasmProxyRoutes from "./api/v1/kasm-proxy";
import sslCertificatesRoutes from "./api/v1/ssl-certificates";
import burpBuilderRoutes from "./api/v1/burp-builder";
import burpActivationRoutes from "./api/v1/burp-activation";
import rustNexusRoutes from "./api/v1/rust-nexus";
import agentPublicRoutes from "./api/v1/agent-public";
import ollamaRoutes from "./api/v1/ollama";
import notificationsRoutes from "./api/v1/notifications";
import filterPresetsRoutes from "./api/v1/filter-presets";
import offsecRdProjectsRoutes from "./api/v1/offsec-rd-projects";
import offsecRdExperimentsRoutes from "./api/v1/offsec-rd-experiments";
import offsecRdArtifactsRoutes from "./api/v1/offsec-rd-artifacts";
import offsecRdKnowledgeRoutes from "./api/v1/offsec-rd-knowledge";
import offsecRdToolsRoutes from "./api/v1/offsec-rd-tools";
import vulnerabilityRdRoutes from "./api/v1/vulnerability-rd";
import operationsManagementRoutes from "./api/v1/operations-management";
import scanSchedulesRoutes from "./api/v1/scan-schedules";
import offsecAgentsRoutes from "./api/v1/offsec-agents";
import nucleiTemplatesRoutes from "./api/v1/nuclei-templates";
import reportersRoutes from "./api/v1/reporters";
import memoryRoutes from "./api/v1/memory";
import agentMessagesRoutes from "./api/v1/agent-messages";
import automationPipelineRoutes from "./api/v1/automation-pipeline";
import atlasRoutes from "./api/v1/atlas";
import owaspLlmRoutes from "./api/v1/owasp-llm";
import nistAiRoutes from "./api/v1/nist-ai";
import frameworkMappingsRoutes from "./api/v1/framework-mappings";
import frameworkBindingsRoutes from "./api/v1/framework-bindings";
import cisRoutes from "./api/v1/cis";
import agentToolBuildsRoutes from "./api/v1/agent-tool-builds";
import scanImportRoutes from "./api/v1/scan-import";
import vulnerabilityInvestigationRoutes from "./api/v1/vulnerability-investigation";
import bugBountyImportRoutes from "./api/v1/bug-bounty-import";
import agentChatRoutes from "./api/v1/agent-chat";
import bugHunterAdminRoutes from "./api/v1/bug-hunter/admin";
import bugHunterWorkflowsRoutes from "./api/v1/bug-hunter/workflows";
import bugHunterQueriesRoutes from "./api/v1/bug-hunter/queries";
import bugHunterMemoryRoutes from "./api/v1/bug-hunter/memory";
import c2WarroomRoutes from "./api/v1/c2-warroom";
import sysreptorRoutes from "./api/v1/sysreptor";
import inferenceRoutes from "./api/v1/inference";
import ctiRoutes from "./api/v1/cti";
import knowledgeRoutes from "./api/v1/knowledge";
import stixRoutes from "./api/v1/stix";
import docmostRoutes from "./api/v1/docmost";
import frameworkDeployRoutes from "./api/v1/framework-deploy";
import infrastructureCertificatesRoutes from "./api/v1/infrastructure-certificates";
import "./services/rd-feedback-loop"; // Activate R&D tool testing feedback loop
import { initializeDefaultAdmin } from "./services/admin-initialization";
import { opsManagerScheduler } from "./services/ops-manager-scheduler";
import { scanScheduler } from "./services/scan-scheduler";
import { initializeAgentSystem, shutdownAgentSystem } from "./services/workflow-event-handlers";
import { startAuditLogCleanup, stopAuditLogCleanup } from "./services/audit-log-cleanup";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Trust proxy (Vite dev server, nginx reverse proxy)
app.set("trust proxy", 1);

// Middleware
app.use(requestIdMiddleware);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
);
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://0.0.0.0:5000",
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session management
app.use(sessionMiddleware);

// Passport authentication
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting
app.use(apiLimiter);

// HTTP request duration tracking
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    const route = req.route?.path || req.path;
    end({ method: req.method, route, status_code: res.statusCode });
  });
  next();
});

// Prometheus metrics endpoint (no session auth — scrapers don't carry cookies)
app.get("/metrics", async (req, res) => {
  const token = process.env.METRICS_AUTH_TOKEN;
  if (token && req.headers.authorization !== `Bearer ${token}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.set("Content-Type", metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

// Health endpoints (unauthenticated — probed by Docker, K8s, rtpi-watcher)
app.get("/api/v1/health", async (_req, res) => {
  const { fullHealthCheck } = await import("./lib/health");
  const result = await fullHealthCheck();
  res.status(result.status === "unhealthy" ? 503 : 200).json(result);
});

app.get("/api/v1/health/live", (_req, res) => {
  res.json({ status: "alive" });
});

app.get("/api/v1/health/ready", async (_req, res) => {
  const { checkDB, checkRedis } = await import("./lib/health");
  const [db, redis] = await Promise.all([checkDB(), checkRedis()]);
  const ready = db.ok && redis.ok;
  res.status(ready ? 200 : 503).json({
    ready,
    database: db,
    redis,
  });
});

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/operations", operationsRoutes);
app.use("/api/v1/targets", targetsRoutes);
app.use("/api/v1/vulnerabilities", vulnerabilitiesRoutes);
app.use("/api/v1/vulnerability-templates", vulnerabilityTemplatesRoutes);
app.use("/api/v1/agents", agentsRoutes);
app.use("/api/v1/devices", devicesRoutes);
app.use("/api/v1/mcp-servers", mcpServersRoutes);
app.use("/api/v1/containers", containersRoutes);
app.use("/api/v1/health-checks", healthChecksRoutes);
app.use("/api/v1/reports", reportsRoutes);
app.use("/api/v1/tools", toolsRoutes);
app.use("/api/v1/skills", skillImportRoutes);
app.use("/api/v1/tool-skills", toolSkillsRoutes);
app.use("/api/v1/skills", skillsCatalogRoutes);
// LangGraph skill search/cache proxy. Mounted AFTER the import/catalog routers
// so its catch-all GET /:skillName only handles paths they don't claim.
app.use("/api/v1/skills", skillsRoutes);
// LangGraph orchestrator proxy (rtpi-orchestrator service, ORCHESTRATOR_URL).
app.use("/api/v1/orchestrator", orchestratorRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/agent-loops", agentLoopsRoutes);
app.use("/api/v1/agents", agentMcpRoutes);
app.use("/api/v1/agent-workflows", agentWorkflowsRoutes);
app.use("/api/v1/agent-flows", agentFlowsRoutes);
app.use("/api/v1/metasploit", metasploitRoutes);
app.use("/api/v1/surface-assessment", surfaceAssessmentRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/empire", empireRoutes);
app.use("/api/v1/sliver", sliverRoutes);
app.use("/api/v1/c2-warroom", c2WarroomRoutes);
app.use("/api/v1/sysreptor", sysreptorRoutes);
app.use("/api/v1/inference", inferenceRoutes);
app.use("/api/v1/cti", ctiRoutes);
app.use("/api/v1/knowledge", knowledgeRoutes);
app.use("/api/v1/stix", stixRoutes);
app.use("/api/v1/docmost", docmostRoutes);
app.use("/api/v1/deployments", frameworkDeployRoutes);
app.use("/api/v1/infrastructure/certificates", infrastructureCertificatesRoutes);
app.use("/api/v1/attack", attackRoutes);
app.use("/api/v1/attack-flows", attackFlowsRoutes);
app.use("/api/v1/workbench", workbenchRoutes);
app.use("/api/v1/research", researchRoutes);
app.use("/api/v1/tool-migration", toolMigrationRoutes);
app.use("/api/v1/tool-workflows", toolWorkflowsRoutes);
app.use("/api/v1/agent-tool-validation", agentToolValidationRoutes);
app.use("/api/v1/kasm-workspaces", kasmWorkspacesRoutes);
app.use("/api/v1/kasm-proxy", kasmProxyRoutes);
app.use("/api/v1/ssl-certificates", sslCertificatesRoutes);
app.use("/api/v1/burp-builder", burpBuilderRoutes);
app.use("/api/v1/burp-activation", burpActivationRoutes);
app.use("/api/v1/rust-nexus", rustNexusRoutes);
app.use("/api/v1/public", agentPublicRoutes); // Public endpoints (no auth)
app.use("/api/v1/ollama", ollamaRoutes);
app.use("/api/v1/notifications", notificationsRoutes);
app.use("/api/v1/filter-presets", filterPresetsRoutes);
app.use("/api/v1/offsec-rd/projects", offsecRdProjectsRoutes);
app.use("/api/v1/offsec-rd/experiments", offsecRdExperimentsRoutes);
// B1: artifact promote/deploy routes are mounted here at /api/v1/offsec-rd/artifacts
// to match the frontend URL. They previously lived under the experiments router, so
// the real path was …/experiments/artifacts and the frontend POST always 404'd.
app.use("/api/v1/offsec-rd/artifacts", offsecRdArtifactsRoutes);
app.use("/api/v1/offsec-rd/knowledge", offsecRdKnowledgeRoutes);
app.use("/api/v1/offsec-rd/tools", offsecRdToolsRoutes);
app.use("/api/v1/vulnerability-rd", vulnerabilityRdRoutes);
app.use("/api/v1/operations-management", operationsManagementRoutes);
app.use("/api/v1/scan-schedules", scanSchedulesRoutes);
app.use("/api/v1/offsec-agents", offsecAgentsRoutes);
app.use("/api/v1/nuclei-templates", nucleiTemplatesRoutes);
app.use("/api/v1/reporters", reportersRoutes);
app.use("/api/v1/memory", memoryRoutes);
app.use("/api/v1/agent-messages", agentMessagesRoutes);
app.use("/api/v1/automation-pipeline", automationPipelineRoutes);
app.use("/api/v1/atlas", atlasRoutes);
app.use("/api/v1/owasp-llm", owaspLlmRoutes);
app.use("/api/v1/nist-ai", nistAiRoutes);
app.use("/api/v1/framework-mappings", frameworkMappingsRoutes);
app.use("/api/v1/frameworks", frameworkBindingsRoutes);
app.use("/api/v1/cis", cisRoutes);
app.use("/api/v1/agent-tool-builds", agentToolBuildsRoutes);
app.use("/api/v1/scan-import", scanImportRoutes);
app.use("/api/v1/vulnerability-investigation", vulnerabilityInvestigationRoutes);
app.use("/api/v1/bug-bounty-import", bugBountyImportRoutes);
app.use("/api/v1/agent-chat", agentChatRoutes);

// Bug-hunter admin/introspection routes (FF_BUG_HUNTER). Workflow + query
// endpoints land in subsequent PRs (workflows.ts, queries.ts, memory.ts).
// The route file itself enforces the flag, but we still gate the mount to
// avoid a stray import path if disabled.
if (
  ["true", "1", "yes", "on"].includes(
    (process.env.FF_BUG_HUNTER ?? "").toLowerCase(),
  )
) {
  app.use("/api/v1/bug-hunter/admin", bugHunterAdminRoutes);
  // Specific sub-paths mounted first so they win over the catch-all workflows
  // router that owns top-level verbs like /hunt, /recon, /report, etc.
  app.use("/api/v1/bug-hunter", bugHunterQueriesRoutes);
  app.use("/api/v1/bug-hunter", bugHunterMemoryRoutes);
  app.use("/api/v1/bug-hunter", bugHunterWorkflowsRoutes);
}

// Root endpoint
app.get("/api/v1", (_req, res) => {
  res.json({
    name: "RTPI API",
    version: "1.0.0-beta.1",
    endpoints: {
      health: "/api/v1/health",
      auth: "/api/v1/auth",
      operations: "/api/v1/operations",
      targets: "/api/v1/targets",
      vulnerabilities: "/api/v1/vulnerabilities",
      agents: "/api/v1/agents",
      devices: "/api/v1/devices",
      mcpServers: "/api/v1/mcp-servers",
      containers: "/api/v1/containers",
      healthChecks: "/api/v1/health-checks",
      reports: "/api/v1/reports",
      tools: "/api/v1/tools",
      toolSkills: "/api/v1/tool-skills",
      settings: "/api/v1/settings",
      agentLoops: "/api/v1/agent-loops",
      agentWorkflows: "/api/v1/agent-workflows",
      metasploit: "/api/v1/metasploit",
      empire: "/api/v1/empire",
      attack: "/api/v1/attack",
      workbench: "/api/v1/workbench",
      kasmWorkspaces: "/api/v1/kasm-workspaces",
      kasmProxy: "/api/v1/kasm-proxy",
      sslCertificates: "/api/v1/ssl-certificates",
      burpBuilder: "/api/v1/burp-builder",
      burpActivation: "/api/v1/burp-activation",
      rustNexus: "/api/v1/rust-nexus",
      ollama: "/api/v1/ollama",
      operationsManagement: "/api/v1/operations-management",
      agentMessages: "/api/v1/agent-messages",
      scanSchedules: "/api/v1/scan-schedules",
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    path: req.path,
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err, requestId: _req.id }, "Unhandled error");
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
    requestId: _req.id,
  });
});

// Initialize database and default admin user
async function initializeServer() {
  const READY_FILE = process.env.RTPI_READY_FILE || "/tmp/rtpi-ready";

  try {
    // Wait for database with retry (tolerates infra still starting)
    await waitForDatabase();
    logger.info("Database connection successful");

    // Wait for Redis with retry
    await connectRedis();
    logger.info("Redis connection successful");

    // Initialize default admin user
    await initializeDefaultAdmin();

    // Self-repair tool_registry rows with missing baseCommand/parameters.
    // Non-fatal — logs a summary line and continues on any failure.
    try {
      const { repairToolRegistryConfigs } = await import("./services/tool-executor");
      await repairToolRegistryConfigs();
    } catch (repairErr) {
      logger.warn({ err: repairErr }, "tool_registry self-repair skipped");
    }

    // Bootstrap MITRE ATT&CK data if the DB is empty. Non-fatal.
    try {
      const { bootstrapAttackData } = await import("./services/attack-bootstrap");
      await bootstrapAttackData();
    } catch (attackErr) {
      logger.warn({ err: attackErr }, "MITRE ATT&CK bootstrap skipped");
    }

    // Start server
    const server = app.listen(PORT, "0.0.0.0", () => {
      logger.info({ port: PORT, url: `http://0.0.0.0:${PORT}` }, "Server started");
      logger.info({ docs: `http://0.0.0.0:${PORT}/api/v1` }, "API documentation available");

      // Write readiness file so external probes (rtpi-watcher) can distinguish
      // "still booting" from "crashed"
      try {
        writeFileSync(READY_FILE, String(process.pid));
        logger.info({ readyFile: READY_FILE }, "Readiness file written");
      } catch (err) {
        logger.warn({ err }, "Could not write readiness file");
      }
    });

    // Configure timeouts for long-running scan operations
    server.setTimeout(7200000); // 2 hours - matches Nuclei's longest timeout
    server.requestTimeout = 7200000; // Node 18+ explicit request timeout
    server.headersTimeout = 7210000; // Slightly higher than request timeout
    server.keepAliveTimeout = 65000; // Keep connections alive
    logger.info({ timeoutMs: 7200000 }, "Server timeouts configured for long-running scans");

    // Initialize unified Agent WebSocket manager (handles agent events + scan streaming + approval gates)
    const { initializeAgentWebSocketManager } = await import("./services/agent-websocket-manager");
    initializeAgentWebSocketManager(server);
    logger.info("Agent WebSocket server ready");

    // Start Operations Manager Scheduler
    opsManagerScheduler.start();
    logger.info("Operations Manager Scheduler started");

    // Start Scan Scheduler
    await scanScheduler.start();
    logger.info("Scan Scheduler started");

    // Start Audit Log Cleanup (daily at 03:00 UTC)
    startAuditLogCleanup();

    // B10: auto-seed the bug-hunter skill corpus into knowledge_base
    // (FF_BUG_HUNTER). Self-gated + count-gated + delayed; fully detached so it
    // never blocks or crashes boot. See services/knowledge/skill-seed-startup.ts.
    import("./services/knowledge/skill-seed-startup")
      .then(({ scheduleBugHunterSkillSeed }) => scheduleBugHunterSkillSeed())
      .catch((err) => logger.warn({ err }, "Skill seed scheduling failed"));
    // Warm the inference model cache so the router can validate Settings-
    // chosen models against actual provider availability on the first call.
    // Fire-and-forget — failure here just means router falls back to
    // "trust the name" until the first manual refresh.
    setTimeout(() => {
      import("./services/inference/model-cache")
        .then(({ modelCache }) => modelCache.refresh())
        .then(() => logger.info("Inference model cache warmed"))
        .catch((err) => logger.warn({ err }, "Inference model cache warm failed"));
    }, 2000);

    // Start the Agent-MCP connector: live tool discovery + rehydrate the
    // in-memory agent→MCP attachment map from agents.config so assignments
    // survive restarts (was never started before, so the map began empty every
    // boot). Delayed + detached; non-fatal. See agent-mcp-connector.ts.
    setTimeout(() => {
      import("./services/agent-mcp-connector")
        .then(({ agentMCPConnector }) => agentMCPConnector.start())
        .catch((err) => logger.warn({ err }, "Agent-MCP connector start failed"));
    }, 6000);

    // Initialize v2.1 Autonomous Agent System
    if (process.env.AGENT_AUTO_INITIALIZE !== "false") {
      try {
        await initializeAgentSystem();
        logger.info("Agent System initialized");
      } catch (agentError) {
        logger.warn({ err: agentError }, "Agent System initialization failed (non-fatal)");
      }
    } else {
      logger.info("Agent System auto-initialization disabled");
    }

    // Graceful shutdown
    const shutdown = async () => {
      logger.info("Shutting down gracefully...");

      // Stop accepting new connections first
      server.close(() => logger.info("HTTP server closed"));

      opsManagerScheduler.shutdown();
      await scanScheduler.stop();
      stopAuditLogCleanup();

      // Shutdown v2.1 Agent System
      try {
        await shutdownAgentSystem();
        logger.info("Agent System shutdown complete");
      } catch (agentError) {
        logger.warn({ err: agentError }, "Agent System shutdown error");
      }

      // Close Redis
      try {
        await redisClient.quit();
        logger.info("Redis client closed");
      } catch (redisErr) {
        logger.warn({ err: redisErr }, "Redis client close error");
      }

      // Drain database connection pool
      try {
        await dbClient.end({ timeout: 5 });
        logger.info("Database connection pool closed");
      } catch (dbErr) {
        logger.warn({ err: dbErr }, "Database pool close error");
      }

      // Remove readiness file
      try {
        unlinkSync(READY_FILE);
      } catch {}

      process.exit(0);
    };

    // Safety net: force exit if graceful shutdown hangs
    const forceExit = () => {
      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 10000).unref();
    };

    process.on("SIGTERM", () => { forceExit(); shutdown(); });
    process.on("SIGINT", () => { forceExit(); shutdown(); });
  } catch (error) {
    logger.fatal({ err: error }, "Server initialization failed");
    process.exit(1);
  }
}

// Start the server
initializeServer();
