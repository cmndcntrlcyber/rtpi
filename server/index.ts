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
app.get("/api/v1/health", async (req, res) => {
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

// Root endpoint
app.get("/api/v1", (req, res) => {
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
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Start server
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📚 API documentation: http://0.0.0.0:${PORT}/api/v1`);
});

// FIX BUG #4: Initialize WebSocket manager for real-time scan progress
import { initializeScanWebSocketManager } from "./services/scan-websocket-manager";
initializeScanWebSocketManager(server);
console.log(`🔌 WebSocket server ready for scan streaming`);
