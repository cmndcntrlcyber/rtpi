import axios, { AxiosInstance } from 'axios';
import { db } from '../db';
import { kasmWorkspaces, kasmSessions } from '@shared/schema';
import { eq, and, lt, isNull, sql, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Kasm Workspace Manager
 *
 * Manages the lifecycle of Kasm Workspaces including:
 * - Workspace provisioning and configuration
 * - Session tracking and management
 * - Resource limits and quotas per user
 * - Automatic cleanup and expiry handling
 * - Workspace sharing between users
 * - Workspace snapshots and persistence
 *
 * Architecture:
 * RTPI Backend → Kasm API → Kasm Manager → Docker (Workspace Containers)
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type WorkspaceType = 'vscode' | 'burp' | 'kali' | 'firefox' | 'empire';

export type WorkspaceStatus = 'starting' | 'running' | 'stopped' | 'failed';

export interface WorkspaceConfig {
  userId: string;
  operationId?: string;
  workspaceType: WorkspaceType;
  workspaceName?: string;
  cpuLimit?: string;
  memoryLimit?: string;
  expiryHours?: number; // Default: 24 hours
  metadata?: Record<string, any>;
}

export interface WorkspaceProvisionResult {
  id: string;
  kasmSessionId: string;
  accessUrl: string;
  status: WorkspaceStatus;
  expiresAt: Date;
}

export interface SessionInfo {
  id: string;
  workspaceId: string;
  userId: string;
  sessionToken: string;
  lastActivity: Date;
  expiresAt: Date;
}

export interface WorkspaceSnapshot {
  workspaceId: string;
  snapshotName: string;
  createdAt: Date;
  size: number;
  metadata: Record<string, any>;
}

export interface ResourceQuota {
  maxWorkspaces: number;
  maxCpuPerWorkspace: number;
  maxMemoryPerWorkspace: number;
  maxTotalCpu: number;
  maxTotalMemory: number;
}

// Kasm API Response Types
export interface KasmSession {
  session_id: string;
  container_id: string;
  user_id: string;
  image_id: string;
  status: string;
  port: number;
  hostname: string;
  ip: string;
}

export interface KasmUser {
  user_id: string;
  username: string;
  realm: string;
}

export interface KasmImage {
  image_id: string;
  name: string;
  description: string;
  image_src: string;
  cores: number;
  memory: number;
}

// ============================================================================
// Kasm Workspace Manager Class
// ============================================================================

export class KasmWorkspaceManager {
  private apiClient: AxiosInstance;
  private kasmApiUrl: string;
  private kasmApiKey: string;
  private kasmApiSecret: string;
  private enabled: boolean;
  private defaultExpiryHours: number;
  private cleanupIntervalMs: number;
  private cleanupTimer?: NodeJS.Timeout;

  // Default resource quotas
  private defaultQuota: ResourceQuota = {
    maxWorkspaces: 5,
    maxCpuPerWorkspace: 4,
    maxMemoryPerWorkspace: 8192, // 8GB in MB
    maxTotalCpu: 16,
    maxTotalMemory: 32768, // 32GB in MB
  };

  // Workspace type to Kasm image mapping
  private imageMapping: Record<WorkspaceType, string> = {
    vscode: 'kasmweb/vscode:1.17.0',
    burp: 'kasmweb/burp-suite:1.17.0',
    kali: 'kasmweb/kali-rolling-desktop:1.17.0',
    firefox: 'kasmweb/firefox:1.17.0',
    empire: 'kasmweb/empire-client:1.17.0',
  };

  constructor(options?: {
    kasmApiUrl?: string;
    kasmApiKey?: string;
    kasmApiSecret?: string;
    enabled?: boolean;
    defaultExpiryHours?: number;
    cleanupIntervalMs?: number;
  }) {
    this.kasmApiUrl = options?.kasmApiUrl || process.env.KASM_API_URL || 'https://kasm-api:443';
    this.kasmApiKey = options?.kasmApiKey || process.env.KASM_API_KEY || '';
    this.kasmApiSecret = options?.kasmApiSecret || process.env.KASM_API_SECRET || '';
    this.enabled = options?.enabled ?? (process.env.KASM_ENABLED === 'true');
    this.defaultExpiryHours = options?.defaultExpiryHours || 24;
    this.cleanupIntervalMs = options?.cleanupIntervalMs || 5 * 60 * 1000; // 5 minutes

    this.apiClient = axios.create({
      baseURL: this.kasmApiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false, // For self-signed certs
      }),
    });

    // Start automatic cleanup process
    if (this.enabled) {
      this.startCleanupSchedule();
    }
  }

  /**
   * Initialize the Kasm Workspace Manager
   * Authenticates with Kasm API and starts background processes
   */
  async initialize(): Promise<void> {
    if (!this.enabled) {
      console.log('[KasmWorkspaceManager] Kasm integration disabled');
      return;
    }

    try {
      // Authenticate with Kasm API
      await this.authenticate();
      console.log('[KasmWorkspaceManager] Successfully initialized and authenticated');

      // Clean up any orphaned workspaces on startup
      await this.cleanupExpiredWorkspaces();
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Authenticate with Kasm API
   */
  private async authenticate(): Promise<string> {
    try {
      const response = await this.apiClient.post('/api/auth', {
        api_key: this.kasmApiKey,
        api_secret: this.kasmApiSecret,
      });

      const token = response.data.token;
      this.apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return token;
    } catch (error) {
      console.error('[KasmWorkspaceManager] Authentication failed:', error);
      throw new Error('Failed to authenticate with Kasm API');
    }
  }

  // ============================================================================
  // Workspace Provisioning (#KW-23)
  // ============================================================================

  /**
   * Provision a new workspace for a user
   */
  async provisionWorkspace(config: WorkspaceConfig): Promise<WorkspaceProvisionResult> {
    if (!this.enabled) {
      throw new Error('Kasm Workspaces is not enabled');
    }

    try {
      // Check resource quotas
      await this.checkResourceQuota(config.userId, config.cpuLimit, config.memoryLimit);

      // Generate unique identifiers
      const workspaceId = uuidv4();
      const kasmSessionId = `kasm-${workspaceId.slice(0, 8)}`;

      // Calculate expiry time
      const expiryHours = config.expiryHours || this.defaultExpiryHours;
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

      // Create Kasm session via API
      const kasmSession = await this.createKasmSession({
        image: this.imageMapping[config.workspaceType],
        cpuLimit: config.cpuLimit || '2',
        memoryLimit: config.memoryLimit || '4096M',
      });

      // Store workspace in database
      const [workspace] = await db.insert(kasmWorkspaces).values({
        id: workspaceId,
        userId: config.userId,
        operationId: config.operationId,
        workspaceType: config.workspaceType,
        workspaceName: config.workspaceName || `${config.workspaceType}-${kasmSessionId}`,
        kasmSessionId: kasmSession.session_id,
        kasmContainerId: kasmSession.container_id,
        kasmUserId: kasmSession.user_id,
        status: 'starting',
        accessUrl: this.generateAccessUrl(kasmSession.session_id),
        internalIp: kasmSession.ip,
        cpuLimit: config.cpuLimit || '2',
        memoryLimit: config.memoryLimit || '4096M',
        expiresAt,
        metadata: config.metadata || {},
        createdBy: config.userId,
      }).returning();

      console.log(`[KasmWorkspaceManager] Provisioned workspace ${workspaceId} for user ${config.userId}`);

      // Start monitoring the workspace
      this.monitorWorkspaceStartup(workspaceId);

      return {
        id: workspaceId,
        kasmSessionId: kasmSession.session_id,
        accessUrl: workspace.accessUrl!,
        status: 'starting',
        expiresAt,
      };
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to provision workspace:', error);
      throw error;
    }
  }

  /**
   * Create a new Kasm session via API
   */
  private async createKasmSession(config: {
    image: string;
    cpuLimit: string;
    memoryLimit: string;
  }): Promise<KasmSession> {
    try {
      const response = await this.apiClient.post('/api/sessions', {
        image_src: config.image,
        enable_sharing: false,
        environment: {
          CPU_LIMIT: config.cpuLimit,
          MEMORY_LIMIT: config.memoryLimit,
        },
      });

      return response.data.session as KasmSession;
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to create Kasm session:', error);
      throw error;
    }
  }

  /**
   * Monitor workspace startup and update status
   */
  private async monitorWorkspaceStartup(workspaceId: string): Promise<void> {
    const maxAttempts = 20; // 20 attempts * 3 seconds = 60 seconds timeout
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const [workspace] = await db
          .select()
          .from(kasmWorkspaces)
          .where(eq(kasmWorkspaces.id, workspaceId));

        if (!workspace) return;

        // Get status from Kasm API
        const kasmStatus = await this.getKasmSessionStatus(workspace.kasmSessionId);

        if (kasmStatus === 'running') {
          await db
            .update(kasmWorkspaces)
            .set({
              status: 'running',
              startedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(kasmWorkspaces.id, workspaceId));

          console.log(`[KasmWorkspaceManager] Workspace ${workspaceId} is now running`);
        } else if (kasmStatus === 'failed' || attempts >= maxAttempts) {
          await db
            .update(kasmWorkspaces)
            .set({
              status: 'failed',
              errorMessage: attempts >= maxAttempts ? 'Startup timeout exceeded' : 'Failed to start',
              updatedAt: new Date(),
            })
            .where(eq(kasmWorkspaces.id, workspaceId));

          console.error(`[KasmWorkspaceManager] Workspace ${workspaceId} failed to start`);
        } else {
          // Still starting, check again
          attempts++;
          setTimeout(checkStatus, 3000);
        }
      } catch (error) {
        console.error('[KasmWorkspaceManager] Error monitoring workspace startup:', error);
      }
    };

    checkStatus();
  }

  /**
   * Get Kasm session status from API
   */
  private async getKasmSessionStatus(sessionId: string): Promise<string> {
    try {
      const response = await this.apiClient.get(`/api/sessions/${sessionId}`);
      return response.data.session.status;
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to get session status:', error);
      return 'unknown';
    }
  }

  /**
   * Generate access URL for workspace
   */
  private generateAccessUrl(sessionId: string): string {
    const kasmDomain = process.env.KASM_DOMAIN || 'localhost';
    const kasmPort = process.env.KASM_PORT || '8443';
    return `https://${kasmDomain}:${kasmPort}/#/session/${sessionId}`;
  }

  // ============================================================================
  // Session Tracking (#KW-24)
  // ============================================================================

  /**
   * Create a new session for accessing a workspace
   */
  async createSession(workspaceId: string, userId: string, metadata?: {
    ipAddress?: string;
    userAgent?: string;
  }): Promise<SessionInfo> {
    try {
      const sessionToken = uuidv4();
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours

      const [session] = await db.insert(kasmSessions).values({
        userId,
        workspaceId,
        sessionToken,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        expiresAt,
      }).returning();

      // Update workspace last accessed time
      await db
        .update(kasmWorkspaces)
        .set({ lastAccessed: new Date(), updatedAt: new Date() })
        .where(eq(kasmWorkspaces.id, workspaceId));

      console.log(`[KasmWorkspaceManager] Created session for workspace ${workspaceId}`);

      return {
        id: session.id,
        workspaceId: session.workspaceId!,
        userId: session.userId,
        sessionToken: session.sessionToken!,
        lastActivity: session.lastActivity!,
        expiresAt: session.expiresAt,
      };
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionToken: string): Promise<void> {
    try {
      await db
        .update(kasmSessions)
        .set({
          lastActivity: new Date(),
          activityCount: sql`${kasmSessions.activityCount} + 1`,
        })
        .where(eq(kasmSessions.sessionToken, sessionToken));
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to update session activity:', error);
    }
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionToken: string): Promise<void> {
    try {
      await db
        .update(kasmSessions)
        .set({ terminatedAt: new Date() })
        .where(eq(kasmSessions.sessionToken, sessionToken));

      console.log(`[KasmWorkspaceManager] Terminated session ${sessionToken}`);
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to terminate session:', error);
      throw error;
    }
  }

  /**
   * Get active sessions for a workspace
   */
  async getActiveSessions(workspaceId: string): Promise<SessionInfo[]> {
    try {
      const sessions = await db
        .select()
        .from(kasmSessions)
        .where(
          and(
            eq(kasmSessions.workspaceId, workspaceId),
            isNull(kasmSessions.terminatedAt)
          )
        )
        .orderBy(desc(kasmSessions.lastActivity));

      return sessions.map(s => ({
        id: s.id,
        workspaceId: s.workspaceId!,
        userId: s.userId,
        sessionToken: s.sessionToken!,
        lastActivity: s.lastActivity!,
        expiresAt: s.expiresAt,
      }));
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to get active sessions:', error);
      return [];
    }
  }

  // ============================================================================
  // Workspace Cleanup (#KW-25)
  // ============================================================================

  /**
   * Start automatic cleanup schedule
   */
  private startCleanupSchedule(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      await this.cleanupExpiredWorkspaces();
      await this.cleanupExpiredSessions();
    }, this.cleanupIntervalMs);

    console.log(`[KasmWorkspaceManager] Cleanup schedule started (interval: ${this.cleanupIntervalMs}ms)`);
  }

  /**
   * Stop automatic cleanup schedule
   */
  stopCleanupSchedule(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      console.log('[KasmWorkspaceManager] Cleanup schedule stopped');
    }
  }

  /**
   * Clean up expired workspaces
   */
  async cleanupExpiredWorkspaces(): Promise<number> {
    try {
      const now = new Date();
      const expiredWorkspaces = await db
        .select()
        .from(kasmWorkspaces)
        .where(
          and(
            lt(kasmWorkspaces.expiresAt, now),
            isNull(kasmWorkspaces.terminatedAt)
          )
        );

      let cleanedCount = 0;

      for (const workspace of expiredWorkspaces) {
        try {
          await this.terminateWorkspace(workspace.id);
          cleanedCount++;
        } catch (error) {
          console.error(`[KasmWorkspaceManager] Failed to cleanup workspace ${workspace.id}:`, error);
        }
      }

      if (cleanedCount > 0) {
        console.log(`[KasmWorkspaceManager] Cleaned up ${cleanedCount} expired workspace(s)`);
      }

      return cleanedCount;
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to cleanup expired workspaces:', error);
      return 0;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const now = new Date();
      const result = await db
        .update(kasmSessions)
        .set({ terminatedAt: now })
        .where(
          and(
            lt(kasmSessions.expiresAt, now),
            isNull(kasmSessions.terminatedAt)
          )
        )
        .returning();

      if (result.length > 0) {
        console.log(`[KasmWorkspaceManager] Cleaned up ${result.length} expired session(s)`);
      }

      return result.length;
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to cleanup expired sessions:', error);
      return 0;
    }
  }

  /**
   * Terminate a workspace and destroy Kasm session
   */
  async terminateWorkspace(workspaceId: string): Promise<void> {
    try {
      const [workspace] = await db
        .select()
        .from(kasmWorkspaces)
        .where(eq(kasmWorkspaces.id, workspaceId));

      if (!workspace) {
        throw new Error(`Workspace ${workspaceId} not found`);
      }

      // Destroy Kasm session
      if (workspace.kasmSessionId) {
        try {
          await this.apiClient.delete(`/api/sessions/${workspace.kasmSessionId}`);
        } catch (error) {
          console.error('[KasmWorkspaceManager] Failed to destroy Kasm session:', error);
          // Continue with database cleanup even if Kasm API call fails
        }
      }

      // Update database
      await db
        .update(kasmWorkspaces)
        .set({
          status: 'stopped',
          terminatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(kasmWorkspaces.id, workspaceId));

      // Terminate all active sessions
      await db
        .update(kasmSessions)
        .set({ terminatedAt: new Date() })
        .where(
          and(
            eq(kasmSessions.workspaceId, workspaceId),
            isNull(kasmSessions.terminatedAt)
          )
        );

      console.log(`[KasmWorkspaceManager] Terminated workspace ${workspaceId}`);
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to terminate workspace:', error);
      throw error;
    }
  }

  // ============================================================================
  // Resource Limits (#KW-26)
  // ============================================================================

  /**
   * Check if user is within resource quota
   */
  async checkResourceQuota(
    userId: string,
    requestedCpu?: string,
    requestedMemory?: string
  ): Promise<void> {
    try {
      // Get user's active workspaces
      const activeWorkspaces = await db
        .select()
        .from(kasmWorkspaces)
        .where(
          and(
            eq(kasmWorkspaces.userId, userId),
            isNull(kasmWorkspaces.terminatedAt)
          )
        );

      // Check max workspaces limit
      if (activeWorkspaces.length >= this.defaultQuota.maxWorkspaces) {
        throw new Error(
          `User has reached maximum workspace limit (${this.defaultQuota.maxWorkspaces})`
        );
      }

      // Calculate current resource usage
      let totalCpu = 0;
      let totalMemory = 0;

      for (const ws of activeWorkspaces) {
        totalCpu += parseFloat(ws.cpuLimit || '0');
        totalMemory += parseInt(ws.memoryLimit?.replace('M', '') || '0');
      }

      // Add requested resources
      const newCpu = parseFloat(requestedCpu || '2');
      const newMemory = parseInt(requestedMemory?.replace('M', '') || '4096');

      // Check per-workspace limits
      if (newCpu > this.defaultQuota.maxCpuPerWorkspace) {
        throw new Error(
          `Requested CPU (${newCpu}) exceeds max per workspace (${this.defaultQuota.maxCpuPerWorkspace})`
        );
      }

      if (newMemory > this.defaultQuota.maxMemoryPerWorkspace) {
        throw new Error(
          `Requested memory (${newMemory}M) exceeds max per workspace (${this.defaultQuota.maxMemoryPerWorkspace}M)`
        );
      }

      // Check total limits
      if (totalCpu + newCpu > this.defaultQuota.maxTotalCpu) {
        throw new Error(
          `Total CPU usage (${totalCpu + newCpu}) would exceed quota (${this.defaultQuota.maxTotalCpu})`
        );
      }

      if (totalMemory + newMemory > this.defaultQuota.maxTotalMemory) {
        throw new Error(
          `Total memory usage (${totalMemory + newMemory}M) would exceed quota (${this.defaultQuota.maxTotalMemory}M)`
        );
      }
    } catch (error) {
      console.error('[KasmWorkspaceManager] Resource quota check failed:', error);
      throw error;
    }
  }

  /**
   * Get user's current resource usage
   */
  async getUserResourceUsage(userId: string): Promise<{
    workspaceCount: number;
    totalCpu: number;
    totalMemory: number;
    quota: ResourceQuota;
  }> {
    try {
      const activeWorkspaces = await db
        .select()
        .from(kasmWorkspaces)
        .where(
          and(
            eq(kasmWorkspaces.userId, userId),
            isNull(kasmWorkspaces.terminatedAt)
          )
        );

      let totalCpu = 0;
      let totalMemory = 0;

      for (const ws of activeWorkspaces) {
        totalCpu += parseFloat(ws.cpuLimit || '0');
        totalMemory += parseInt(ws.memoryLimit?.replace('M', '') || '0');
      }

      return {
        workspaceCount: activeWorkspaces.length,
        totalCpu,
        totalMemory,
        quota: this.defaultQuota,
      };
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to get resource usage:', error);
      throw error;
    }
  }

  // ============================================================================
  // Workspace Expiry (#KW-27)
  // ============================================================================

  /**
   * Extend workspace expiry time
   */
  async extendWorkspaceExpiry(workspaceId: string, additionalHours: number): Promise<Date> {
    try {
      const [workspace] = await db
        .select()
        .from(kasmWorkspaces)
        .where(eq(kasmWorkspaces.id, workspaceId));

      if (!workspace) {
        throw new Error(`Workspace ${workspaceId} not found`);
      }

      const currentExpiry = workspace.expiresAt;
      const newExpiry = new Date(currentExpiry.getTime() + additionalHours * 60 * 60 * 1000);

      await db
        .update(kasmWorkspaces)
        .set({ expiresAt: newExpiry, updatedAt: new Date() })
        .where(eq(kasmWorkspaces.id, workspaceId));

      console.log(`[KasmWorkspaceManager] Extended workspace ${workspaceId} expiry by ${additionalHours} hours`);

      return newExpiry;
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to extend workspace expiry:', error);
      throw error;
    }
  }

  /**
   * Get workspaces expiring soon (within next hour)
   */
  async getExpiringSoonWorkspaces(): Promise<Array<{
    id: string;
    userId: string;
    workspaceName: string;
    expiresAt: Date;
    minutesUntilExpiry: number;
  }>> {
    try {
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
      const now = new Date();

      const workspaces = await db
        .select()
        .from(kasmWorkspaces)
        .where(
          and(
            lt(kasmWorkspaces.expiresAt, oneHourFromNow),
            isNull(kasmWorkspaces.terminatedAt)
          )
        );

      return workspaces.map(ws => ({
        id: ws.id,
        userId: ws.userId,
        workspaceName: ws.workspaceName || ws.workspaceType,
        expiresAt: ws.expiresAt,
        minutesUntilExpiry: Math.floor((ws.expiresAt.getTime() - now.getTime()) / (60 * 1000)),
      }));
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to get expiring workspaces:', error);
      return [];
    }
  }

  // ============================================================================
  // Workspace Sharing (#KW-28)
  // ============================================================================

  /**
   * Share workspace with another user
   */
  async shareWorkspace(workspaceId: string, targetUserId: string): Promise<SessionInfo> {
    try {
      const [workspace] = await db
        .select()
        .from(kasmWorkspaces)
        .where(eq(kasmWorkspaces.id, workspaceId));

      if (!workspace) {
        throw new Error(`Workspace ${workspaceId} not found`);
      }

      // Create a new session for the target user
      const session = await this.createSession(workspaceId, targetUserId);

      // Update workspace metadata to track sharing
      const metadata = workspace.metadata as Record<string, any> || {};
      const sharedWith = metadata.sharedWith || [];
      sharedWith.push({
        userId: targetUserId,
        sharedAt: new Date().toISOString(),
        sessionId: session.id,
      });

      await db
        .update(kasmWorkspaces)
        .set({
          metadata: { ...metadata, sharedWith },
          updatedAt: new Date(),
        })
        .where(eq(kasmWorkspaces.id, workspaceId));

      console.log(`[KasmWorkspaceManager] Shared workspace ${workspaceId} with user ${targetUserId}`);

      return session;
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to share workspace:', error);
      throw error;
    }
  }

  /**
   * Revoke workspace sharing from a user
   */
  async revokeWorkspaceSharing(workspaceId: string, targetUserId: string): Promise<void> {
    try {
      // Terminate all sessions for the target user on this workspace
      await db
        .update(kasmSessions)
        .set({ terminatedAt: new Date() })
        .where(
          and(
            eq(kasmSessions.workspaceId, workspaceId),
            eq(kasmSessions.userId, targetUserId),
            isNull(kasmSessions.terminatedAt)
          )
        );

      // Update workspace metadata
      const [workspace] = await db
        .select()
        .from(kasmWorkspaces)
        .where(eq(kasmWorkspaces.id, workspaceId));

      if (workspace) {
        const metadata = workspace.metadata as Record<string, any> || {};
        const sharedWith = (metadata.sharedWith || []).filter(
          (share: any) => share.userId !== targetUserId
        );

        await db
          .update(kasmWorkspaces)
          .set({
            metadata: { ...metadata, sharedWith },
            updatedAt: new Date(),
          })
          .where(eq(kasmWorkspaces.id, workspaceId));
      }

      console.log(`[KasmWorkspaceManager] Revoked workspace ${workspaceId} sharing from user ${targetUserId}`);
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to revoke workspace sharing:', error);
      throw error;
    }
  }

  // ============================================================================
  // Workspace Snapshots (#KW-29)
  // ============================================================================

  /**
   * Create a snapshot of a workspace
   */
  async createSnapshot(
    workspaceId: string,
    snapshotName: string,
    metadata?: Record<string, any>
  ): Promise<WorkspaceSnapshot> {
    try {
      const [workspace] = await db
        .select()
        .from(kasmWorkspaces)
        .where(eq(kasmWorkspaces.id, workspaceId));

      if (!workspace) {
        throw new Error(`Workspace ${workspaceId} not found`);
      }

      // Call Kasm API to create snapshot
      const response = await this.apiClient.post(`/api/sessions/${workspace.kasmSessionId}/snapshot`, {
        snapshot_name: snapshotName,
      });

      const snapshot: WorkspaceSnapshot = {
        workspaceId,
        snapshotName,
        createdAt: new Date(),
        size: response.data.snapshot.size || 0,
        metadata: metadata || {},
      };

      // Store snapshot info in workspace metadata
      const wsMetadata = workspace.metadata as Record<string, any> || {};
      const snapshots = wsMetadata.snapshots || [];
      snapshots.push(snapshot);

      await db
        .update(kasmWorkspaces)
        .set({
          metadata: { ...wsMetadata, snapshots },
          updatedAt: new Date(),
        })
        .where(eq(kasmWorkspaces.id, workspaceId));

      console.log(`[KasmWorkspaceManager] Created snapshot ${snapshotName} for workspace ${workspaceId}`);

      return snapshot;
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to create snapshot:', error);
      throw error;
    }
  }

  /**
   * List snapshots for a workspace
   */
  async listSnapshots(workspaceId: string): Promise<WorkspaceSnapshot[]> {
    try {
      const [workspace] = await db
        .select()
        .from(kasmWorkspaces)
        .where(eq(kasmWorkspaces.id, workspaceId));

      if (!workspace) {
        return [];
      }

      const metadata = workspace.metadata as Record<string, any> || {};
      return metadata.snapshots || [];
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to list snapshots:', error);
      return [];
    }
  }

  /**
   * Restore workspace from snapshot
   */
  async restoreFromSnapshot(workspaceId: string, snapshotName: string): Promise<void> {
    try {
      const [workspace] = await db
        .select()
        .from(kasmWorkspaces)
        .where(eq(kasmWorkspaces.id, workspaceId));

      if (!workspace) {
        throw new Error(`Workspace ${workspaceId} not found`);
      }

      // Call Kasm API to restore snapshot
      await this.apiClient.post(`/api/sessions/${workspace.kasmSessionId}/restore`, {
        snapshot_name: snapshotName,
      });

      console.log(`[KasmWorkspaceManager] Restored workspace ${workspaceId} from snapshot ${snapshotName}`);
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to restore from snapshot:', error);
      throw error;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get workspace by ID
   */
  async getWorkspace(workspaceId: string) {
    try {
      const [workspace] = await db
        .select()
        .from(kasmWorkspaces)
        .where(eq(kasmWorkspaces.id, workspaceId));

      return workspace || null;
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to get workspace:', error);
      return null;
    }
  }

  /**
   * List workspaces for a user
   */
  async listUserWorkspaces(userId: string, includeTerminated = false) {
    try {
      const conditions = includeTerminated
        ? [eq(kasmWorkspaces.userId, userId)]
        : [eq(kasmWorkspaces.userId, userId), isNull(kasmWorkspaces.terminatedAt)];

      const workspaces = await db
        .select()
        .from(kasmWorkspaces)
        .where(and(...conditions))
        .orderBy(desc(kasmWorkspaces.createdAt));

      return workspaces;
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to list workspaces:', error);
      return [];
    }
  }

  /**
   * Update workspace status
   */
  async updateWorkspaceStatus(workspaceId: string, status: WorkspaceStatus, errorMessage?: string) {
    try {
      await db
        .update(kasmWorkspaces)
        .set({
          status,
          errorMessage: errorMessage || null,
          updatedAt: new Date(),
        })
        .where(eq(kasmWorkspaces.id, workspaceId));
    } catch (error) {
      console.error('[KasmWorkspaceManager] Failed to update workspace status:', error);
    }
  }

  /**
   * Cleanup and shutdown manager
   */
  async shutdown(): Promise<void> {
    this.stopCleanupSchedule();
    console.log('[KasmWorkspaceManager] Shutdown complete');
  }
}

// ============================================================================
// Singleton Instance Export
// ============================================================================

export const kasmWorkspaceManager = new KasmWorkspaceManager();
