import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { checkDatabaseConnection } from "./db";
import { sessionMiddleware } from "./auth/session";
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
import settingsRoutes from "./api/v1/settings";
import agentLoopsRoutes from "./api/v1/agent-loops";
import agentMcpRoutes from "./api/v1/agent-mcp";
import agentWorkflowsRoutes from "./api/v1/agent-workflows";
import metasploitRoutes from "./api/v1/metasploit";
import surfaceAssessmentRoutes from "./api/v1/surface-assessment";
import usersRoutes from "./api/v1/users";
import empireRoutes from "./api/v1/empire";
import attackRoutes from "./api/v1/attack";
import attackFlowsRoutes from "./api/v1/attack-flows";
import workbenchRoutes from "./api/v1/workbench";
import toolMigrationRoutes from "./api/v1/tool-migration";
import toolWorkflowsRoutes from "./api/v1/tool-workflows";
import agentToolValidationRoutes from "./api/v1/agent-tool-validation";
import kasmWorkspacesRoutes from "./api/v1/kasm-workspaces";
import kasmProxyRoutes from "./api/v1/kasm-proxy";
import sslCertificatesRoutes from "./api/v1/ssl-certificates";
import burpBuilderRoutes from "./api/v1/burp-builder";
import rustNexusRoutes from "./api/v1/rust-nexus";
import agentPublicRoutes from "./api/v1/agent-public";
import ollamaRoutes from "./api/v1/ollama";
import notificationsRoutes from "./api/v1/notifications";
import filterPresetsRoutes from "./api/v1/filter-presets";
import offsecRdProjectsRoutes from "./api/v1/offsec-rd-projects";
import offsecRdExperimentsRoutes from "./api/v1/offsec-rd-experiments";
import offsecRdKnowledgeRoutes from "./api/v1/offsec-rd-knowledge";
import offsecRdToolsRoutes from "./api/v1/offsec-rd-tools";
import vulnerabilityRdRoutes from "./api/v1/vulnerability-rd";
import operationsManagementRoutes from "./api/v1/operations-management";
import scanSchedulesRoutes from "./api/v1/scan-schedules";
import offsecAgentsRoutes from "./api/v1/offsec-agents";
import nucleiTemplatesRoutes from "./api/v1/nuclei-templates";
import reportersRoutes from "./api/v1/reporters";
import { initializeDefaultAdmin } from "./services/admin-initialization";
import { opsManagerScheduler } from "./services/ops-manager-scheduler";
import { scanScheduler } from "./services/scan-scheduler";
import { initializeAgentSystem, shutdownAgentSystem } from "./services/workflow-event-handlers";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://0.0.0.0:5000",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session management
app.use(sessionMiddleware);

// Passport authentication
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting
app.use(apiLimiter);

