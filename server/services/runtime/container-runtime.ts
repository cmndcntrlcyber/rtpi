/**
 * ContainerRuntime (v2.9.1 Phase 5, seam S2)
 *
 * Wraps `dockerExecutor` with health-aware preflight checks and structured
 * errors. Replaces the brittle pattern of calling `dockerExecutor.exec()`
 * directly from many call sites: instead, the orchestrator calls
 * `containerRuntime.exec()`, which:
 *
 *   1. Inspects the container (must exist + must be running)
 *   2. Runs the actual exec via the existing dockerExecutor
 *   3. On any failure, classifies via `error-classifier.ts` so the caller
 *      gets a `ContainerError` with `{code, retryable, remediation}`.
 *
 * The preflight cache keeps the overhead under ~10ms when called repeatedly
 * for the same container within a few seconds.
 */

import Docker from "dockerode";
import {
  dockerExecutor,
  type ExecutionResult,
  type ExecutionOptions,
  type ContainerStatus,
} from "../docker-executor";
import {
  ContainerError,
  classifyContainerError,
  throwClassified,
} from "./error-classifier";

const docker = new Docker();

/** TTL of the per-container readiness cache. Tunable via env. */
const READINESS_CACHE_MS = Number(process.env.CONTAINER_READINESS_CACHE_MS) || 2_000;

interface CacheEntry {
  ready: boolean;
  reason?: string;
  at: number;
}

const readinessCache = new Map<string, CacheEntry>();

class ContainerRuntime {
  /**
   * Verify the container exists and is running. Throws ContainerError on
   * failure; otherwise returns. Cheap-when-cached (≤10ms) so safe to call
   * before every exec.
   */
  async assertReady(containerName: string): Promise<void> {
    const cached = readinessCache.get(containerName);
    const now = Date.now();
    if (cached && now - cached.at < READINESS_CACHE_MS) {
      if (!cached.ready) {
        throw new ContainerError({
          code: "not_running",
          retryable: true,
          remediation: cached.reason || "Container was not running on last check.",
          message: cached.reason || `${containerName} is not running`,
        });
      }
      return;
    }

    try {
      const container = docker.getContainer(containerName);
      const info = await container.inspect();
      if (!info.State?.Running) {
        const reason = `Container ${containerName} state is ${info.State?.Status || "unknown"}.`;
        readinessCache.set(containerName, { ready: false, reason, at: now });
        throw new ContainerError({
          code: "not_running",
          retryable: true,
          remediation:
            "Container exists but is stopped. Start it with `docker compose start " +
            (containerName.startsWith("rtpi-") ? containerName.replace("rtpi-", "") : containerName) +
            "`.",
          message: reason,
        });
      }
      readinessCache.set(containerName, { ready: true, at: now });
    } catch (err) {
      if (err instanceof ContainerError) throw err;
      throwClassified(err, { containerName, phase: "inspect" });
    }
  }

  /**
   * Inspect a container without throwing. Useful for the health-checks API
   * which needs to enumerate state across many containers.
   */
  async inspectSafe(containerName: string): Promise<ContainerStatus | null> {
    try {
      return await dockerExecutor.getContainerStatus(containerName);
    } catch {
      return null;
    }
  }

  /**
   * Execute a command in a container. Calls assertReady first, then delegates
   * to dockerExecutor; classifies any failure into ContainerError.
   */
  async exec(
    containerName: string,
    cmd: string[],
    options: ExecutionOptions = {},
  ): Promise<ExecutionResult> {
    await this.assertReady(containerName);
    try {
      return await dockerExecutor.exec(containerName, cmd, options);
    } catch (err) {
      // Bust the readiness cache so the next attempt re-inspects.
      readinessCache.delete(containerName);
      throw new ContainerError(
        classifyContainerError(err, { containerName, cmd, phase: "exec" }),
      );
    }
  }

  /** Force-invalidate the readiness cache for a container. */
  invalidate(containerName: string): void {
    readinessCache.delete(containerName);
  }

  /** Drop the entire cache. Used by tests + container-event listeners. */
  invalidateAll(): void {
    readinessCache.clear();
  }
}

export const containerRuntime = new ContainerRuntime();
export { ContainerError } from "./error-classifier";
