/**
 * Compose Driver (v2.9.1 Phase 9)
 *
 * Pure adapter that starts and stops named compose containers via dockerode,
 * routed through the Phase 5 ContainerRuntime so failures land in the
 * structured-error taxonomy. This avoids requiring `docker compose` CLI to
 * be installed inside the orchestrator image — we operate on existing
 * containers by name.
 *
 * If a container does not exist (e.g. user has never run `docker compose
 * --profile X up -d`), `start()` raises a `container_not_found` error that
 * the UI can render with the right remediation copy.
 */

import Docker from "dockerode";
import { containerRuntime } from "../runtime/container-runtime";
import {
  ContainerError,
  classifyContainerError,
} from "../runtime/error-classifier";

const docker = new Docker();

export interface ContainerOpResult {
  container: string;
  /** "started" | "running" (already-up) | "stopped" | "absent" | "error" */
  outcome: "started" | "running" | "stopped" | "absent" | "error";
  error?: ContainerError["structured"];
}

class ComposeDriver {
  /** Start a container by name; idempotent (already-running → "running"). */
  async start(name: string): Promise<ContainerOpResult> {
    try {
      const container = docker.getContainer(name);
      const info = await container.inspect();
      if (info.State?.Running) {
        return { container: name, outcome: "running" };
      }
      await container.start();
      // Bust the runtime's readiness cache so future preflight checks see fresh state.
      containerRuntime.invalidate(name);
      return { container: name, outcome: "started" };
    } catch (err) {
      return this.classifyOp(name, err, "start");
    }
  }

  /** Stop a container by name; idempotent (already-stopped → "stopped"). */
  async stop(name: string, timeoutSeconds = 10): Promise<ContainerOpResult> {
    try {
      const container = docker.getContainer(name);
      const info = await container.inspect();
      if (!info.State?.Running) {
        return { container: name, outcome: "stopped" };
      }
      await container.stop({ t: timeoutSeconds });
      containerRuntime.invalidate(name);
      return { container: name, outcome: "stopped" };
    } catch (err) {
      return this.classifyOp(name, err, "stop");
    }
  }

  /** Inspect for state; returns "absent" cleanly when 404. */
  async status(name: string): Promise<{
    container: string;
    state: string;
    running: boolean;
    image?: string;
    health?: string;
  } | null> {
    try {
      const container = docker.getContainer(name);
      const info = await container.inspect();
      return {
        container: name,
        state: info.State?.Status || "unknown",
        running: !!info.State?.Running,
        image: info.Config?.Image,
        health: info.State?.Health?.Status,
      };
    } catch {
      return null;
    }
  }

  private classifyOp(
    name: string,
    err: unknown,
    phase: "start" | "stop",
  ): ContainerOpResult {
    if (err instanceof ContainerError) {
      return {
        container: name,
        outcome: err.structured.code === "container_not_found" ? "absent" : "error",
        error: err.structured,
      };
    }
    const structured = classifyContainerError(err, { containerName: name, phase: phase === "start" ? "exec" : "inspect" });
    return {
      container: name,
      outcome: structured.code === "container_not_found" ? "absent" : "error",
      error: structured,
    };
  }
}

export const composeDriver = new ComposeDriver();