// Health check endpoint
app.get("/api/v1/health", async (_req, res) => {
  const dbHealthy = await checkDatabaseConnection();
  
  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    database: dbHealthy ? "connected" : "disconnected",
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
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/agent-loops", agentLoopsRoutes);
app.use("/api/v1/agents", agentMcpRoutes);
app.use("/api/v1/agent-workflows", agentWorkflowsRoutes);
app.use("/api/v1/metasploit", metasploitRoutes);
app.use("/api/v1/surface-assessment", surfaceAssessmentRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/empire", empireRoutes);
app.use("/api/v1/attack", attackRoutes);
app.use("/api/v1/attack-flows", attackFlowsRoutes);
app.use("/api/v1/workbench", workbenchRoutes);
app.use("/api/v1/tool-migration", toolMigrationRoutes);
app.use("/api/v1/tool-workflows", toolWorkflowsRoutes);
app.use("/api/v1/agent-tool-validation", agentToolValidationRoutes);
app.use("/api/v1/kasm-workspaces", kasmWorkspacesRoutes);
app.use("/api/v1/kasm-proxy", kasmProxyRoutes);
app.use("/api/v1/ssl-certificates", sslCertificatesRoutes);
app.use("/api/v1/burp-builder", burpBuilderRoutes);
app.use("/api/v1/rust-nexus", rustNexusRoutes);
app.use("/api/v1/public", agentPublicRoutes); // Public endpoints (no auth)
app.use("/api/v1/ollama", ollamaRoutes);
app.use("/api/v1/notifications", notificationsRoutes);
app.use("/api/v1/filter-presets", filterPresetsRoutes);
app.use("/api/v1/offsec-rd/projects", offsecRdProjectsRoutes);
app.use("/api/v1/offsec-rd/experiments", offsecRdExperimentsRoutes);
app.use("/api/v1/offsec-rd/knowledge", offsecRdKnowledgeRoutes);
app.use("/api/v1/offsec-rd/tools", offsecRdToolsRoutes);
app.use("/api/v1/vulnerability-rd", vulnerabilityRdRoutes);
app.use("/api/v1/operations-management", operationsManagementRoutes);
app.use("/api/v1/scan-schedules", scanSchedulesRoutes);
app.use("/api/v1/offsec-agents", offsecAgentsRoutes);
app.use("/api/v1/nuclei-templates", nucleiTemplatesRoutes);
app.use("/api/v1/reporters", reportersRoutes);

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
      rustNexus: "/api/v1/rust-nexus",
      ollama: "/api/v1/ollama",
      operationsManagement: "/api/v1/operations-management",
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
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Initialize database and default admin user
async function initializeServer() {
  try {
    // Check database connection
    const dbHealthy = await checkDatabaseConnection();
    if (!dbHealthy) {
      console.error("❌ Database connection failed");
      process.exit(1);
    }
    console.log("✅ Database connection successful");

    // Initialize default admin user
    await initializeDefaultAdmin();

    // Start server
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`📚 API documentation: http://0.0.0.0:${PORT}/api/v1`);
    });

    // Configure timeouts for long-running scan operations
    server.setTimeout(7200000); // 2 hours - matches Nuclei's longest timeout
    server.requestTimeout = 7200000; // Node 18+ explicit request timeout
    server.headersTimeout = 7210000; // Slightly higher than request timeout
    server.keepAliveTimeout = 65000; // Keep connections alive
    console.log(`⏱️  Server timeouts configured for long-running scans (2 hour limit)`);

    // FIX BUG #4: Initialize WebSocket manager for real-time scan progress
    const { initializeScanWebSocketManager } = await import("./services/scan-websocket-manager");
    initializeScanWebSocketManager(server);
    console.log(`🔌 WebSocket server ready for scan streaming`);

    // Start Operations Manager Scheduler
    opsManagerScheduler.start();
    console.log(`⏰ Operations Manager Scheduler started (runs hourly)`);

    // Start Scan Scheduler
    await scanScheduler.start();
    console.log(`⏰ Scan Scheduler started for scheduled security scans`);

    // Initialize v2.1 Autonomous Agent System
    if (process.env.AGENT_AUTO_INITIALIZE !== "false") {
      try {
        await initializeAgentSystem();
        console.log(`🤖 Agent System initialized (Tool Connector, Surface Assessment, Web Hacker)`);
      } catch (agentError) {
        // Non-fatal - agents can be initialized later via API
        console.warn(`⚠️  Agent System initialization failed (non-fatal):`, agentError);
      }
    } else {
      console.log(`🤖 Agent System auto-initialization disabled (AGENT_AUTO_INITIALIZE=false)`);
    }

    // Graceful shutdown
    const shutdown = async () => {
      console.log("\n🛑 Shutting down gracefully...");
      opsManagerScheduler.shutdown();
      await scanScheduler.stop();

      // Shutdown v2.1 Agent System
      try {
        await shutdownAgentSystem();
        console.log("🤖 Agent System shutdown complete");
      } catch (agentError) {
        console.warn("⚠️  Agent System shutdown error:", agentError);
      }

      server.close(() => {
        console.log("✅ Server closed");
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error("⚠️  Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("❌ Server initialization failed:", error);
    process.exit(1);
  }
}

// Start the server
initializeServer();
