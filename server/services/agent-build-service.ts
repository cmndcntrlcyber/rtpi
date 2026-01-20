/**
 * Agent Build Service
 *
 * Orchestrates Docker-based compilation of rust-nexus agents.
 * Supports cross-platform builds for Windows and Linux with configurable features.
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '@db';
import { agentBuilds } from '@shared/schema';
import { eq } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export type AgentPlatform = 'windows' | 'linux' | 'macos';
export type AgentArchitecture = 'x64' | 'x86' | 'arm64';

export interface BuildOptions {
  platform: AgentPlatform;
  architecture: AgentArchitecture;
  features?: string[];
  userId: string;
  metadata?: Record<string, unknown>;
}

export interface BuildStatus {
  id: string;
  status: 'pending' | 'building' | 'completed' | 'failed' | 'cancelled';
  platform: AgentPlatform;
  architecture: AgentArchitecture;
  features: string[];
  binaryPath?: string;
  binarySize?: number;
  binaryHash?: string;
  buildLog?: string;
  buildDurationMs?: number;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface BuildResult {
  buildId: string;
  status: 'completed' | 'failed';
  binaryPath?: string;
  binarySize?: number;
  binaryHash?: string;
  buildDurationMs?: number;
  errorMessage?: string;
}

// ============================================================================
// Available Cargo Features
// ============================================================================

export const AVAILABLE_FEATURES = [
  { name: 'anti-debug', description: 'Anti-debugging detection and evasion' },
  { name: 'anti-vm', description: 'VM/sandbox detection' },
  { name: 'process-injection', description: 'Process injection capabilities' },
  { name: 'domain-fronting', description: 'Domain fronting for C2' },
  { name: 'http-fallback', description: 'HTTP fallback communication' },
  { name: 'traffic-obfuscation', description: 'Traffic obfuscation' },
  { name: 'systemd-integration', description: 'Linux systemd integration' },
  { name: 'bof-loading', description: 'Beacon Object File loading (Windows)' },
  { name: 'wmi-execution', description: 'WMI execution (Windows)' },
  { name: 'elf-loading', description: 'ELF loading (Linux)' },
] as const;

// ============================================================================
// Agent Build Service
// ============================================================================

class AgentBuildService {
  private readonly rustNexusPath: string;
  private readonly buildsDir: string;
  private readonly buildTimeout: number;
  private readonly dockerImage: string;
  private activeBuilds: Map<string, ChildProcess> = new Map();

  constructor() {
    this.rustNexusPath = process.env.RUST_NEXUS_PATH || '/opt/rust-nexus';
    this.buildsDir = process.env.AGENT_BUILDS_DIR || './uploads/agent-builds';
    this.buildTimeout = parseInt(process.env.AGENT_BUILD_TIMEOUT || '600000', 10); // 10 min default
    this.dockerImage = process.env.AGENT_BUILDER_IMAGE || 'rtpi/agent-builder:latest';
  }

  /**
   * Trigger a new agent build
   */
  async triggerBuild(options: BuildOptions): Promise<string> {
    // Validate features
    if (options.features) {
      const invalidFeatures = options.features.filter(
        f => !AVAILABLE_FEATURES.some(af => af.name === f)
      );
      if (invalidFeatures.length > 0) {
        throw new Error(`Invalid features: ${invalidFeatures.join(', ')}`);
      }
    }

    // Create build record in database
    const [build] = await db.insert(agentBuilds).values({
      platform: options.platform,
      architecture: options.architecture,
      features: options.features || [],
      status: 'pending',
      createdBy: options.userId,
      metadata: options.metadata || {},
    }).returning();

    console.log(`[AgentBuildService] Created build ${build.id} for ${options.platform}/${options.architecture}`);

    // Start build asynchronously
    this.executeBuild(build.id, options).catch(error => {
      console.error(`[AgentBuildService] Build ${build.id} failed:`, error);
    });

    return build.id;
  }

  /**
   * Execute the Docker build
   */
  private async executeBuild(buildId: string, options: BuildOptions): Promise<void> {
    const outputDir = path.join(this.buildsDir, buildId);

    try {
      // Create output directory
      await fs.mkdir(outputDir, { recursive: true });

      // Update status to building
      await db.update(agentBuilds)
        .set({ status: 'building' })
        .where(eq(agentBuilds.id, buildId));

      console.log(`[AgentBuildService] Starting build ${buildId}`);
      const startTime = Date.now();

      // Construct Docker command
      const features = (options.features || []).join(',');
      const dockerArgs = [
        'run', '--rm',
        '-v', `${path.resolve(this.rustNexusPath)}:/build/rust-nexus`,
        '-v', `${path.resolve(outputDir)}:/output`,
        this.dockerImage,
        options.platform,
        options.architecture,
        features,
        '/output'
      ];

      console.log(`[AgentBuildService] Docker command: docker ${dockerArgs.join(' ')}`);

      // Spawn Docker process
      const docker = spawn('docker', dockerArgs);
      this.activeBuilds.set(buildId, docker);

      // Capture output
      let buildLog = '';
      docker.stdout.on('data', (data: Buffer) => {
        buildLog += data.toString();
      });
      docker.stderr.on('data', (data: Buffer) => {
        buildLog += data.toString();
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        console.warn(`[AgentBuildService] Build ${buildId} timed out`);
        docker.kill('SIGTERM');
      }, this.buildTimeout);

      // Wait for completion
      const exitCode = await new Promise<number>((resolve) => {
        docker.on('close', (code) => {
          clearTimeout(timeoutId);
          this.activeBuilds.delete(buildId);
          resolve(code ?? 1);
        });
        docker.on('error', (err) => {
          clearTimeout(timeoutId);
          this.activeBuilds.delete(buildId);
          buildLog += `\nDocker error: ${err.message}`;
          resolve(1);
        });
      });

      const duration = Date.now() - startTime;

      if (exitCode === 0) {
        // Build succeeded
        const binaryName = options.platform === 'windows' ? 'nexus-agent.exe' : 'nexus-agent';
        const binaryPath = path.join(outputDir, binaryName);

        // Verify binary exists
        try {
          await fs.access(binaryPath);
        } catch {
          throw new Error(`Binary not found at ${binaryPath}`);
        }

        // Get file info
        const stats = await fs.stat(binaryPath);
        const hash = await this.calculateFileHash(binaryPath);

        await db.update(agentBuilds).set({
          status: 'completed',
          binaryPath,
          binaryHash: hash,
          binarySize: stats.size,
          buildLog,
          buildDurationMs: duration,
          completedAt: new Date(),
        }).where(eq(agentBuilds.id, buildId));

        console.log(`[AgentBuildService] Build ${buildId} completed successfully in ${duration}ms`);
      } else {
        // Build failed
        await db.update(agentBuilds).set({
          status: 'failed',
          buildLog,
          buildDurationMs: duration,
          errorMessage: `Build exited with code ${exitCode}`,
          completedAt: new Date(),
        }).where(eq(agentBuilds.id, buildId));

        console.error(`[AgentBuildService] Build ${buildId} failed with exit code ${exitCode}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await db.update(agentBuilds).set({
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
      }).where(eq(agentBuilds.id, buildId));

      console.error(`[AgentBuildService] Build ${buildId} error:`, errorMessage);
    }
  }

  /**
   * Get build status
   */
  async getBuildStatus(buildId: string): Promise<BuildStatus | null> {
    const build = await db.query.agentBuilds.findFirst({
      where: eq(agentBuilds.id, buildId)
    });

    if (!build) {
      return null;
    }

    return {
      id: build.id,
      status: build.status as BuildStatus['status'],
      platform: build.platform as AgentPlatform,
      architecture: build.architecture as AgentArchitecture,
      features: (build.features as string[]) || [],
      binaryPath: build.binaryPath || undefined,
      binarySize: build.binarySize || undefined,
      binaryHash: build.binaryHash || undefined,
      buildLog: build.buildLog || undefined,
      buildDurationMs: build.buildDurationMs || undefined,
      errorMessage: build.errorMessage || undefined,
      createdAt: build.createdAt,
      completedAt: build.completedAt || undefined,
    };
  }

  /**
   * Wait for build to complete (with polling)
   */
  async waitForBuild(buildId: string, pollIntervalMs = 2000, maxWaitMs = 600000): Promise<BuildResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getBuildStatus(buildId);

      if (!status) {
        throw new Error(`Build ${buildId} not found`);
      }

      if (status.status === 'completed') {
        return {
          buildId,
          status: 'completed',
          binaryPath: status.binaryPath,
          binarySize: status.binarySize,
          binaryHash: status.binaryHash,
          buildDurationMs: status.buildDurationMs,
        };
      }

      if (status.status === 'failed' || status.status === 'cancelled') {
        return {
          buildId,
          status: 'failed',
          errorMessage: status.errorMessage,
          buildDurationMs: status.buildDurationMs,
        };
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Build ${buildId} timed out after ${maxWaitMs}ms`);
  }

  /**
   * Cancel a running build
   */
  async cancelBuild(buildId: string): Promise<boolean> {
    const process = this.activeBuilds.get(buildId);

    if (process) {
      process.kill('SIGTERM');
      this.activeBuilds.delete(buildId);
    }

    await db.update(agentBuilds).set({
      status: 'cancelled',
      completedAt: new Date(),
    }).where(eq(agentBuilds.id, buildId));

    console.log(`[AgentBuildService] Build ${buildId} cancelled`);
    return true;
  }

  /**
   * List recent builds
   */
  async listBuilds(options: { limit?: number; platform?: AgentPlatform; status?: string } = {}) {
    const limit = options.limit || 20;

    let query = db.select().from(agentBuilds).orderBy(agentBuilds.createdAt);

    // Note: Drizzle filtering would be added here based on options
    const builds = await query.limit(limit);

    return builds;
  }

  /**
   * Clean up old builds
   */
  async cleanupOldBuilds(maxAgeDays = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    // Find old builds
    const oldBuilds = await db.select()
      .from(agentBuilds)
      .where(eq(agentBuilds.status, 'completed'));

    let cleanedCount = 0;

    for (const build of oldBuilds) {
      if (build.createdAt < cutoffDate && build.binaryPath) {
        try {
          // Remove build directory
          const buildDir = path.dirname(build.binaryPath);
          await fs.rm(buildDir, { recursive: true, force: true });
          cleanedCount++;
        } catch (error) {
          console.warn(`[AgentBuildService] Failed to clean up build ${build.id}:`, error);
        }
      }
    }

    console.log(`[AgentBuildService] Cleaned up ${cleanedCount} old builds`);
    return cleanedCount;
  }

  /**
   * Calculate SHA256 hash of a file
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Check if Docker image is available
   */
  async checkDockerImage(): Promise<boolean> {
    return new Promise((resolve) => {
      const docker = spawn('docker', ['image', 'inspect', this.dockerImage]);
      docker.on('close', (code) => {
        resolve(code === 0);
      });
      docker.on('error', () => {
        resolve(false);
      });
    });
  }
}

// Singleton export
export const agentBuildService = new AgentBuildService();
