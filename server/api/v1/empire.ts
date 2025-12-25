import { Router } from "express";
import { db } from "../../db";
import {
  empireServers,
  empireUserTokens,
  empireListeners,
  empireAgents,
  empireTasks,
  empireCredentials,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { empireExecutor } from "../../services/empire-executor";
import { encrypt } from "../../utils/encryption";

const router = Router();

/**
 * Empire C2 Server Management
 */

// List all Empire servers
router.get("/servers", async (_req, res) => {
  try {
    const servers = await db.query.empireServers.findMany({
      orderBy: [desc(empireServers.createdAt)],
    });

    // Don't send password hash to client
    const sanitized = servers.map((s) => ({
      ...s,
      adminPasswordHash: undefined,
    }));

    res.json(sanitized);
  } catch (error) {
    console.error("Failed to list Empire servers:", error);
    res.status(500).json({ error: "Failed to list Empire servers" });
  }
});

// Get a specific Empire server
router.get("/servers/:id", async (req, res) => {
  try {
    const server = await db.query.empireServers.findFirst({
      where: eq(empireServers.id, req.params.id),
    });

    if (!server) {
      return res.status(404).json({ error: "Empire server not found" });
    }

    res.json({
      ...server,
      adminPasswordHash: undefined,
    });
  } catch (error) {
    console.error("Failed to get Empire server:", error);
    res.status(500).json({ error: "Failed to get Empire server" });
  }
});

// Create a new Empire server configuration
router.post("/servers", async (req, res) => {
  try {
    const {
      name,
      host,
      port,
      restApiUrl,
      restApiPort,
      socketioUrl,
      socketioPort,
      adminUsername,
      adminPassword,
      certificatePath,
    } = req.body;

    // Encrypt the admin password (AES-256-GCM)
    // Unlike bcrypt, this can be decrypted for Empire API authentication
    const encryptedPassword = encrypt(adminPassword);

    const [server] = await db
      .insert(empireServers)
      .values({
        name,
        host,
        port: port || 1337,
        restApiUrl: restApiUrl || `http://${host}:${port || 1337}`,
        restApiPort: restApiPort || 1337,
        socketioUrl: socketioUrl || null,
        socketioPort: socketioPort || null,
        adminUsername: adminUsername || "empireadmin",
        adminPasswordHash: encryptedPassword,
        certificatePath: certificatePath || null,
        isActive: true,
        status: "disconnected",
      })
      .returning();

    res.status(201).json({
      ...server,
      adminPasswordHash: undefined,
    });
  } catch (error) {
    console.error("Failed to create Empire server:", error);
    res.status(500).json({ error: "Failed to create Empire server" });
  }
});

// Update an Empire server
router.patch("/servers/:id", async (req, res) => {
  try {
    const updates: any = {};

    if (req.body.name) updates.name = req.body.name;
    if (req.body.host) updates.host = req.body.host;
    if (req.body.port) updates.port = req.body.port;
    if (req.body.restApiUrl) updates.restApiUrl = req.body.restApiUrl;
    if (req.body.restApiPort) updates.restApiPort = req.body.restApiPort;
    if (req.body.socketioUrl) updates.socketioUrl = req.body.socketioUrl;
    if (req.body.socketioPort) updates.socketioPort = req.body.socketioPort;
    if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;

    if (req.body.adminPassword) {
      updates.adminPasswordHash = encrypt(req.body.adminPassword);
    }

    updates.updatedAt = new Date();

    const [server] = await db
      .update(empireServers)
      .set(updates)
      .where(eq(empireServers.id, req.params.id))
      .returning();

    if (!server) {
      return res.status(404).json({ error: "Empire server not found" });
    }

    res.json({
      ...server,
      adminPasswordHash: undefined,
    });
  } catch (error) {
    console.error("Failed to update Empire server:", error);
    res.status(500).json({ error: "Failed to update Empire server" });
  }
});

// Delete an Empire server
router.delete("/servers/:id", async (req, res) => {
  try {
    await db.delete(empireServers).where(eq(empireServers.id, req.params.id));
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete Empire server:", error);
    res.status(500).json({ error: "Failed to delete Empire server" });
  }
});

// Check connection to Empire server
router.post("/servers/:id/check-connection", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const isConnected = await empireExecutor.checkConnection(req.params.id, userId);

    const server = await db.query.empireServers.findFirst({
      where: eq(empireServers.id, req.params.id),
    });

    res.json({
      connected: isConnected,
      status: server?.status,
      version: server?.version,
      lastHeartbeat: server?.lastHeartbeat,
    });
  } catch (error) {
    console.error("Failed to check Empire connection:", error);
    res.status(500).json({ error: "Failed to check connection" });
  }
});

