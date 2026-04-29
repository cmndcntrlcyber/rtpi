/**
 * Framework Binding Service (v2.9.1 Phase 4, seam S4)
 *
 * Bridges framework elements (OWASP LLM controls, NIST AI subcategories,
 * CIS safeguards, ATLAS/ATT&CK techniques) to executable assets (tools,
 * agents, workflows) via the framework_bindings table.
 *
 * Distinct from frameworkMappings (framework↔framework). Bindings answer
 * "which tools cover OWASP LLM01?" and the reverse "which controls does
 * tool X cover?" — the questions Phase 4 acceptance hangs on.
 */

import { db } from "../../db";
import {
  frameworkBindings,
  agents,
  toolRegistry,
} from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";

export type FrameworkType = "owasp_llm" | "nist_ai" | "cis_v8" | "atlas" | "attck";
export type BindingKind = "tool" | "agent" | "workflow";
export type BindingStrength = "primary" | "supports" | "validates";

export interface CreateBindingInput {
  frameworkType: FrameworkType;
  frameworkElementExternalId: string;
  bindingKind: BindingKind;
  targetId: string;
  strength?: BindingStrength;
  confidence?: number;
  rationale?: string;
  createdBy?: string | null;
}

export interface ExpandedBinding {
  id: string;
  frameworkType: FrameworkType;
  frameworkElementExternalId: string;
  bindingKind: BindingKind;
  targetId: string;
  strength: BindingStrength;
  confidence: number | null;
  rationale: string | null;
  createdBy: string | null;
  createdAt: Date;
  /** Display name resolved from the target table; null if target was deleted. */
  targetName: string | null;
}

export interface FrameworkRef {
  frameworkType: FrameworkType;
  frameworkElementExternalId: string;
  bindingKind: BindingKind;
  strength: BindingStrength;
  bindingId: string;
}

class FrameworkBindingService {
  /** Insert a binding. Unique index enforces idempotency at the DB level. */
  async create(input: CreateBindingInput): Promise<ExpandedBinding> {
    const inserted = await db
      .insert(frameworkBindings)
      .values({
        frameworkType: input.frameworkType,
        frameworkElementExternalId: input.frameworkElementExternalId,
        bindingKind: input.bindingKind,
        targetId: input.targetId,
        strength: input.strength ?? "supports",
        confidence: input.confidence ?? 1.0,
        rationale: input.rationale,
        createdBy: input.createdBy ?? null,
      })
      .returning();

    return this.expandTargets(inserted).then((rows) => rows[0]);
  }

  /** Delete by binding row id. Returns true if a row was removed. */
  async deleteById(id: string): Promise<boolean> {
    const result = await db
      .delete(frameworkBindings)
      .where(eq(frameworkBindings.id, id))
      .returning({ id: frameworkBindings.id });
    return result.length > 0;
  }

  /** All bindings for a framework element (e.g. OWASP LLM01). */
  async listForElement(
    frameworkType: FrameworkType,
    externalId: string,
  ): Promise<ExpandedBinding[]> {
    const rows = await db
      .select()
      .from(frameworkBindings)
      .where(
        and(
          eq(frameworkBindings.frameworkType, frameworkType),
          eq(frameworkBindings.frameworkElementExternalId, externalId),
        ),
      );
    return this.expandTargets(rows);
  }

  /** Reverse lookup: every framework element a tool is bound to. */
  async listForTool(toolId: string): Promise<FrameworkRef[]> {
    const rows = await db
      .select()
      .from(frameworkBindings)
      .where(
        and(
          eq(frameworkBindings.bindingKind, "tool"),
          eq(frameworkBindings.targetId, toolId),
        ),
      );
    return rows.map((r) => ({
      frameworkType: r.frameworkType as FrameworkType,
      frameworkElementExternalId: r.frameworkElementExternalId,
      bindingKind: r.bindingKind as BindingKind,
      strength: r.strength as BindingStrength,
      bindingId: r.id,
    }));
  }

  /** Reverse lookup: every framework element an agent is bound to. */
  async listForAgent(agentId: string): Promise<FrameworkRef[]> {
    const rows = await db
      .select()
      .from(frameworkBindings)
      .where(
        and(
          eq(frameworkBindings.bindingKind, "agent"),
          eq(frameworkBindings.targetId, agentId),
        ),
      );
    return rows.map((r) => ({
      frameworkType: r.frameworkType as FrameworkType,
      frameworkElementExternalId: r.frameworkElementExternalId,
      bindingKind: r.bindingKind as BindingKind,
      strength: r.strength as BindingStrength,
      bindingId: r.id,
    }));
  }

  /**
   * Resolve target display names via one query per kind. Bindings whose
   * target row was deleted return targetName=null (not filtered out so the
   * caller can prompt cleanup).
   */
  private async expandTargets(
    rows: (typeof frameworkBindings.$inferSelect)[],
  ): Promise<ExpandedBinding[]> {
    if (rows.length === 0) return [];

    const toolIds = rows.filter((r) => r.bindingKind === "tool").map((r) => r.targetId);
    const agentIds = rows.filter((r) => r.bindingKind === "agent").map((r) => r.targetId);

    const [tools, agentRows] = await Promise.all([
      toolIds.length
        ? db
            .select({ id: toolRegistry.id, name: toolRegistry.name })
            .from(toolRegistry)
            .where(inArray(toolRegistry.id, toolIds))
        : Promise.resolve([]),
      agentIds.length
        ? db
            .select({ id: agents.id, name: agents.name })
            .from(agents)
            .where(inArray(agents.id, agentIds))
        : Promise.resolve([]),
    ]);

    const toolMap = new Map(tools.map((t) => [t.id, t.name]));
    const agentMap = new Map(agentRows.map((a) => [a.id, a.name]));

    return rows.map((r) => ({
      id: r.id,
      frameworkType: r.frameworkType as FrameworkType,
      frameworkElementExternalId: r.frameworkElementExternalId,
      bindingKind: r.bindingKind as BindingKind,
      targetId: r.targetId,
      strength: r.strength as BindingStrength,
      confidence: r.confidence,
      rationale: r.rationale,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      targetName:
        r.bindingKind === "tool"
          ? toolMap.get(r.targetId) ?? null
          : r.bindingKind === "agent"
            ? agentMap.get(r.targetId) ?? null
            : null,
    }));
  }
}

export const frameworkBindingService = new FrameworkBindingService();
