import { skillFeedbackCollector } from "./skill-feedback";
import { loadSkillBody } from "./skill-loader";
import { routeReasoning, NoInferenceProviderAvailable } from "../inference/inference-router";
import { createLogger } from "../../lib/logger";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { promises as fs } from "fs";
import { readFeatureFlags } from "../../../shared/feature-flags";

const log = createLogger("skill-improver");

export class SkillImprover {
  private MIN_FEEDBACK = parseInt(process.env.SKILL_IMPROVEMENT_MIN_FEEDBACK || "5");
  private SUCCESS_THRESHOLD = 0.5;

  async checkAndImprove(skillPath: string): Promise<{ improved: boolean; reason: string }> {
    try {
      const perf = await skillFeedbackCollector.getSkillPerformance(skillPath);

      if (perf.usageCount < this.MIN_FEEDBACK) {
        return { improved: false, reason: `Insufficient feedback (${perf.usageCount}/${this.MIN_FEEDBACK})` };
      }

      if (perf.successRate >= this.SUCCESS_THRESHOLD) {
        return { improved: false, reason: `Performance adequate (${(perf.successRate * 100).toFixed(0)}%)` };
      }

      const parts = skillPath.replace(/^skills\/tools\//, "").replace(/\.md$/, "").split("/");
      const registry = parts[0] as "mcp" | "registry" | "security";
      const toolId = parts.slice(1).join("/");

      const currentContent = await loadSkillBody(registry, toolId);
      if (!currentContent) {
        return { improved: false, reason: `Skill file not found: ${skillPath}` };
      }

      const feedbackList = perf.recentFeedback
        .map((f) => `- ${f.outcome}: ${f.feedback || "(no text)"}`)
        .join("\n");

      const prompt = `You are improving a tool skill document based on usage feedback. The current version has a ${(perf.successRate * 100).toFixed(0)}% success rate across ${perf.usageCount} uses.

## Current Skill Content
${currentContent}

## Recent Feedback
${feedbackList}

## Task
Rewrite this skill document to address the failure patterns. Keep the YAML frontmatter intact. Improve: clearer usage examples, better error handling guidance, more specific parameter recommendations. Output the complete improved skill document.`;

      const result = await routeReasoning({
        messages: [{ role: "user", content: prompt }],
        maxTokens: 4096,
        temperature: 0.3,
      });

      const improvedContent = result.response.text;

      if (improvedContent.trim()) {
        const pathMod = await import("path");
        const abs = pathMod.isAbsolute(skillPath)
          ? skillPath
          : pathMod.resolve(process.cwd(), skillPath);
        await fs.writeFile(abs, improvedContent, "utf-8");

        try {
          const { syncAllAgentsForSkillChange } = await import("../agents/tool-skill-prompt-sync");
          await syncAllAgentsForSkillChange({ registry, rowId: toolId, reason: "skill-improver" });
        } catch {}
      }

      return { improved: true, reason: `Improved from ${(perf.successRate * 100).toFixed(0)}% success rate` };
    } catch (err: any) {
      log.error(`Failed to improve skill ${skillPath}: ${err?.message ?? err}`);
      return { improved: false, reason: err?.message ?? String(err) };
    }
  }

  async runImprovementCycle(): Promise<{ improved: string[]; skipped: string[] }> {
    const flags = readFeatureFlags(process.env);
    if (!flags.skillSelfImprovement) {
      return { improved: [], skipped: [] };
    }

    const improved: string[] = [];
    const skipped: string[] = [];

    try {
      const rows = await db.execute(sql`SELECT DISTINCT skill_path FROM skill_usage_log`);
      const paths = (rows as unknown as Array<{ skill_path: string }>).map((r) => r.skill_path);

      for (const skillPath of paths) {
        const result = await this.checkAndImprove(skillPath);
        if (result.improved) {
          improved.push(skillPath);
        } else {
          skipped.push(skillPath);
        }
      }

      log.info(`Improvement cycle complete: ${improved.length} improved, ${skipped.length} skipped`);
    } catch (err: any) {
      log.error(`Improvement cycle failed: ${err?.message ?? err}`);
    }

    return { improved, skipped };
  }
}

export const skillImprover = new SkillImprover();
