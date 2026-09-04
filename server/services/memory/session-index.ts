import { db } from "../../db";
import { routeReasoning, NoInferenceProviderAvailable } from "../inference/inference-router";
import { createLogger } from "../../lib/logger";
import { sql } from "drizzle-orm";
import type { LoopResult } from "../agents/tool-execution-loop";

const logger = createLogger("session-index");

export interface SessionSummary {
  id: string;
  agentType: string;
  targetType: string | null;
  summary: string;
  toolsUsed: string[];
  findingsCount: number;
  outcome: string;
  lessonsLearned: string[];
  createdAt: string;
}

export class SessionIndexer {
  async summarizeAndIndex(params: {
    conversationId?: string;
    operationId: string;
    agentType: string;
    loopResult: LoopResult;
    objective: string;
  }): Promise<void> {
    try {
      const { operationId, agentType, loopResult, objective } = params;
      const findingsCount = loopResult.iterations.flatMap((i: any) => i.findings || []).length;

      let summary: string;
      try {
        const prompt = `Summarize this agent session in 2-3 sentences. Focus on: what was attempted, what worked, what failed, and one transferable lesson.

Agent: ${agentType}
Objective: ${objective}
Tools used: ${loopResult.toolsUsed.join(", ")}
Iterations: ${loopResult.iterations.length}
Status: ${loopResult.status}
Findings: ${findingsCount}`;

        const result = await routeReasoning({
          messages: [{ role: "user", content: prompt }],
          maxTokens: 256,
          temperature: 0.3,
        });

        summary = result.response.text.trim();
      } catch (err) {
        if (err instanceof NoInferenceProviderAvailable) {
          summary = `${agentType} agent ran ${loopResult.iterations.length} iterations against objective "${objective}" using ${loopResult.toolsUsed.join(", ")}. Status: ${loopResult.status}. Findings: ${findingsCount}.`;
        } else {
          throw err;
        }
      }

      const outcome =
        loopResult.status === "completed"
          ? "success"
          : loopResult.status === "max_iterations"
            ? "partial"
            : "failure";

      let targetType: string | null = null;
      if (/web/i.test(objective)) targetType = "web_app";
      else if (/api/i.test(objective)) targetType = "api";
      else if (/network/i.test(objective)) targetType = "network";

      const sentences = summary.split(/\.\s+/);
      const lessonsLearned =
        sentences.length > 1
          ? [sentences[sentences.length - 1].replace(/\.$/, "")]
          : [`Used tool chain: ${loopResult.toolsUsed.join(" -> ")}`];

      const id = crypto.randomUUID();

      await db.execute(sql`
        INSERT INTO session_summaries (
          id,
          operation_id,
          agent_type,
          target_type,
          summary,
          tools_used,
          findings_count,
          outcome,
          lessons_learned,
          search_vector,
          created_at
        ) VALUES (
          ${id},
          ${operationId},
          ${agentType},
          ${targetType},
          ${summary},
          ${loopResult.toolsUsed},
          ${findingsCount},
          ${outcome},
          ${lessonsLearned},
          to_tsvector('english', ${summary + " " + agentType + " " + (targetType || "")}),
          NOW()
        )
      `);
    } catch (err) {
      logger.warn("Failed to index session summary", { error: err });
    }
  }

  async searchSessions(query: string, agentType?: string, limit: number = 5): Promise<SessionSummary[]> {
    try {
      let result: any;
      if (agentType) {
        result = await db.execute(sql`
          SELECT id, agent_type, target_type, summary, tools_used, findings_count, outcome, lessons_learned, created_at
          FROM session_summaries
          WHERE search_vector @@ plainto_tsquery('english', ${query})
            AND agent_type = ${agentType}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `);
      } else {
        result = await db.execute(sql`
          SELECT id, agent_type, target_type, summary, tools_used, findings_count, outcome, lessons_learned, created_at
          FROM session_summaries
          WHERE search_vector @@ plainto_tsquery('english', ${query})
          ORDER BY created_at DESC
          LIMIT ${limit}
        `);
      }

      const rows = Array.isArray(result) ? result : result.rows || [];
      return rows.map((row: any) => ({
        id: row.id,
        agentType: row.agent_type,
        targetType: row.target_type,
        summary: row.summary,
        toolsUsed: row.tools_used || [],
        findingsCount: row.findings_count,
        outcome: row.outcome,
        lessonsLearned: row.lessons_learned || [],
        createdAt: row.created_at,
      }));
    } catch (err) {
      logger.warn("Failed to search sessions", { error: err });
      return [];
    }
  }

  async findSimilarSessions(objective: string, agentType: string): Promise<SessionSummary[]> {
    return this.searchSessions(objective, agentType, 3);
  }
}

export function formatSessionsForPrompt(sessions: SessionSummary[]): string {
  if (sessions.length === 0) return "";

  const parts = sessions.map((session, idx) => {
    return `### Session ${idx + 1} (${session.outcome})
${session.summary}
- Tools: ${session.toolsUsed.join(", ")}
- Findings: ${session.findingsCount}
- Lessons: ${session.lessonsLearned.join("; ")}`;
  });

  return `## Similar Past Sessions\n\n${parts.join("\n\n")}`;
}

export const sessionIndexer = new SessionIndexer();
