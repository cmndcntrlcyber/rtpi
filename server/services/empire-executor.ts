import axios, { AxiosInstance } from "axios";
import { db } from "../db";
import {
  empireServers,
  empireUserTokens,
  empireListeners,
  empireStagers,
  empireAgents,
  empireTasks,

  empireCredentials,

} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "../utils/encryption";
import { kasmNginxManager } from "./kasm-nginx-manager";

/**
 * PowerShell Empire C2 Executor
 * Handles communication with Empire REST API and manages C2 operations
 */

// Empire REST API interfaces
export interface EmpireLoginResponse {
  token: string;
}

export interface EmpireListener {
  ID: number;
  name: string;
  module: string;
  listener_type: string;
  listener_category: string;
  enabled: boolean;
  options: Record<string, any>;
  created_at: string;
}

export interface EmpireAgent {
  ID: number;
  session_id: string;
  name: string;
  hostname: string;
  internal_ip: string;
  external_ip: string;
  username: string;
  high_integrity: boolean;
  process_name: string;
  process_id: number;
  language: string;
  language_version: string;
  os_details: string;
  architecture: string;
  domain: string;
  checkin_time: string;
  lastseen_time: string;
  delay: number;
  jitter: number;
  lost_limit: number;
  kill_date: string;
  working_hours: string;
}

export interface EmpireTask {
  id: number;
  agent_id: string;
  input: string;
  output: string;
  user_id: number;
  timestamp: string;
}

export interface EmpireModule {
  Name: string;
  Author: string[];
  Description: string;
  Background: boolean;
  OutputExtension: string | null;
  NeedsAdmin: boolean;
  OpsecSafe: boolean;
  Language: string;
  MinLanguageVersion: string;
  Comments: string;
  options: Record<string, any>;
}

export interface EmpireCredential {
  ID: number;
  credtype: string;
  domain: string;
  username: string;
  password: string;
  host: string;
  os: string;
  sid: string;
  notes: string;
}

export interface EmpireStager {
  name: string;
  module: string;
  options: Record<string, any>;
}

// Executor response interfaces
export interface EmpireExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

export interface ListenerCreateOptions {
  name: string;
  listenerType: string;
  host: string;
  port: number;
  certPath?: string;
  stagingKey?: string;
  defaultDelay?: number;
  defaultJitter?: number;
  defaultLostLimit?: number;
  killDate?: string;
  workingHours?: string;
  additionalOptions?: Record<string, any>;
}

export interface TaskCreateOptions {
  agentName: string;
  command: string;
  moduleName?: string;
  parameters?: Record<string, any>;
}

class EmpireExecutor {
  private apiClients = new Map<string, AxiosInstance>();

