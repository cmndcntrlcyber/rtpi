import { spawn, ChildProcess } from 'child_process';
import { db } from '../db';
import { mcpServers } from '@shared/schema';
import { readFeatureFlags } from '@shared/feature-flags';
import { eq } from 'drizzle-orm';
import { syncDefaultCatalog } from './mcp/catalog-sync';
import { preflightServer, formatPreflightError } from './mcp/preflight';
import { repairKnownBadCatalogEntries } from './mcp/repair-known-bad';
import { enqueueSkillGeneration } from './skill-generator';

// Spawn timeout in milliseconds (30 seconds)
const SPAWN_TIMEOUT_MS = 30000;

interface MCPServerProcess {
  id: string;
  process: ChildProcess;
  pid: number;
  spawnTimeout?: NodeJS.Timeout;
}

class MCPServerManager {
  private processes: Map<string, MCPServerProcess> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  /**
   * v2.9.1 Phase 5 — read-only accessor used by mcp-invoker to send JSON-RPC
   * messages over the existing stdio pipe. Returns the live ChildProcess
   * (with stdin / stdout / stderr) or null if the server is not running.
   */
  public getChildProcess(serverId: string): ChildProcess | null {
    return this.processes.get(serverId)?.process ?? null;
  }

  constructor() {
    // Start periodic health checks
    this.startHealthMonitoring();
    // v2.9.3: seed the built-in MCP server catalog before recovery so any
    // newly added defaults are visible to the recovery sweep. Gated by
    // FF_DEFAULT_MCP_SERVERS — off by default. 1s delay matches the DB-connect
    // pattern used by recoverErroredServers below.
    //
    // Order: repairKnownBadCatalogEntries() → syncDefaultCatalog(). Repair
    // upgrades legacy bad rows from earlier v2.9.3 cuts (filesystem
    // /workspace, searchcode 404, arxiv wrong PyPI package); sync then
    // inserts any *missing* rows. Both are idempotent and operator-edit-safe.
    if (readFeatureFlags(process.env).defaultMcp) {
      setTimeout(async () => {
        try {
          await repairKnownBadCatalogEntries();
          await syncDefaultCatalog();
        } catch (err) {
          console.error("[MCPServerManager] Default catalog repair/sync failed:", err);
        }
      }, 1000);
    }
    // Auto-recover errored servers on startup (delayed to let DB connect)
    setTimeout(() => this.recoverErroredServers(), 5000);
  }

  /**
   * Recover MCP servers stuck in 'error' state from previous runs.
   * Resets restart counters and attempts to start them.
   */
  private async recoverErroredServers(): Promise<void> {
    try {
      const servers = await db.select().from(mcpServers);
      const erroredServers = servers.filter(
        (s) => (s.status === "error" || s.status === "running") && s.autoRestart
      );

      for (const server of erroredServers) {
        // Reset stale 'running' status (process died during previous shutdown)
        if (server.status === "running" && !this.processes.has(server.id)) {
          console.log(`[MCPServerManager] Recovering stale server: ${server.name} (${server.id})`);
        } else if (server.status === "error") {
          console.log(`[MCPServerManager] Recovering errored server: ${server.name} (${server.id})`);
        }

        // Reset error state before attempting restart
        await db
          .update(mcpServers)
          .set({ status: "stopped", restartCount: 0, lastError: null, pid: null })
          .where(eq(mcpServers.id, server.id));

        try {
          await this.startServer(server.id);
        } catch (err) {
          console.error(`[MCPServerManager] Failed to recover server ${server.name}:`, err);
        }
      }

      if (erroredServers.length > 0) {
        console.log(`[MCPServerManager] Recovery complete: attempted ${erroredServers.length} server(s)`);
      }
    } catch (error) {
      console.error("[MCPServerManager] Server recovery failed:", error);
    }
  }

