import { spawn, ChildProcess } from 'child_process';
import { db } from '../db';
import { mcpServers } from '@shared/schema';
import { eq } from 'drizzle-orm';

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

  constructor() {
    // Start periodic health checks
    this.startHealthMonitoring();
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

      console.log(`Starting server ${serverId} with command: ${server.command} ${args.join(' ')}`);

      // Spawn the process with shell: true to allow command parsing
      // This enables commands like "npx -y tavily-mcp@latest" to work correctly
      const childProcess = spawn(server.command, args, {
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
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

      // Update database status
      await db
        .update(mcpServers)
        .set({
          status: 'running',
          pid: childProcess.pid,
          uptime: new Date(),
          lastError: null,
        })
        .where(eq(mcpServers.id, serverId));

      console.log(`Server ${serverId} started successfully with PID ${childProcess.pid}`);
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