/**
 * Token Management
 */

// Get current user's tokens for all Empire servers
router.get("/tokens", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tokens = await db.query.empireUserTokens.findMany({
      where: eq(empireUserTokens.userId, userId),
      with: {
        server: true,
      },
    });

    // Don't send the actual token values
    const sanitized = tokens.map((t) => ({
      id: t.id,
      serverId: t.serverId,
      serverName: (t.server as any)?.name,
      lastUsed: t.lastUsed,
      createdAt: t.createdAt,
      hasToken: !!t.permanentToken,
    }));

    res.json(sanitized);
  } catch (error) {
    console.error("Failed to list tokens:", error);
    res.status(500).json({ error: "Failed to list tokens" });
  }
});

// Refresh token for a specific server
router.post("/tokens/:serverId/refresh", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Clear cached client to force token refresh
    empireExecutor.clearCache(req.params.serverId, userId);

    // Delete existing token to force regeneration
    await db
      .delete(empireUserTokens)
      .where(
        and(
          eq(empireUserTokens.serverId, req.params.serverId),
          eq(empireUserTokens.userId, userId)
        )
      );

    // Check connection will trigger new token generation
    const isConnected = await empireExecutor.checkConnection(req.params.serverId, userId);

    res.json({ success: isConnected });
  } catch (error) {
    console.error("Failed to refresh token:", error);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

/**
 * Listener Management
 */

// List all listeners
router.get("/servers/:serverId/listeners", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await empireExecutor.listListeners(req.params.serverId, userId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error("Failed to list listeners:", error);
    res.status(500).json({ error: "Failed to list listeners" });
  }
});

// Create a new listener
router.post("/servers/:serverId/listeners", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      name,
      listenerType,
      host,
      port,
      certPath,
      stagingKey,
      defaultDelay,
      defaultJitter,
      defaultLostLimit,
      killDate,
      workingHours,
      additionalOptions,
    } = req.body;

    const result = await empireExecutor.createListener(req.params.serverId, userId, {
      name,
      listenerType,
      host,
      port,
      certPath,
      stagingKey,
      defaultDelay,
      defaultJitter,
      defaultLostLimit,
      killDate,
      workingHours,
      additionalOptions,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(201).json(result.data);
  } catch (error) {
    console.error("Failed to create listener:", error);
    res.status(500).json({ error: "Failed to create listener" });
  }
});

// Stop a listener
router.delete("/servers/:serverId/listeners/:listenerName", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await empireExecutor.stopListener(
      req.params.serverId,
      userId,
      req.params.listenerName
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Failed to stop listener:", error);
    res.status(500).json({ error: "Failed to stop listener" });
  }
});

/**
 * Stager Generation
 */

// Generate a stager
router.post("/servers/:serverId/stagers", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { stagerName, listenerName, additionalOptions } = req.body;

    const result = await empireExecutor.generateStager(
      req.params.serverId,
      userId,
      stagerName,
      listenerName,
      additionalOptions
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(201).json(result.data);
  } catch (error) {
    console.error("Failed to generate stager:", error);
    res.status(500).json({ error: "Failed to generate stager" });
  }
});

/**
 * Agent Management
 */

// List all agents
router.get("/servers/:serverId/agents", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await empireExecutor.listAgents(req.params.serverId, userId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error("Failed to list agents:", error);
    res.status(500).json({ error: "Failed to list agents" });
  }
});

// Sync agents from Empire to RTPI database
router.post("/servers/:serverId/agents/sync", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await empireExecutor.syncAgents(req.params.serverId, userId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error("Failed to sync agents:", error);
    res.status(500).json({ error: "Failed to sync agents" });
  }
});

