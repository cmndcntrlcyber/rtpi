import { db } from "../../db";
import { sql } from "drizzle-orm";
import { createLogger } from "../../lib/logger";

const log = createLogger("skill-feedback");

export interface SkillUsageParams {
  skillPath: string;
  agentId: string;
  operationId?: string;
  outcome: "success" | "partial" | "failure";
  iterationsUsed: number;
  findingsProduced: number;
  feedbackText?: string;
}

export interface SkillPerformance {
  usageCount: number;
  successRate: number;
  avgFindings: number;
  recentFeedback: Array<{ outcome: string; feedback: string | null; createdAt: string }>;
}

export class SkillFeedbackCollector {
  async recordUsage(params: SkillUsageParams): Promise<void> {
    try {
      await db.execute(sql`INSERT INTO skill_usage_log (id, skill_path, agent_id, operation_id, outcome, iterations_used, findings_produced, feedback_text, created_at) VALUES (gen_random_uuid(), ${params.skillPath}, ${params.agentId}, ${params.operationId ?? null}, ${params.outcome}, ${params.iterationsUsed}, ${params.findingsProduced}, ${params.feedbackText ?? null}, NOW())`);
    } catch (err: any) {
      log.warn(`Failed to record skill usage for ${params.skillPath}: ${err?.message ?? err}`);
    }
  }

  async getSkillPerformance(skillPath: string): Promise<SkillPerformance> {
    try {
      const rows = await db.execute(sql`SELECT outcome, findings_produced, feedback_text, created_at FROM skill_usage_log WHERE skill_path = ${skillPath} ORDER BY created_at DESC LIMIT 20`);
      const results = rows as unknown as Array<{ outcome: string; findings_produced: number; feedback_text: string | null; created_at: string }>;
      const usageCount = results.length;
      const successCount = results.filter((r) => r.outcome === "success").length;
      const successRate = usageCount > 0 ? successCount / usageCount : 0;
      const totalFindings = results.reduce((sum, r) => sum + (r.findings_produced ?? 0), 0);
      const avgFindings = usageCount > 0 ? totalFindings / usageCount : 0;
      const recentFeedback = results.slice(0, 5).map((r) => ({
        outcome: r.outcome,
        feedback: r.feedback_text,
        createdAt: String(r.created_at),
      }));
      return { usageCount, successRate, avgFindings, recentFeedback };
    } catch {
      return { usageCount: 0, successRate: 0, avgFindings: 0, recentFeedback: [] };
    }
  }
}

export const skillFeedbackCollector = new SkillFeedbackCollector();
