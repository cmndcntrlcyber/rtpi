import { spawn, ChildProcess } from 'child_process';
import { db } from '../db';
import { mcpServers } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface MCPServerProcess {
  id: string;
  process: ChildProcess;
  pid: number;
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

      // Parse command and arguments
      const args = Array.isArray(server.args) ? server.args : [];
      const env = server.env && typeof server.env === 'object' ? server.env : {};

      // Spawn the process
      const childProcess = spawn(server.command, args, {
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      if (!childProcess.pid) {
        console.error(`Failed to spawn server ${serverId}`);
        return false;
      }

      // Store process information
      this.processes.set(serverId, {
        id: serverId,
        process: childProcess,
        pid: childProcess.pid,
      });

      // Set up event handlers
      childProcess.on('error', (error) => {
        console.error(`Server ${serverId} error:`, error);
        this.handleServerFailure(serverId);
      });

      childProcess.on('exit', (code, signal) => {
        console.log(`Server ${serverId} exited with code ${code}, signal ${signal}`);
        this.handleServerFailure(serverId);
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

  async stopServer(serverId: string): Promise<boolean> {
    try {
      const serverProcess = this.processes.get(serverId);

      if (!serverProcess) {
        console.log(`Server ${serverId} is not running`);
        await this.updateStatus(serverId, 'stopped');
        return true;
      }

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

  private async handleServerFailure(serverId: string): Promise<void> {
    this.processes.delete(serverId);

    // Get server configuration
    const server = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, serverId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!server) return;

    // Update status to error
    await this.updateStatus(serverId, 'error');

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

      // Attempt restart
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