// Kill an agent
router.delete("/servers/:serverId/agents/:agentName", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await empireExecutor.killAgent(
      req.params.serverId,
      userId,
      req.params.agentName
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Failed to kill agent:", error);
    res.status(500).json({ error: "Failed to kill agent" });
  }
});

/**
 * Task Management
 */

// Execute a task on an agent
router.post("/servers/:serverId/agents/:agentName/tasks", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { command, moduleName, parameters } = req.body;

    const result = await empireExecutor.executeTask(req.params.serverId, userId, {
      agentName: req.params.agentName,
      command,
      moduleName,
      parameters,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(201).json(result.data);
  } catch (error) {
    console.error("Failed to execute task:", error);
    res.status(500).json({ error: "Failed to execute task" });
  }
});

// Get task results
router.get("/servers/:serverId/agents/:agentName/tasks/:taskId", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await empireExecutor.getTaskResults(
      req.params.serverId,
      userId,
      req.params.agentName,
      req.params.taskId
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error("Failed to get task results:", error);
    res.status(500).json({ error: "Failed to get task results" });
  }
});

/**
 * Module Management
 */

// List available modules
router.get("/servers/:serverId/modules", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await empireExecutor.listModules(req.params.serverId, userId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error("Failed to list modules:", error);
    res.status(500).json({ error: "Failed to list modules" });
  }
});

// Execute a module on an agent
router.post("/servers/:serverId/agents/:agentName/modules/:moduleName", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { options } = req.body;

    const result = await empireExecutor.executeModule(
      req.params.serverId,
      userId,
      req.params.agentName,
      req.params.moduleName,
      options || {}
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(201).json(result.data);
  } catch (error) {
    console.error("Failed to execute module:", error);
    res.status(500).json({ error: "Failed to execute module" });
  }
});

/**
 * Credential Management
 */

// List harvested credentials
router.get("/servers/:serverId/credentials", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await empireExecutor.listCredentials(req.params.serverId, userId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error("Failed to list credentials:", error);
    res.status(500).json({ error: "Failed to list credentials" });
  }
});

// Sync credentials from Empire to RTPI database
router.post("/servers/:serverId/credentials/sync", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await empireExecutor.syncCredentials(req.params.serverId, userId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error("Failed to sync credentials:", error);
    res.status(500).json({ error: "Failed to sync credentials" });
  }
});

/**
 * Database Queries (RTPI-stored data)
 */

// Get listeners from database
router.get("/servers/:serverId/db/listeners", async (req, res) => {
  try {
    const listeners = await db.query.empireListeners.findMany({
      where: eq(empireListeners.serverId, req.params.serverId),
      orderBy: [desc(empireListeners.createdAt)],
    });

    res.json(listeners);
  } catch (error) {
    console.error("Failed to get listeners from database:", error);
    res.status(500).json({ error: "Failed to get listeners from database" });
  }
});

// Get agents from database
router.get("/servers/:serverId/db/agents", async (req, res) => {
  try {
    const agents = await db.query.empireAgents.findMany({
      where: eq(empireAgents.serverId, req.params.serverId),
      orderBy: [desc(empireAgents.createdAt)],
    });

    res.json(agents);
  } catch (error) {
    console.error("Failed to get agents from database:", error);
    res.status(500).json({ error: "Failed to get agents from database" });
  }
});

// Get tasks from database
router.get("/servers/:serverId/db/tasks", async (req, res) => {
  try {
    const tasks = await db.query.empireTasks.findMany({
      where: eq(empireTasks.serverId, req.params.serverId),
      orderBy: [desc(empireTasks.queuedAt)],
      with: {
        agent: true,
      },
    });

    res.json(tasks);
  } catch (error) {
    console.error("Failed to get tasks from database:", error);
    res.status(500).json({ error: "Failed to get tasks from database" });
  }
});

// Get credentials from database
router.get("/servers/:serverId/db/credentials", async (req, res) => {
  try {
    const credentials = await db.query.empireCredentials.findMany({
      where: eq(empireCredentials.serverId, req.params.serverId),
      orderBy: [desc(empireCredentials.harvestedAt)],
    });

    res.json(credentials);
  } catch (error) {
    console.error("Failed to get credentials from database:", error);
    res.status(500).json({ error: "Failed to get credentials from database" });
  }
});

export default router;
