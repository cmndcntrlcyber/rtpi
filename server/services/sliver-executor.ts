import { dockerExecutor } from "./docker-executor";
import { db } from "../db";
import { sliverSessions, sliverTasks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "../lib/logger";
import { logToolAudit } from "../auth/middleware";

const log = createLogger("sliver-executor");

export interface SliverExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

export interface SliverSession {
  ID: string;
  Name: string;
  Hostname: string;
  Username: string;
  OS: string;
  Arch: string;
  Transport: string;
  RemoteAddress: string;
  PID: number;
  Filename: string;
  LastCheckin: string;
  IsDead: boolean;
}

export interface SliverBeacon {
  ID: string;
  Name: string;
  Hostname: string;
  Username: string;
  OS: string;
  Arch: string;
  Transport: string;
  RemoteAddress: string;
  PID: number;
  Filename: string;
  LastCheckin: string;
  Interval: number;
  IsDead: boolean;
}

export interface SliverJob {
  ID: number;
  Name: string;
  Protocol: string;
  Port: number;
}

export interface ListenerOptions {
  type: "mtls" | "http" | "https" | "dns" | "wg";
  host?: string;
  port?: number;
  domain?: string;
  website?: string;
}

export interface ImplantGenerateOptions {
  os?: string;
  arch?: string;
  format?: string;
  mtls?: string;
  http?: string;
  https?: string;
  dns?: string;
  name?: string;
  beacon?: boolean;
  interval?: number;
  jitter?: number;
}

class SliverExecutor {
  private readonly containerName = "rtpi-sliver-agent";

  private parseJsonOutput(stdout: string): any {
    try {
      return JSON.parse(stdout.trim());
    } catch {
      return null;
    }
  }

  async checkConnection(): Promise<SliverExecutionResult> {
    const timestamp = new Date().toISOString();
    try {
      const result = await dockerExecutor.exec(this.containerName, [
        "sliver-client", "version",
      ]);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || "Sliver client not available", timestamp };
      }

      return { success: true, data: { version: result.stdout.trim() }, timestamp };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to connect to Sliver", timestamp };
    }
  }

  async listSessions(): Promise<SliverExecutionResult> {
    const timestamp = new Date().toISOString();
    try {
      const result = await dockerExecutor.exec(this.containerName, [
        "sliver-client", "sessions", "--json",
      ]);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || "Failed to list sessions", timestamp };
      }

      const sessions = this.parseJsonOutput(result.stdout) || [];
      return { success: true, data: sessions, timestamp };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to list sessions", timestamp };
    }
  }

  async syncSessions(userId: string): Promise<SliverExecutionResult> {
    const timestamp = new Date().toISOString();
    try {
      const sessionsResult = await this.listSessions();
      if (!sessionsResult.success) return sessionsResult;

      const sessions: SliverSession[] = sessionsResult.data || [];
      let synced = 0;

      for (const session of sessions) {
        const existing = await db.query.sliverSessions.findFirst({
          where: eq(sliverSessions.sessionId, session.ID),
        });

        if (existing) {
          await db.update(sliverSessions).set({
            status: session.IsDead ? "disconnected" : "active",
            lastCheckin: session.LastCheckin ? new Date(session.LastCheckin) : null,
            updatedAt: new Date(),
          }).where(eq(sliverSessions.id, existing.id));
        } else {
          await db.insert(sliverSessions).values({
            sessionId: session.ID,
            name: session.Name,
            hostname: session.Hostname,
            username: session.Username,
            os: session.OS,
            arch: session.Arch,
            transport: session.Transport,
            remoteAddress: session.RemoteAddress,
            pid: session.PID,
            filename: session.Filename,
            lastCheckin: session.LastCheckin ? new Date(session.LastCheckin) : null,
            status: session.IsDead ? "disconnected" : "active",
            isBeacon: false,
          });
        }
        synced++;
      }

      logToolAudit(userId, "sliver_sync_sessions", "sliver", null, true, { synced });
      return { success: true, data: { synced }, timestamp };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to sync sessions", timestamp };
    }
  }

  async executeCommand(
    sessionId: string,
    command: string,
    userId: string
  ): Promise<SliverExecutionResult> {
    const timestamp = new Date().toISOString();
    try {
      const [task] = await db.insert(sliverTasks).values({
        sessionId,
        command,
        status: "queued",
        createdBy: userId,
      }).returning();

      const result = await dockerExecutor.exec(this.containerName, [
        "sliver-client", "use", sessionId, "--", command,
      ], { timeout: 120000 });

      const status = result.exitCode === 0 ? "completed" : "error";
      await db.update(sliverTasks).set({
        status,
        results: result.stdout || null,
        errorMessage: result.exitCode !== 0 ? result.stderr : null,
        completedAt: new Date(),
      }).where(eq(sliverTasks.id, task.id));

      logToolAudit(userId, "sliver_execute_command", "sliver", sessionId, result.exitCode === 0, {
        command,
        taskId: task.id,
      });

      return {
        success: result.exitCode === 0,
        data: { taskId: task.id, output: result.stdout, stderr: result.stderr },
        error: result.exitCode !== 0 ? result.stderr : undefined,
        timestamp,
      };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to execute command", timestamp };
    }
  }

  async listImplants(): Promise<SliverExecutionResult> {
    const timestamp = new Date().toISOString();
    try {
      const result = await dockerExecutor.exec(this.containerName, [
        "sliver-client", "implants", "--json",
      ]);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || "Failed to list implants", timestamp };
      }

      const implants = this.parseJsonOutput(result.stdout) || [];
      return { success: true, data: implants, timestamp };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to list implants", timestamp };
    }
  }

  async generateImplant(
    options: ImplantGenerateOptions,
    userId: string
  ): Promise<SliverExecutionResult> {
    const timestamp = new Date().toISOString();
    try {
      const args = ["sliver-client", "generate"];

      if (options.beacon) args.push("beacon");
      if (options.os) args.push("--os", options.os);
      if (options.arch) args.push("--arch", options.arch);
      if (options.format) args.push("--format", options.format);
      if (options.mtls) args.push("--mtls", options.mtls);
      if (options.http) args.push("--http", options.http);
      if (options.https) args.push("--https", options.https);
      if (options.dns) args.push("--dns", options.dns);
      if (options.name) args.push("--name", options.name);
      if (options.interval) args.push("--seconds", String(options.interval));
      if (options.jitter) args.push("--jitter", String(options.jitter));

      const result = await dockerExecutor.exec(this.containerName, args, { timeout: 300000 });

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || "Failed to generate implant", timestamp };
      }

      logToolAudit(userId, "sliver_generate_implant", "sliver", null, true, {
        os: options.os,
        arch: options.arch,
        name: options.name,
      });

      return { success: true, data: { output: result.stdout.trim() }, timestamp };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to generate implant", timestamp };
    }
  }

  async listJobs(): Promise<SliverExecutionResult> {
    const timestamp = new Date().toISOString();
    try {
      const result = await dockerExecutor.exec(this.containerName, [
        "sliver-client", "jobs", "--json",
      ]);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || "Failed to list jobs", timestamp };
      }

      const jobs = this.parseJsonOutput(result.stdout) || [];
      return { success: true, data: jobs, timestamp };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to list jobs", timestamp };
    }
  }

  async startListener(
    options: ListenerOptions,
    userId: string
  ): Promise<SliverExecutionResult> {
    const timestamp = new Date().toISOString();
    try {
      const args = ["sliver-client", options.type];

      if (options.host) args.push("--lhost", options.host);
      if (options.port) args.push("--lport", String(options.port));
      if (options.domain) args.push("--domain", options.domain);
      if (options.website) args.push("--website", options.website);

      const result = await dockerExecutor.exec(this.containerName, args);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || "Failed to start listener", timestamp };
      }

      logToolAudit(userId, "sliver_start_listener", "sliver", null, true, {
        type: options.type,
        host: options.host,
        port: options.port,
      });

      return { success: true, data: { output: result.stdout.trim() }, timestamp };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to start listener", timestamp };
    }
  }

  async stopListener(jobId: number, userId: string): Promise<SliverExecutionResult> {
    const timestamp = new Date().toISOString();
    try {
      const result = await dockerExecutor.exec(this.containerName, [
        "sliver-client", "jobs", "-k", String(jobId),
      ]);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || "Failed to stop listener", timestamp };
      }

      logToolAudit(userId, "sliver_stop_listener", "sliver", String(jobId), true, {});
      return { success: true, data: { killed: jobId }, timestamp };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to stop listener", timestamp };
    }
  }

  async killSession(sessionId: string, userId: string): Promise<SliverExecutionResult> {
    const timestamp = new Date().toISOString();
    try {
      const result = await dockerExecutor.exec(this.containerName, [
        "sliver-client", "kill", "-s", sessionId,
      ]);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || "Failed to kill session", timestamp };
      }

      await db.update(sliverSessions).set({
        status: "killed",
        updatedAt: new Date(),
      }).where(eq(sliverSessions.sessionId, sessionId));

      logToolAudit(userId, "sliver_kill_session", "sliver", sessionId, true, {});
      return { success: true, timestamp };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to kill session", timestamp };
    }
  }
}

export const sliverExecutor = new SliverExecutor();
