import Docker from "dockerode";
import fs from "fs";
import path from "path";
import { dockerExecutor, type ExecutionResult } from "./docker-executor";
import { createLogger } from "../lib/logger";

const log = createLogger("nexus-kali-bridge");

const CONTAINER_NAME = "nexus-kali";
const RESULTS_DIR = "/home/cmndcntrl/code/nexus-harness/docker/results";
const SHARED_DIR = "/home/cmndcntrl/code/nexus-harness/docker/shared";
const ENGAGEMENTS_DIR = "/home/cmndcntrl/code/nexus-harness/docker/engagements";

const docker = new Docker();

export interface KaliStatus {
  running: boolean;
  healthy: boolean;
  containerId: string;
  image: string;
  uptime: string;
  startedAt: string;
  state: string;
  ports: Record<string, string>;
}

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modifiedAt: string;
}

class NexusKaliBridge {
  private statusCache: { data: KaliStatus | null; ts: number } = { data: null, ts: 0 };
  private readonly STATUS_TTL = 30_000;

  async getStatus(): Promise<KaliStatus> {
    const now = Date.now();
    if (this.statusCache.data && now - this.statusCache.ts < this.STATUS_TTL) {
      return this.statusCache.data;
    }

    try {
      const containers = await docker.listContainers({ all: true });
      const info = containers.find(
        (c) => c.Names.some((n) => n === `/${CONTAINER_NAME}`)
      );

      if (!info) {
        const status: KaliStatus = {
          running: false, healthy: false, containerId: "",
          image: "", uptime: "", startedAt: "", state: "not_found", ports: {},
        };
        this.statusCache = { data: status, ts: now };
        return status;
      }

      const container = docker.getContainer(info.Id);
      const detail = await container.inspect();

      const ports: Record<string, string> = {};
      if (detail.NetworkSettings?.Ports) {
        for (const [containerPort, bindings] of Object.entries(detail.NetworkSettings.Ports)) {
          if (bindings && bindings.length > 0) {
            ports[containerPort] = bindings[0].HostPort || "";
          }
        }
      }

      const startedAt = detail.State.StartedAt || "";
      let uptime = "";
      if (startedAt) {
        const ms = now - new Date(startedAt).getTime();
        const hours = Math.floor(ms / 3_600_000);
        const mins = Math.floor((ms % 3_600_000) / 60_000);
        uptime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      }

      const healthStatus = detail.State.Health?.Status;
      const status: KaliStatus = {
        running: detail.State.Running,
        healthy: healthStatus === "healthy",
        containerId: info.Id.slice(0, 12),
        image: detail.Config.Image,
        uptime,
        startedAt,
        state: detail.State.Status,
        ports,
      };

      this.statusCache = { data: status, ts: now };
      return status;
    } catch (err) {
      log.error({ err }, "[nexus-kali-bridge] status check failed");
      const status: KaliStatus = {
        running: false, healthy: false, containerId: "",
        image: "", uptime: "", startedAt: "", state: "error", ports: {},
      };
      this.statusCache = { data: status, ts: now };
      return status;
    }
  }

  async exec(
    command: string[],
    workDir?: string,
    timeout?: number,
  ): Promise<ExecutionResult> {
    return dockerExecutor.exec(CONTAINER_NAME, command, {
      workDir: workDir || "/tmp",
      timeout: timeout || 300_000,
      user: "kasm-user",
    });
  }

  async getLogs(lines: number = 100, since?: string): Promise<string> {
    const containers = await docker.listContainers({ all: true });
    const info = containers.find(
      (c) => c.Names.some((n) => n === `/${CONTAINER_NAME}`)
    );
    if (!info) throw new Error("nexus-kali container not found");

    const container = docker.getContainer(info.Id);
    const opts: Record<string, any> = {
      stdout: true,
      stderr: true,
      tail: lines,
      timestamps: true,
    };

    if (since) {
      const match = since.match(/^(\d+)([smhd])$/);
      if (match) {
        const val = parseInt(match[1], 10);
        const unit = match[2];
        const multiplier: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
        const sinceUnix = Math.floor(Date.now() / 1000) - val * (multiplier[unit] || 1);
        opts.since = sinceUnix;
      }
    }

    const logBuffer = await container.logs(opts);
    return this.demuxDockerLogs(logBuffer);
  }

  async listFiles(baseDir: string): Promise<FileEntry[]> {
    const resolved = path.resolve(baseDir);
    if (!resolved.startsWith(path.resolve(baseDir))) {
      throw new Error("Path traversal detected");
    }

    try {
      await fs.promises.access(resolved);
    } catch {
      return [];
    }

    const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
    const result: FileEntry[] = [];

    for (const entry of entries) {
      try {
        const fullPath = path.join(resolved, entry.name);
        const stat = await fs.promises.stat(fullPath);
        result.push({
          name: entry.name,
          path: entry.name,
          size: stat.size,
          isDirectory: entry.isDirectory(),
          modifiedAt: stat.mtime.toISOString(),
        });
      } catch {
        // Skip unreadable entries
      }
    }

    return result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async readFile(baseDir: string, relativePath: string): Promise<string> {
    const base = path.resolve(baseDir);
    const full = path.resolve(base, relativePath);
    if (!full.startsWith(base + path.sep) && full !== base) {
      throw new Error("Path traversal detected");
    }
    return fs.promises.readFile(full, "utf-8");
  }

  async listResults(): Promise<FileEntry[]> {
    return this.listFiles(RESULTS_DIR);
  }

  async readResult(filename: string): Promise<string> {
    return this.readFile(RESULTS_DIR, filename);
  }

  async listEngagements(): Promise<FileEntry[]> {
    return this.listFiles(ENGAGEMENTS_DIR);
  }

  async listEngagementFiles(engagementName: string): Promise<FileEntry[]> {
    const base = path.resolve(ENGAGEMENTS_DIR);
    const dir = path.resolve(base, engagementName);
    if (!dir.startsWith(base + path.sep)) {
      throw new Error("Path traversal detected");
    }
    return this.listFiles(dir);
  }

  async readEngagementFile(engagementName: string, filename: string): Promise<string> {
    const base = path.resolve(ENGAGEMENTS_DIR);
    const engDir = path.resolve(base, engagementName);
    if (!engDir.startsWith(base + path.sep)) {
      throw new Error("Path traversal detected");
    }
    return this.readFile(engDir, filename);
  }

  async listShared(): Promise<FileEntry[]> {
    return this.listFiles(SHARED_DIR);
  }

  async readSharedFile(relativePath: string): Promise<string> {
    return this.readFile(SHARED_DIR, relativePath);
  }

  private demuxDockerLogs(buffer: Buffer | string): string {
    if (typeof buffer === "string") return buffer;

    const lines: string[] = [];
    let offset = 0;
    while (offset < buffer.length) {
      if (buffer.length - offset < 8) break;
      const size = buffer.readUInt32BE(offset + 4);
      offset += 8;
      if (buffer.length - offset < size) break;
      lines.push(buffer.slice(offset, offset + size).toString("utf-8"));
      offset += size;
    }
    return lines.join("");
  }
}

export const nexusKaliBridge = new NexusKaliBridge();