  async startServer(serverId: string): Promise<boolean> {
    try {
      // Get server configuration from database
      const server = await db
        .select()
        .from(mcpServers)
        .where(eq(mcpServers.id, serverId))
        .limit(1)
        .then((rows) => rows[0]);

      if (!server) {
        console.error(`Server ${serverId} not found`);
        return false;
      }

      // Check if already running
      if (this.processes.has(serverId)) {
        console.log(`Server ${serverId} is already running`);
        return true;
      }

      // Validate command is not empty
      if (!server.command || server.command.trim() === '') {
        console.error(`Server ${serverId} has no command configured`);
        await this.updateErrorStatus(serverId, 'No command configured');
        return false;
      }

      // Parse command and arguments
      const args = Array.isArray(server.args) ? server.args : [];
      const env = server.env && typeof server.env === 'object' ? server.env : {};

      // v2.9.3 self-healing: preflight catches command_missing, path_unwritable,
      // and disabled_by_default before we burn maxRestarts on a doomed spawn.
      // Auto-creates filesystem-server root directories so a missing
      // /workspace (or whatever path was configured) is repaired in-place.
      const preflight = await preflightServer({
        command: server.command,
        args: args as string[],
        lastError: server.lastError,
      });
      if (!preflight.ok) {
        const errMsg = formatPreflightError(preflight);
        console.error(`Server ${serverId} preflight failed: ${errMsg}`);
        await this.updateErrorStatus(serverId, errMsg);
        return false;
      }

      console.log(`Starting server ${serverId} with command: ${server.command} ${args.join(' ')}`);

      // Spawn the process with shell: true to allow command parsing
      // This enables commands like "npx -y tavily-mcp@latest" to work correctly
      // stdin must be 'pipe' (not 'ignore') because MCP servers use JSON-RPC over stdio
      // and will exit immediately if stdin is closed/ignored
      const childProcess = spawn(server.command, args, {
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      // Handle spawn error immediately (before pid is assigned)
      let spawnError: Error | null = null;
      childProcess.on('error', (error) => {
        spawnError = error;
        console.error(`Server ${serverId} spawn error:`, error);
      });

      // Wait a tick for spawn errors to propagate
      await new Promise(resolve => setImmediate(resolve));

      if (spawnError) {
        console.error(`Failed to spawn server ${serverId}:`, spawnError);
        await this.updateErrorStatus(serverId, spawnError.message);
        return false;
      }

      if (!childProcess.pid) {
        console.error(`Failed to spawn server ${serverId} - no PID assigned`);
        await this.updateErrorStatus(serverId, 'Process failed to start - no PID assigned');
        return false;
      }

      // Set up spawn timeout to detect hanging processes
      const spawnTimeout = setTimeout(async () => {
        const proc = this.processes.get(serverId);
        if (proc && proc.process.exitCode === null) {
          // Process is still running after timeout, assume success
          console.log(`Server ${serverId} spawn timeout cleared - process is running`);
        }
      }, SPAWN_TIMEOUT_MS);

      // Store process information
      this.processes.set(serverId, {
        id: serverId,
        process: childProcess,
        pid: childProcess.pid,
        spawnTimeout,
      });

      // Set up event handlers for runtime errors
      childProcess.on('error', (error) => {
        console.error(`Server ${serverId} runtime error:`, error);
        this.cleanupSpawnTimeout(serverId);
        this.handleServerFailure(serverId, error.message);
      });

      childProcess.on('exit', (code, signal) => {
        console.log(`Server ${serverId} exited with code ${code}, signal ${signal}`);
        this.cleanupSpawnTimeout(serverId);
        // Only treat as failure if unexpected exit (not stopped by us)
        if (this.processes.has(serverId)) {
          this.handleServerFailure(serverId, `Process exited with code ${code}`);
        }
      });

      // Capture stderr for debugging
      childProcess.stderr?.on('data', (data) => {
        console.error(`Server ${serverId} stderr:`, data.toString());
      });

      // Update database status and reset restart counter (allows recovery from error state)
      await db
        .update(mcpServers)
        .set({
          status: 'running',
          pid: childProcess.pid,
          uptime: new Date(),
          lastError: null,
          restartCount: 0,
        })
        .where(eq(mcpServers.id, serverId));

      console.log(`Server ${serverId} started successfully with PID ${childProcess.pid}`);
      // FF_TOOL_SKILL_GENERATION — confirm the row has a SKILL.md once the
      // server actually starts. enqueueSkillGeneration() short-circuits when
      // the source hash matches an existing skill, so this is cheap on every
      // restart and only spends Tavily / LLM budget on truly new servers.
      enqueueSkillGeneration('mcp', serverId);
      return true;
    } catch (error) {
      console.error(`Failed to start server ${serverId}:`, error);
      await this.updateErrorStatus(serverId, error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  private cleanupSpawnTimeout(serverId: string): void {
    const proc = this.processes.get(serverId);
    if (proc?.spawnTimeout) {
      clearTimeout(proc.spawnTimeout);
    }
  }

  async stopServer(serverId: string): Promise<boolean> {
    try {
      const serverProcess = this.processes.get(serverId);

      if (!serverProcess) {
        console.log(`Server ${serverId} is not running`);
        await this.updateStatus(serverId, 'stopped');
        return true;
      }

      // Cleanup spawn timeout if exists
      this.cleanupSpawnTimeout(serverId);

      // Kill the process
      serverProcess.process.kill('SIGTERM');

      // Give it time to gracefully shutdown, then force kill if needed
      setTimeout(() => {
        if (!serverProcess.process.killed) {
          serverProcess.process.kill('SIGKILL');
        }
      }, 5000);

      // Remove from tracking
      this.processes.delete(serverId);

      // Update database
      await db
        .update(mcpServers)
        .set({
          status: 'stopped',
          pid: null,
        })
        .where(eq(mcpServers.id, serverId));

      console.log(`Server ${serverId} stopped successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to stop server ${serverId}:`, error);
      return false;
    }
  }

  async restartServer(serverId: string): Promise<boolean> {
    console.log(`Restarting server ${serverId}`);
    await this.stopServer(serverId);
    
    // Wait a bit before restarting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return await this.startServer(serverId);
  }

  private async handleServerFailure(serverId: string, errorMessage?: string): Promise<void> {
    this.processes.delete(serverId);

    // Get server configuration
    const server = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, serverId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!server) return;

    // Update status to error with message
    if (errorMessage) {
      await this.updateErrorStatus(serverId, errorMessage);
    } else {
      await this.updateStatus(serverId, 'error');
    }

    // Check if auto-restart is enabled
    if (server.autoRestart && server.restartCount < server.maxRestarts) {
      console.log(`Auto-restarting server ${serverId} (${server.restartCount + 1}/${server.maxRestarts})`);

      // Increment restart count
      await db
        .update(mcpServers)
        .set({
          restartCount: server.restartCount + 1,
        })
        .where(eq(mcpServers.id, serverId));

      // Attempt restart after delay
      setTimeout(() => {
        this.startServer(serverId);
      }, 2000);
    }
  }

  private async updateStatus(serverId: string, status: 'running' | 'stopped' | 'error'): Promise<void> {
    await db
      .update(mcpServers)
      .set({ status })
      .where(eq(mcpServers.id, serverId));
  }

  private async updateErrorStatus(serverId: string, error: string): Promise<void> {
    await db
      .update(mcpServers)
      .set({
        status: 'error',
        lastError: error,
      })
      .where(eq(mcpServers.id, serverId));
  }

  private startHealthMonitoring(): void {
    // Check server health every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.checkAllServers();
    }, 30000);
  }

  private async checkAllServers(): Promise<void> {
    const servers = await db.select().from(mcpServers);

    for (const server of servers) {
      if (server.status === 'running') {
        const isRunning = this.processes.has(server.id) && 
                         this.processes.get(server.id)!.process.exitCode === null;

        if (!isRunning) {
          console.log(`Server ${server.id} is marked as running but process is dead`);
          await this.handleServerFailure(server.id);
        }
      }
    }
  }

  async stopAll(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const serverIds = Array.from(this.processes.keys());
    for (const serverId of serverIds) {
      await this.stopServer(serverId);
    }
  }
}

// Export singleton instance
export const mcpServerManager = new MCPServerManager();

// Cleanup on process exit
process.on('SIGTERM', async () => {
  await mcpServerManager.stopAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await mcpServerManager.stopAll();
  process.exit(0);
});
