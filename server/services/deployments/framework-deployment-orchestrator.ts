/**
 * Framework Deployment Orchestrator (v2.9.1 Phase 9, seam S5)
 *
 * Owns the deployment state machine: each row in `deployments` represents
 * one user-visible unit (a C2 framework, vLLM, Docmost, etc.) backed by a
 * set of named compose containers. The orchestrator transitions the row's
 * `current_state` toward `desired_state` using the compose driver and
 * writes audit rows to `deployment_events`.
 *
 * Bundles are deployments of kind "bundle" with rows in
 * `deployment_dependencies`. Bringing up a bundle starts each child in
 * declared order; bringing it down stops them in reverse.
 *
 * The manifest at server/config/framework-stacks.json is the source of
 * truth for which named containers belong to each deployment. On boot
 * the orchestrator upserts deployment + dependency rows from the manifest
 * (idempotent) so DB state matches code state.
 */

import { readFile } from "fs/promises";
import path from "path";
import { db } from "../../db";
import {
  deployments,
  deploymentEvents,
  deploymentDependencies,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { composeDriver, type ContainerOpResult } from "./compose-driver";

type DeploymentKind =
  | "c2_empire"
  | "c2_sliver"
  | "c2_c3"
  | "c2_adaptix"
  | "c2_loki"
  | "kasm"
  | "sysreptor"
  | "docmost"
  | "vllm"
  | "chromium"
  | "bundle"
  | "custom";

type DeploymentState =
  | "down"
  | "starting"
  | "up"
  | "degraded"
  | "stopping"
  | "error"
  | "unknown";

interface ManifestDeployment {
  name: string;
  kind: DeploymentKind;
  displayName: string;
  description: string;
  composeProfile?: string;
  containers: string[];
}

interface ManifestBundle {
  name: string;
  displayName: string;
  description: string;
  members: string[];
}

interface FrameworkStacksManifest {
  deployments: ManifestDeployment[];
  bundles: ManifestBundle[];
}

export interface DeploymentSummary {
  id: string;
  name: string;
  kind: DeploymentKind;
  displayName: string;
  description: string;
  composeProfile: string | null;
  containers: string[];
  desiredState: DeploymentState;
  currentState: DeploymentState;
  lastTransitionAt: Date | null;
  bundle: { members: string[] } | null;
}

export interface DeploymentTransitionResult {
  name: string;
  ok: boolean;
  newState: DeploymentState;
  containers: ContainerOpResult[];
  error?: string;
}

const MANIFEST_PATH = path.resolve(process.cwd(), "server/config/framework-stacks.json");

class FrameworkDeploymentOrchestrator {
  private manifest: FrameworkStacksManifest | null = null;
  private bootstrapped = false;

  async loadManifest(): Promise<FrameworkStacksManifest> {
    if (this.manifest) return this.manifest;
    const raw = await readFile(MANIFEST_PATH, "utf8");
    this.manifest = JSON.parse(raw) as FrameworkStacksManifest;
    return this.manifest;
  }

  /** Reload manifest from disk; clears cache. */
  invalidateManifest(): void {
    this.manifest = null;
  }

  /** Idempotent. Upsert deployment + dependency rows from the manifest. */
  async bootstrap(): Promise<void> {
    if (this.bootstrapped) return;
    const manifest = await this.loadManifest();
    const nameToId = new Map<string, string>();

    for (const d of manifest.deployments) {
      const id = await this.ensureDeployment({
        name: d.name,
        kind: d.kind,
        composeProfile: d.composeProfile,
        params: { displayName: d.displayName, description: d.description, containers: d.containers },
      });
      nameToId.set(d.name, id);
    }

    for (const b of manifest.bundles) {
      const bundleId = await this.ensureDeployment({
        name: b.name,
        kind: "bundle",
        composeProfile: null,
        params: { displayName: b.displayName, description: b.description, members: b.members },
      });
      nameToId.set(b.name, bundleId);

      // Reset bundle dependencies to match manifest (manifest is source of truth).
      await db.delete(deploymentDependencies).where(eq(deploymentDependencies.parentId, bundleId));
      let ordinal = 0;
      for (const member of b.members) {
        const childId = nameToId.get(member);
        if (!childId) continue;
        await db.insert(deploymentDependencies).values({
          parentId: bundleId,
          childId,
          ordinal: ordinal++,
        });
      }
    }

    this.bootstrapped = true;
  }

  private async ensureDeployment(input: {
    name: string;
    kind: DeploymentKind;
    composeProfile: string | null | undefined;
    params: Record<string, unknown>;
  }): Promise<string> {
    const existing = await db
      .select({ id: deployments.id })
      .from(deployments)
      .where(eq(deployments.name, input.name))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(deployments)
        .set({
          kind: input.kind,
          composeProfile: input.composeProfile ?? null,
          params: input.params as any,
          updatedAt: new Date(),
        })
        .where(eq(deployments.id, existing[0].id));
      return existing[0].id;
    }
    const inserted = await db
      .insert(deployments)
      .values({
        name: input.name,
        kind: input.kind,
        composeProfile: input.composeProfile ?? null,
        params: input.params as any,
        desiredState: "down",
        currentState: "unknown",
      })
      .returning({ id: deployments.id });
    return inserted[0].id;
  }

  // -----------------------------------------------------------------------

  async list(): Promise<DeploymentSummary[]> {
    await this.bootstrap();
    const rows = await db.select().from(deployments).orderBy(deployments.name);
    const out: DeploymentSummary[] = [];
    for (const row of rows) {
      const params = (row.params as any) || {};
      out.push({
        id: row.id,
        name: row.name,
        kind: row.kind as DeploymentKind,
        displayName: params.displayName ?? row.name,
        description: params.description ?? "",
        composeProfile: row.composeProfile,
        containers: Array.isArray(params.containers) ? params.containers : [],
        desiredState: row.desiredState as DeploymentState,
        currentState: row.currentState as DeploymentState,
        lastTransitionAt: row.lastTransitionAt,
        bundle:
          row.kind === "bundle" && Array.isArray(params.members)
            ? { members: params.members as string[] }
            : null,
      });
    }
    return out;
  }

  /** Bring a deployment up. Bundle deployments cascade to children in order. */
  async up(name: string, userId: string | null = null): Promise<DeploymentTransitionResult> {
    await this.bootstrap();
    const dep = await this.byName(name);
    if (!dep) {
      return { name, ok: false, newState: "unknown", containers: [], error: "Deployment not found" };
    }

    // Plan
    await db.update(deployments).set({ desiredState: "up", updatedAt: new Date() }).where(eq(deployments.id, dep.id));
    await db.insert(deploymentEvents).values({
      deploymentId: dep.id,
      eventType: "plan",
      payload: { desired: "up", userId },
    });

    if (dep.kind === "bundle") {
      return this.upBundle(dep.id, name, userId);
    }

    return this.upUnit(dep.id, name, dep.params, userId);
  }

  async down(name: string, userId: string | null = null): Promise<DeploymentTransitionResult> {
    await this.bootstrap();
    const dep = await this.byName(name);
    if (!dep) {
      return { name, ok: false, newState: "unknown", containers: [], error: "Deployment not found" };
    }
    await db.update(deployments).set({ desiredState: "down", updatedAt: new Date() }).where(eq(deployments.id, dep.id));
    await db.insert(deploymentEvents).values({
      deploymentId: dep.id,
      eventType: "plan",
      payload: { desired: "down", userId },
    });

    if (dep.kind === "bundle") {
      return this.downBundle(dep.id, name, userId);
    }
    return this.downUnit(dep.id, name, dep.params, userId);
  }

  async health(name: string): Promise<{
    name: string;
    currentState: DeploymentState;
    containers: { container: string; running: boolean; state: string }[];
  }> {
    await this.bootstrap();
    const dep = await this.byName(name);
    if (!dep) {
      return { name, currentState: "unknown", containers: [] };
    }
    const containerNames: string[] = Array.isArray(dep.params?.containers) ? dep.params.containers : [];
    const probes = await Promise.all(
      containerNames.map(async (c) => {
        const status = await composeDriver.status(c);
        return {
          container: c,
          running: !!status?.running,
          state: status?.state ?? "absent",
        };
      }),
    );
    const runningCount = probes.filter((p) => p.running).length;
    let currentState: DeploymentState = "down";
    if (containerNames.length === 0) currentState = "unknown";
    else if (runningCount === containerNames.length) currentState = "up";
    else if (runningCount === 0) currentState = "down";
    else currentState = "degraded";

    await db
      .update(deployments)
      .set({
        currentState,
        healthSummary: { containers: probes } as any,
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, dep.id));

    return { name, currentState, containers: probes };
  }

  async listEvents(name: string, limit = 50): Promise<typeof deploymentEvents.$inferSelect[]> {
    const dep = await this.byName(name);
    if (!dep) return [];
    return db
      .select()
      .from(deploymentEvents)
      .where(eq(deploymentEvents.deploymentId, dep.id))
      .orderBy(sql`${deploymentEvents.at} DESC`)
      .limit(limit);
  }

  // ---- internal -----------------------------------------------------------

  private async byName(
    name: string,
  ): Promise<(typeof deployments.$inferSelect & { params: any }) | null> {
    const [row] = await db.select().from(deployments).where(eq(deployments.name, name)).limit(1);
    if (!row) return null;
    return { ...row, params: (row.params as any) || {} };
  }

  private async upUnit(
    id: string,
    name: string,
    params: any,
    userId: string | null,
  ): Promise<DeploymentTransitionResult> {
    const containers: string[] = Array.isArray(params.containers) ? params.containers : [];
    if (containers.length === 0) {
      return { name, ok: false, newState: "error", containers: [], error: "No containers in manifest" };
    }

    await this.transition(id, "starting");
    const results: ContainerOpResult[] = [];
    for (const c of containers) {
      results.push(await composeDriver.start(c));
    }

    const allOk = results.every((r) => r.outcome === "started" || r.outcome === "running");
    const someUp = results.some((r) => r.outcome === "started" || r.outcome === "running");
    const newState: DeploymentState = allOk ? "up" : someUp ? "degraded" : "error";
    await this.transition(id, newState);
    await db.insert(deploymentEvents).values({
      deploymentId: id,
      eventType: allOk ? "up" : "error",
      payload: { containers: results, userId } as any,
    });

    return {
      name,
      ok: allOk,
      newState,
      containers: results,
      error: allOk ? undefined : results.find((r) => r.error)?.error?.message,
    };
  }

  private async downUnit(
    id: string,
    name: string,
    params: any,
    userId: string | null,
  ): Promise<DeploymentTransitionResult> {
    const containers: string[] = Array.isArray(params.containers) ? params.containers : [];
    await this.transition(id, "stopping");
    const results: ContainerOpResult[] = [];
    // Stop in reverse order so dependencies inside a stack come down last.
    for (const c of [...containers].reverse()) {
      results.push(await composeDriver.stop(c));
    }
    const allDown = results.every((r) => r.outcome === "stopped");
    const newState: DeploymentState = allDown ? "down" : "error";
    await this.transition(id, newState);
    await db.insert(deploymentEvents).values({
      deploymentId: id,
      eventType: allDown ? "down" : "error",
      payload: { containers: results, userId } as any,
    });
    return {
      name,
      ok: allDown,
      newState,
      containers: results,
      error: allDown ? undefined : results.find((r) => r.error)?.error?.message,
    };
  }

  private async upBundle(
    id: string,
    name: string,
    userId: string | null,
  ): Promise<DeploymentTransitionResult> {
    const children = await this.bundleChildren(id);
    await this.transition(id, "starting");
    const all: ContainerOpResult[] = [];
    let allOk = true;
    for (const child of children) {
      const result = await this.upUnit(child.id, child.name, child.params, userId);
      all.push(...result.containers);
      if (!result.ok) allOk = false;
    }
    const newState: DeploymentState = allOk ? "up" : "degraded";
    await this.transition(id, newState);
    await db.insert(deploymentEvents).values({
      deploymentId: id,
      eventType: allOk ? "up" : "error",
      payload: { bundle: name, members: children.map((c) => c.name), userId } as any,
    });
    return { name, ok: allOk, newState, containers: all };
  }

  private async downBundle(
    id: string,
    name: string,
    userId: string | null,
  ): Promise<DeploymentTransitionResult> {
    const children = await this.bundleChildren(id);
    await this.transition(id, "stopping");
    const all: ContainerOpResult[] = [];
    let allDown = true;
    // Reverse order on teardown.
    for (const child of [...children].reverse()) {
      const result = await this.downUnit(child.id, child.name, child.params, userId);
      all.push(...result.containers);
      if (!result.ok) allDown = false;
    }
    const newState: DeploymentState = allDown ? "down" : "error";
    await this.transition(id, newState);
    await db.insert(deploymentEvents).values({
      deploymentId: id,
      eventType: allDown ? "down" : "error",
      payload: { bundle: name, members: children.map((c) => c.name), userId } as any,
    });
    return { name, ok: allDown, newState, containers: all };
  }

  private async bundleChildren(bundleId: string): Promise<
    { id: string; name: string; params: any }[]
  > {
    const rows = await db
      .select({
        id: deployments.id,
        name: deployments.name,
        params: deployments.params,
        ordinal: deploymentDependencies.ordinal,
      })
      .from(deploymentDependencies)
      .innerJoin(deployments, eq(deployments.id, deploymentDependencies.childId))
      .where(eq(deploymentDependencies.parentId, bundleId))
      .orderBy(deploymentDependencies.ordinal);
    return rows.map((r) => ({ id: r.id, name: r.name, params: r.params || {} }));
  }

  private async transition(id: string, state: DeploymentState): Promise<void> {
    await db
      .update(deployments)
      .set({ currentState: state, lastTransitionAt: new Date(), updatedAt: new Date() })
      .where(eq(deployments.id, id));
  }
}

export const frameworkDeploymentOrchestrator = new FrameworkDeploymentOrchestrator();
