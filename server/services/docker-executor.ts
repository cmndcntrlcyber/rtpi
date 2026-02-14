import Docker from "dockerode";
import { Readable } from "stream";

// Initialize Docker client
const docker = new Docker();

// Types
export interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: Date;
  completedAt: Date;
  duration: number;
}

export interface ContainerStatus {
  id: string;
  name: string;
  status: string;
  state: string;
  created: Date;
  image: string;
  running: boolean;
}

export interface ExecutionOptions {
  timeout?: number; // milliseconds
  workDir?: string;
  env?: Record<string, string>;
  user?: string;
}

/**
 * Docker Execution Service
 * Handles command execution in Docker containers with security controls
 */
export class DockerExecutor {
  private readonly MAX_OUTPUT_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly DEFAULT_TIMEOUT = 300000; // 5 minutes
  private readonly DEFAULT_USER = "rtpi-tools";

  /**
   * Execute a command in a Docker container
   */
  async exec(
    containerName: string,
    cmd: string[],
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startedAt = new Date();

    // Validate command to prevent injection
    this.validateCommand(cmd);

    try {
      const container = await this.getContainer(containerName);
      
      // Check if container is running
      const containerInfo = await container.inspect();
      if (!containerInfo.State.Running) {
        throw new Error(`Container ${containerName} is not running`);
      }

      // Create exec instance
      const exec = await container.exec({
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: options.workDir || "/tmp",
        User: options.user || this.DEFAULT_USER,
        Env: options.env ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`) : undefined,
      });

      // Start execution with timeout
      const stream = await exec.start({ hijack: false, stdin: false });

      // Collect output with size limit
      const result = await this.collectOutput(
        stream as Readable,
        options.timeout || this.DEFAULT_TIMEOUT
      );

      // Verify process actually exited - wait for confirmed exit code
      let exitCode = 0;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const inspectResult = await exec.inspect();

        if (inspectResult.ExitCode !== null && inspectResult.ExitCode !== undefined) {
          exitCode = inspectResult.ExitCode;
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (attempts >= maxAttempts) {
        console.warn(`[DockerExecutor] Could not verify exit code after ${maxAttempts} attempts`);
      }

      const completedAt = new Date();

      return {
        exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        startedAt,
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
      };
    } catch (error) {
      throw new Error(
        `Execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute command with automatic retry on transient failures
   */
  async execWithRetry(
    containerName: string,
    cmd: string[],
    options: ExecutionOptions = {},
    maxRetries: number = 2
  ): Promise<ExecutionResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await this.exec(containerName, cmd, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on validation errors
        if (lastError.message.includes('Command contains dangerous pattern') ||
            lastError.message.includes('not found')) {
          throw lastError;
        }

        if (attempt <= maxRetries) {
          const delayMs = 1000 * attempt;
          console.warn(`[DockerExecutor] Retry ${attempt} in ${delayMs}ms:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Execute command with streaming output
   */
  async *execStream(
    containerName: string,
    cmd: string[],
    options: ExecutionOptions = {}
  ): AsyncIterableIterator<string> {
    this.validateCommand(cmd);

    const container = await this.getContainer(containerName);
    
    const containerInfo = await container.inspect();
    if (!containerInfo.State.Running) {
      throw new Error(`Container ${containerName} is not running`);
    }

    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: options.workDir || "/tmp",
      User: options.user || this.DEFAULT_USER,
      Env: options.env ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`) : undefined,
    });

    const stream = await exec.start({ hijack: false, stdin: false });

    // Stream output as it arrives
    yield* this.streamOutput(stream as Readable);
  }

  /**
   * Upload file to container
   */
  async uploadFile(
    containerName: string,
    localPath: string,
    containerPath: string
  ): Promise<void> {
    const container = await this.getContainer(containerName);
    
    const fs = await import("fs");
    const tar = await import("tar-stream");
    const path = await import("path");

    // Create tar stream
    const pack = tar.pack();
    const fileName = path.basename(containerPath);
    const fileContent = await fs.promises.readFile(localPath);

    pack.entry({ name: fileName }, fileContent, (err) => {
      if (err) throw err;
      pack.finalize();
    });

    // Upload to container
    const containerDir = path.dirname(containerPath);
    await container.putArchive(pack, { path: containerDir });
  }

  /**
   * Download file from container
   */
  async downloadFile(
    containerName: string,
    containerPath: string,
    localPath: string
  ): Promise<void> {
    const container = await this.getContainer(containerName);
    
    const fs = await import("fs");
    const tar = await import("tar-stream");

    // Get file as tar stream
    const stream = await container.getArchive({ path: containerPath });

    // Extract tar stream
    const extract = tar.extract();
    
    return new Promise((resolve, reject) => {
      extract.on("entry", (_header, entryStream, next) => {
        const writeStream = fs.createWriteStream(localPath);
        entryStream.pipe(writeStream);
        entryStream.on("end", next);
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      extract.on("finish", resolve);
      extract.on("error", reject);

      stream.pipe(extract);
    });
  }

  /**
   * Get container status and health
   */
  async getContainerStatus(containerName: string): Promise<ContainerStatus> {
    try {
      const container = await this.getContainer(containerName);
      const info = await container.inspect();

      return {
        id: info.Id,
        name: info.Name.replace(/^\//, ""),
        status: info.State.Status,
        state: info.State.Status,
        created: new Date(info.Created),
        image: info.Config.Image,
        running: info.State.Running,
      };
    } catch (error) {
      throw new Error(
        `Failed to get container status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * List all containers
   */
  async listContainers(): Promise<ContainerStatus[]> {
    const containers = await docker.listContainers({ all: true });
    
    return containers.map((c) => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, "") || "unknown",
      status: c.Status,
      state: c.State,
      created: new Date(c.Created * 1000),
      image: c.Image,
      running: c.State === "running",
    }));
  }

  /**
   * Get container logs
   */
  async getContainerLogs(
    containerName: string,
    tail: number = 100
  ): Promise<string> {
    const container = await this.getContainer(containerName);
    
    const logStream = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });

    return logStream.toString("utf-8");
  }

  /**
   * Restart container
   */
  async restartContainer(containerName: string): Promise<void> {
    const container = await this.getContainer(containerName);
    await container.restart();
  }

  /**
   * Stop container
   */
  async stopContainer(containerName: string): Promise<void> {
    const container = await this.getContainer(containerName);
    await container.stop();
  }

  /**
   * Start container
   */
  async startContainer(containerName: string): Promise<void> {
    const container = await this.getContainer(containerName);
    await container.start();
  }

  // Private helper methods

  private async getContainer(containerName: string): Promise<Docker.Container> {
    try {
      // Try to get container by name
      const containers = await docker.listContainers({ all: true });
      const containerInfo = containers.find(
        (c) => c.Names.some((n) => n === `/${containerName}`) || c.Id === containerName
      );

      if (!containerInfo) {
        throw new Error(`Container ${containerName} not found`);
      }

      return docker.getContainer(containerInfo.Id);
    } catch (error) {
      throw new Error(
        `Failed to get container: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private validateCommand(cmd: string[]): void {
    if (!cmd || cmd.length === 0) {
      throw new Error("Command cannot be empty");
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /rm\s+-rf\s+\//, // Don't allow recursive deletion of root
      />\s*\/dev\//, // Don't allow writing to device files
      /mkfs/, // Don't allow formatting
      /dd\s+if=/, // Limit dd usage
    ];

    const cmdString = cmd.join(" ");
    for (const pattern of dangerousPatterns) {
      if (pattern.test(cmdString)) {
        throw new Error(`Command contains dangerous pattern: ${pattern}`);
      }
    }

    // Limit command length
    if (cmdString.length > 10000) {
      throw new Error("Command is too long");
    }
  }

  private async collectOutput(
    stream: Readable,
    timeout: number
  ): Promise<{ stdout: string; stderr: string }> {
    let stdout = "";
    let stderr = "";
    let totalSize = 0;
    let buffer = Buffer.alloc(0); // Persistent buffer across chunks

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        stream.destroy();
        reject(new Error("Command execution timeout"));
      }, timeout);

      // Docker multiplexes stdout and stderr
      // First 8 bytes are header: [stream_type, 0, 0, 0, size_msb, size_2, size_3, size_lsb]
      stream.on("data", (chunk: Buffer) => {
        // Append new chunk to existing buffer
        buffer = Buffer.concat([buffer, chunk]);
        let offset = 0;

        while (offset < buffer.length) {
          // Need at least 8 bytes for header
          if (buffer.length - offset < 8) {
            // Preserve remaining bytes for next chunk
            buffer = buffer.slice(offset);
            return;
          }

          const header = buffer.slice(offset, offset + 8);
          const streamType = header[0]; // 1 = stdout, 2 = stderr
          const size = header.readUInt32BE(4);

          offset += 8;

          // Need full payload
          if (buffer.length - offset < size) {
            // Preserve header + partial payload for next chunk
            buffer = buffer.slice(offset - 8);
            return;
          }

          const data = buffer.slice(offset, offset + size).toString("utf-8");
          offset += size;

          totalSize += size;

          // Warn at 80% capacity
          if (totalSize > this.MAX_OUTPUT_SIZE * 0.8 &&
              totalSize <= this.MAX_OUTPUT_SIZE * 0.8 + size) {
            console.warn(`[DockerExecutor] Output approaching limit: ${Math.round(totalSize / 1024 / 1024)}MB / ${Math.round(this.MAX_OUTPUT_SIZE / 1024 / 1024)}MB`);
          }

          if (totalSize > this.MAX_OUTPUT_SIZE) {
            stream.destroy();
            reject(new Error("Output size limit exceeded"));
            return;
          }

          if (streamType === 1) {
            stdout += data;
          } else if (streamType === 2) {
            stderr += data;
          }
        }

        // Clear buffer if all data processed
        if (offset >= buffer.length) {
          buffer = Buffer.alloc(0);
        }
      });

      stream.on("end", () => {
        clearTimeout(timeoutId);
        if (buffer.length > 0) {
          console.warn(`[DockerExecutor] Stream ended with ${buffer.length} bytes remaining`);
        }
        resolve({ stdout, stderr });
      });

      stream.on("error", (err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
    });
  }

  private async *streamOutput(stream: Readable): AsyncIterableIterator<string> {
    let buffer = Buffer.alloc(0); // Persistent buffer across chunks
    const reader = stream[Symbol.asyncIterator]();

    for await (const chunk of reader) {
      const newData = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      buffer = Buffer.concat([buffer, newData]);

      let offset = 0;
      while (offset < buffer.length) {
        // Need at least 8 bytes for header
        if (buffer.length - offset < 8) {
          buffer = buffer.slice(offset);
          break;
        }

        const header = buffer.slice(offset, offset + 8);
        const size = header.readUInt32BE(4);
        offset += 8;

        // Need full payload
        if (buffer.length - offset < size) {
          buffer = buffer.slice(offset - 8);
          break;
        }

        const data = buffer.slice(offset, offset + size).toString("utf-8");
        offset += size;
        yield data;
      }

      if (offset >= buffer.length) {
        buffer = Buffer.alloc(0);
      }
    }

    if (buffer.length > 0) {
      console.warn(`[DockerExecutor] Stream ended with ${buffer.length} bytes unprocessed`);
    }
  }
}

// Export singleton instance
export const dockerExecutor = new DockerExecutor();

/**
 * Keep database connection alive during long operations
 * Returns a cleanup function to stop the keepalive
 */
export async function keepDatabaseAlive(
  durationMs: number,
  intervalMs: number = 60000
): Promise<() => void> {
  const { db } = await import('../db');
  const { sql } = await import('drizzle-orm');

  const intervalId = setInterval(async () => {
    try {
      await db.execute(sql`SELECT 1`);
    } catch (error) {
      console.error('[DockerExecutor] Database keepalive failed:', error);
    }
  }, intervalMs);

  setTimeout(() => clearInterval(intervalId), durationMs);

  return () => clearInterval(intervalId);
}