  /**
   * Get or create an API client for a specific Empire server and user
   */
  private async getApiClient(serverId: string, userId: string): Promise<AxiosInstance> {
    const cacheKey = `${serverId}-${userId}`;

    // Return cached client if available
    if (this.apiClients.has(cacheKey)) {
      return this.apiClients.get(cacheKey)!;
    }

    // Get server configuration
    const server = await db.query.empireServers.findFirst({
      where: eq(empireServers.id, serverId),
    });

    if (!server) {
      throw new Error(`Empire server ${serverId} not found`);
    }

    if (!server.isActive) {
      throw new Error(`Empire server ${server.name} is not active`);
    }

    // Get or create user token
    const userToken = await this.getUserToken(serverId, userId);

    // Create axios instance
    const client = axios.create({
      baseURL: server.restApiUrl,
      headers: {
        "Authorization": `Bearer ${userToken}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    // Cache the client
    this.apiClients.set(cacheKey, client);

    return client;
  }

  /**
   * Get or create a user token for Empire API access
   */
  private async getUserToken(serverId: string, userId: string): Promise<string> {
    // Check if user already has a token
    const tokenRecord = await db.query.empireUserTokens.findFirst({
      where: and(
        eq(empireUserTokens.serverId, serverId),
        eq(empireUserTokens.userId, userId)
      ),
    });

    // If token exists and is valid, return it
    if (tokenRecord && tokenRecord.permanentToken) {
      await db
        .update(empireUserTokens)
        .set({ lastUsed: new Date() })
        .where(eq(empireUserTokens.id, tokenRecord.id));

      return tokenRecord.permanentToken;
    }

    // Otherwise, create a new token by logging in to Empire
    const server = await db.query.empireServers.findFirst({
      where: eq(empireServers.id, serverId),
    });

    if (!server) {
      throw new Error(`Empire server ${serverId} not found`);
    }

    // Login to Empire to get a token
    const loginClient = axios.create({
      baseURL: server.restApiUrl,
      timeout: 10000,
    });

    const loginResponse = await loginClient.post<EmpireLoginResponse>("/api/admin/login", {
      username: server.adminUsername,
      password: decrypt(server.adminPasswordHash), // Decrypt password for Empire API authentication
    });

    const token = loginResponse.data.token;

    // Store the token in database
    if (tokenRecord) {
      await db
        .update(empireUserTokens)
        .set({
          permanentToken: token,
          lastUsed: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(empireUserTokens.id, tokenRecord.id));
    } else {
      await db.insert(empireUserTokens).values({
        userId,
        serverId,
        permanentToken: token,
        lastUsed: new Date(),
      });
    }

    return token;
  }

  /**
   * Check if Empire server is accessible
   */
  async checkConnection(serverId: string, userId: string): Promise<boolean> {
    try {
      const client = await this.getApiClient(serverId, userId);
      const response = await client.get("/api/version");

      // Update server status
      await db
        .update(empireServers)
        .set({
          status: "connected",
          version: response.data.version || null,
          lastHeartbeat: new Date(),
        })
        .where(eq(empireServers.id, serverId));

      return true;
    } catch (error) {
      await db
        .update(empireServers)
        .set({
          status: "disconnected",
        })
        .where(eq(empireServers.id, serverId));

      return false;
    }
  }

  /**
   * Create a new listener
   */
  async createListener(
    serverId: string,
    userId: string,
    options: ListenerCreateOptions
  ): Promise<EmpireExecutionResult> {
    const timestamp = new Date().toISOString();

    try {
      const client = await this.getApiClient(serverId, userId);

      // Build listener configuration
      const listenerConfig = {
        name: options.name,
        module: `listener_${options.listenerType}`,
        options: {
          Name: options.name,
          Host: options.host,
          Port: options.port,
          CertPath: options.certPath || "",
          StagingKey: options.stagingKey || "",
          DefaultDelay: options.defaultDelay || 5,
          DefaultJitter: options.defaultJitter || 0.0,
          DefaultLostLimit: options.defaultLostLimit || 60,
          KillDate: options.killDate || "",
          WorkingHours: options.workingHours || "",
          ...options.additionalOptions,
        },
      };

      const response = await client.post<EmpireListener>("/api/listeners", listenerConfig);

      // Store listener in database
      const [createdListener] = await db.insert(empireListeners).values({
        serverId,
        empireListenerId: response.data.ID.toString(),
        name: response.data.name,
        listenerType: response.data.listener_type as any,
        listenerCategory: response.data.listener_category,
        host: options.host,
        port: options.port,
        certPath: options.certPath || null,
        stagingKey: options.stagingKey || null,
        defaultDelay: options.defaultDelay || 5,
        defaultJitter: options.defaultJitter || 0.0,
        defaultLostLimit: options.defaultLostLimit || 60,
        killDate: options.killDate || null,
        workingHours: options.workingHours || null,
        isActive: response.data.enabled,
        status: response.data.enabled ? "running" : "stopped",
        createdBy: userId,
        config: response.data.options,
      }).returning();

      // Register dynamic proxy route with Kasm nginx (if enabled)
      try {
        const proxyRoute = await kasmNginxManager.registerListenerProxy(
          createdListener.id,
          options.port,
          options.name
        );

        if (proxyRoute) {
          console.log(`[EmpireExecutor] Registered proxy route for listener ${options.name}: ${proxyRoute.subdomain}`);
        }
      } catch (proxyError) {
        console.warn('[EmpireExecutor] Failed to register proxy route (non-fatal):', proxyError);
        // Don't fail listener creation if proxy registration fails
      }

      return {
        success: true,
        data: response.data,
        timestamp,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to create listener",
        timestamp,
      };
    }
  }

  /**
   * List all listeners
   */
  async listListeners(serverId: string, userId: string): Promise<EmpireExecutionResult> {
    const timestamp = new Date().toISOString();

    try {
      const client = await this.getApiClient(serverId, userId);
      const response = await client.get<{ listeners: EmpireListener[] }>("/api/listeners");

      return {
        success: true,
        data: response.data.listeners,
        timestamp,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to list listeners",
        timestamp,
      };
    }
  }

  /**
   * Stop a listener
   */
  async stopListener(serverId: string, userId: string, listenerName: string): Promise<EmpireExecutionResult> {
    const timestamp = new Date().toISOString();

    try {
      const client = await this.getApiClient(serverId, userId);
      await client.delete(`/api/listeners/${listenerName}`);

      // Update database
      await db
        .update(empireListeners)
        .set({
          isActive: false,
          status: "stopped",
        })
        .where(
          and(
            eq(empireListeners.serverId, serverId),
            eq(empireListeners.name, listenerName)
          )
        );

      return {
        success: true,
        timestamp,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to stop listener",
        timestamp,
      };
    }
  }

  /**
   * Generate a stager payload
   */
  async generateStager(
    serverId: string,
    userId: string,
    stagerName: string,
    listenerName: string,
    additionalOptions?: Record<string, any>
  ): Promise<EmpireExecutionResult> {
    const timestamp = new Date().toISOString();

    try {
      const client = await this.getApiClient(serverId, userId);

      const stagerConfig = {
        StagerName: stagerName,
        Listener: listenerName,
        ...additionalOptions,
      };

      const response = await client.post<{ [key: string]: any }>("/api/stagers", stagerConfig);

      // Store stager in database
      const listener = await db.query.empireListeners.findFirst({
        where: and(
          eq(empireListeners.serverId, serverId),
          eq(empireListeners.name, listenerName)
        ),
      });

      await db.insert(empireStagers).values({
        serverId,
        listenerId: listener?.id || null,
        stagerName,
        stagerType: stagerName.split("/")[0] || "unknown",
        language: "powershell", // Default, should be determined from stager type
        listenerName,
        createdBy: userId,
        config: additionalOptions || {},
      });

      return {
        success: true,
        data: response.data,
        timestamp,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to generate stager",
        timestamp,
      };
    }
  }

  /**
   * List all agents
   */
  async listAgents(serverId: string, userId: string): Promise<EmpireExecutionResult> {
    const timestamp = new Date().toISOString();

    try {
      const client = await this.getApiClient(serverId, userId);
      const response = await client.get<{ agents: EmpireAgent[] }>("/api/agents");

      return {
        success: true,
        data: response.data.agents,
        timestamp,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to list agents",
        timestamp,
      };
    }
  }

  /**
   * Sync agents from Empire to RTPI database
   */
  async syncAgents(serverId: string, userId: string): Promise<EmpireExecutionResult> {
    const timestamp = new Date().toISOString();

    try {
      const result = await this.listAgents(serverId, userId);

      if (!result.success || !result.data) {
        return result;
      }

      const agents = result.data as EmpireAgent[];

      for (const agent of agents) {
        // Check if agent already exists
        const existing = await db.query.empireAgents.findFirst({
          where: and(
            eq(empireAgents.serverId, serverId),
            eq(empireAgents.empireAgentId, agent.ID.toString())
          ),
        });

        if (existing) {
          // Update existing agent
          await db
            .update(empireAgents)
            .set({
              sessionId: agent.session_id,
              name: agent.name,
              hostname: agent.hostname,
              internalIp: agent.internal_ip,
              externalIp: agent.external_ip,
              username: agent.username,
              highIntegrity: agent.high_integrity,
              processName: agent.process_name,
              processId: agent.process_id,
              language: agent.language,
              languageVersion: agent.language_version,
              osDetails: agent.os_details,
              architecture: agent.architecture,
              domain: agent.domain,
              status: "active" as any,
              checkinTime: new Date(agent.checkin_time),
              lastseenTime: new Date(agent.lastseen_time),
              delay: agent.delay,
              jitter: agent.jitter,
              lostLimit: agent.lost_limit,
              killDate: agent.kill_date,
              workingHours: agent.working_hours,
              updatedAt: new Date(),
            })
            .where(eq(empireAgents.id, existing.id));
        } else {
          // Create new agent
          await db.insert(empireAgents).values({
            serverId,
            empireAgentId: agent.ID.toString(),
            sessionId: agent.session_id,
            name: agent.name,
            hostname: agent.hostname,
            internalIp: agent.internal_ip,
            externalIp: agent.external_ip,
            username: agent.username,
            highIntegrity: agent.high_integrity,
            processName: agent.process_name,
            processId: agent.process_id,
            language: agent.language,
            languageVersion: agent.language_version,
            osDetails: agent.os_details,
            architecture: agent.architecture,
            domain: agent.domain,
            status: "active" as any,
            checkinTime: new Date(agent.checkin_time),
            lastseenTime: new Date(agent.lastseen_time),
            delay: agent.delay,
            jitter: agent.jitter,
            lostLimit: agent.lost_limit,
            killDate: agent.kill_date,
            workingHours: agent.working_hours,
          });
        }
      }

      return {
        success: true,
        data: { synced: agents.length },
        timestamp,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to sync agents",
        timestamp,
      };
    }
  }

  /**
   * Execute a task on an agent
   */
  async executeTask(
    serverId: string,
    userId: string,
    options: TaskCreateOptions
  ): Promise<EmpireExecutionResult> {
    const timestamp = new Date().toISOString();

    try {
      const client = await this.getApiClient(serverId, userId);

      const taskConfig = {
        command: options.command,
      };

      const response = await client.post<EmpireTask>(
        `/api/agents/${options.agentName}/tasks/shell`,
        taskConfig
      );

      // Store task in database
      const agent = await db.query.empireAgents.findFirst({
        where: and(
          eq(empireAgents.serverId, serverId),
          eq(empireAgents.name, options.agentName)
        ),
      });

      if (agent) {
        await db.insert(empireTasks).values({
          serverId,
          agentId: agent.id,
          empireTaskId: response.data.id.toString(),
          taskName: "shell_command",
          moduleName: options.moduleName || null,
          command: options.command,
          parameters: options.parameters || {},
          status: "queued" as any,
          createdBy: userId,
        });
      }

      return {
        success: true,
        data: response.data,
        timestamp,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to execute task",
        timestamp,
      };
    }
  }

  /**
   * Get task results
   */
  async getTaskResults(
    serverId: string,
    userId: string,
    agentName: string,
    taskId: string
  ): Promise<EmpireExecutionResult> {
    const timestamp = new Date().toISOString();

    try {
      const client = await this.getApiClient(serverId, userId);
      const response = await client.get<EmpireTask>(`/api/agents/${agentName}/tasks/${taskId}`);

      // Update task in database
      await db
        .update(empireTasks)
        .set({
          status: response.data.output ? "completed" : "sent",
          results: response.data.output || null,
          completedAt: response.data.output ? new Date() : null,
        })
        .where(eq(empireTasks.empireTaskId, taskId));

      return {
        success: true,
        data: response.data,
        timestamp,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to get task results",
        timestamp,
      };
    }
  }

  /**
   * List available modules
   */
  async listModules(serverId: string, userId: string): Promise<EmpireExecutionResult> {
    const timestamp = new Date().toISOString();

    try {
      const client = await this.getApiClient(serverId, userId);
      const response = await client.get<{ modules: EmpireModule[] }>("/api/modules");

      return {
        success: true,
        data: response.data.modules,
        timestamp,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to list modules",
        timestamp,
      };
    }
  }

  /**
   * Execute a module on an agent
   */
  async executeModule(
    serverId: string,
    userId: string,
    agentName: string,
    moduleName: string,
    options: Record<string, any>
  ): Promise<EmpireExecutionResult> {
    const timestamp = new Date().toISOString();

    try {
      const client = await this.getApiClient(serverId, userId);

      const moduleConfig = {
        Agent: agentName,
        ...options,
      };

      const response = await client.post<any>(
        `/api/modules/${moduleName}`,
        moduleConfig
      );

      // Store task in database
      const agent = await db.query.empireAgents.findFirst({
        where: and(
          eq(empireAgents.serverId, serverId),
          eq(empireAgents.name, agentName)
        ),
      });

      if (agent) {
        await db.insert(empireTasks).values({
          serverId,
          agentId: agent.id,
          taskName: moduleName,
          moduleName,
          command: `execute module ${moduleName}`,
          parameters: options,
          status: "queued" as any,
          createdBy: userId,
        });
      }

      return {
        success: true,
        data: response.data,
        timestamp,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to execute module",
        timestamp,
      };
    }
  }

  /**
   * List harvested credentials
   */
  async listCredentials(serverId: string, userId: string): Promise<EmpireExecutionResult> {
    const timestamp = new Date().toISOString();

    try {
      const client = await this.getApiClient(serverId, userId);
      const response = await client.get<{ credentials: EmpireCredential[] }>("/api/credentials");

      return {
        success: true,
        data: response.data.credentials,
        timestamp,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to list credentials",
        timestamp,
      };
    }
  }

  /**
   * Sync credentials from Empire to RTPI database
   */
  async syncCredentials(serverId: string, userId: string): Promise<EmpireExecutionResult> {
    const timestamp = new Date().toISOString();

    try {
      const result = await this.listCredentials(serverId, userId);

      if (!result.success || !result.data) {
        return result;
      }

      const credentials = result.data as EmpireCredential[];

      for (const cred of credentials) {
        // Check if credential already exists
        const existing = await db.query.empireCredentials.findFirst({
          where: and(
            eq(empireCredentials.serverId, serverId),
            eq(empireCredentials.empireCredentialId, cred.ID.toString())
          ),
        });

        if (!existing) {
          // Create new credential
          await db.insert(empireCredentials).values({
            serverId,
            empireCredentialId: cred.ID.toString(),
            credType: cred.credtype,
            domain: cred.domain,
            username: cred.username,
            password: cred.password,
            host: cred.host,
            os: cred.os,
            sid: cred.sid,
            notes: cred.notes,
          });
        }
      }

      return {
        success: true,
        data: { synced: credentials.length },
        timestamp,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to sync credentials",
        timestamp,
      };
    }
  }

  /**
   * Kill an agent
   */
  async killAgent(serverId: string, userId: string, agentName: string): Promise<EmpireExecutionResult> {
    const timestamp = new Date().toISOString();

    try {
      const client = await this.getApiClient(serverId, userId);
      await client.delete(`/api/agents/${agentName}`);

      // Update database
      await db
        .update(empireAgents)
        .set({
          status: "killed" as any,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(empireAgents.serverId, serverId),
            eq(empireAgents.name, agentName)
          )
        );

      return {
        success: true,
        timestamp,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to kill agent",
        timestamp,
      };
    }
  }

  /**
   * Initialize Empire tokens for a new user across all active servers
   * Called automatically when a new user is created
   */
  async initializeTokensForUser(userId: string): Promise<void> {
    try {
      // Get all active Empire servers
      const servers = await db.query.empireServers.findMany({
        where: eq(empireServers.isActive, true),
      });

      if (servers.length === 0) {
        console.log(`[EmpireExecutor] No active Empire servers found, skipping token initialization for user ${userId}`);
        return;
      }

      // Generate tokens for each active server
      for (const server of servers) {
        try {
          await this.getUserToken(server.id, userId);
          console.log(`[EmpireExecutor] Initialized Empire token for user ${userId} on server ${server.name}`);
        } catch (error) {
          console.warn(`[EmpireExecutor] Failed to initialize token for user ${userId} on server ${server.name}:`, error);
          // Continue with other servers even if one fails
        }
      }

      console.log(`[EmpireExecutor] Completed token initialization for user ${userId} across ${servers.length} server(s)`);
    } catch (error) {
      console.error('[EmpireExecutor] Failed to initialize tokens for user:', error);
      // Don't throw - token initialization should not block user creation
    }
  }

  /**
   * Clear cached API clients (useful for token refresh)
   */
  clearCache(serverId?: string, userId?: string): void {
    if (serverId && userId) {
      const cacheKey = `${serverId}-${userId}`;
      this.apiClients.delete(cacheKey);
    } else {
      this.apiClients.clear();
    }
  }
}

export const empireExecutor = new EmpireExecutor();
