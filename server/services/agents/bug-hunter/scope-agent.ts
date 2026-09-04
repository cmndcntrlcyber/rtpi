/**
 * ScopeAgent (FF_BUG_HUNTER) — phase 1.
 *
 * Parses the operation's `scope` text into structured rules
 * (in/out-of-scope domains, accepted-impact list, mode). Writes the result
 * back to operations.metadata.scopeRules so the ValidateAgent's Q3 gate
 * has a deterministic surface to check against.
 *
 * Inference: routeReasoning (Settings → DEFAULT_REASONING_MODEL → qwen3:14b).
 * No model strings are hardcoded here; the router walks the chain.
 */

import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { operations } from "@shared/schema";
import { BaseTaskAgent, type TaskDefinition, type TaskResult } from "../base-task-agent";
import { routeReasoning, NoInferenceProviderAvailable } from "../../inference/inference-router";
import { loadEngagementMeta } from "../../bug-hunter/engagement-scaffolder";
import { createLogger } from '../../../lib/logger';
const log = createLogger("scope-agent");

interface ScopeRules {
  inScopeDomains: string[];
  inScopeUrlPatterns: string[];
  outOfScopeDomains: string[];
  outOfScopeUrlPatterns: string[];
  acceptedImpacts: string[];
  notes: string;
}

const EMPTY_RULES: ScopeRules = {
  inScopeDomains: [],
  inScopeUrlPatterns: [],
  outOfScopeDomains: [],
  outOfScopeUrlPatterns: [],
  acceptedImpacts: [],
  notes: "",
};

export class ScopeAgent extends BaseTaskAgent {
  constructor() {
    super("Bug Hunter — Scope", "bug_hunter_scope", [
      "scope_parsing",
      "program_metadata",
      "mode_dispatch",
    ]);
  }

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    if (task.taskType !== "bug_hunter_scope") {
      return { success: false, error: `Unsupported task type: ${task.taskType}` };
    }
    if (!task.operationId) {
      return { success: false, error: "operationId required" };
    }
    await this.updateStatus("running");
    try {
      const [op] = await db.select().from(operations).where(eq(operations.id, task.operationId)).limit(1);
      if (!op) return { success: false, error: `operation ${task.operationId} not found` };

      const rules = await this.parseScope(op.scope ?? "");
      const meta = await loadEngagementMeta(task.operationId);
      const mode = (task.parameters?.mode as "redteam" | "wapt") ?? meta?.mode ?? "wapt";

      const updatedMeta = {
        ...((op.metadata as Record<string, unknown>) ?? {}),
        bugHunter: true,
        mode,
        scopeRules: rules,
        acceptedImpacts: rules.acceptedImpacts,
      };

      await db
        .update(operations)
        .set({ metadata: updatedMeta, updatedAt: new Date() })
        .where(eq(operations.id, task.operationId));

      const result: TaskResult = {
        success: true,
        data: {
          mode,
          scopeRules: rules,
          totalInScope: rules.inScopeDomains.length + rules.inScopeUrlPatterns.length,
          totalOutOfScope: rules.outOfScopeDomains.length + rules.outOfScopeUrlPatterns.length,
        },
      };

      await this.storeTaskMemory({ task, result, memoryType: "fact" });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    } finally {
      await this.updateStatus("idle");
    }
  }

  private async parseScope(scopeText: string): Promise<ScopeRules> {
    if (!scopeText || scopeText.trim().length === 0) return { ...EMPTY_RULES };

    const prompt = `Parse the following bug-bounty / engagement scope text into structured rules. Output STRICT JSON, no commentary.

Scope text:
\`\`\`
${scopeText.slice(0, 8_000)}
\`\`\`

Schema:
{
  "inScopeDomains": ["example.com", "*.example.com"],
  "inScopeUrlPatterns": ["^/api/v1/", ...],
  "outOfScopeDomains": ["staging.example.com"],
  "outOfScopeUrlPatterns": ["/admin/internal/"],
  "acceptedImpacts": ["RCE", "ATO without interaction", "SSRF with data"],
  "notes": "free-text caveats"
}

If a field is not present, return an empty array (or empty string for notes).`;

    try {
      const result = await routeReasoning({
        messages: [{ role: "user", content: prompt }],
        system: "You extract scope rules from bug-bounty program pages. Never invent domains.",
        maxTokens: 800,
        temperature: 0.0,
      });
      const text = result.response.text;
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return { ...EMPTY_RULES };
      const parsed = JSON.parse(match[0]) as Partial<ScopeRules>;
      return {
        inScopeDomains: parsed.inScopeDomains ?? [],
        inScopeUrlPatterns: parsed.inScopeUrlPatterns ?? [],
        outOfScopeDomains: parsed.outOfScopeDomains ?? [],
        outOfScopeUrlPatterns: parsed.outOfScopeUrlPatterns ?? [],
        acceptedImpacts: parsed.acceptedImpacts ?? [],
        notes: parsed.notes ?? "",
      };
    } catch (err) {
      if (err instanceof NoInferenceProviderAvailable) {
        log.warn("[ScopeAgent] no provider — leaving scope rules empty");
      } else {
        log.warn("[ScopeAgent] parse failed:", err);
      }
      return { ...EMPTY_RULES };
    }
  }
}

export const scopeAgent = new ScopeAgent();
