import { db } from "../../db";
import { DecisionRecord } from "../../../shared/types/judgment-types";
import { createLogger } from "../../lib/logger";
import { sql } from "drizzle-orm";

const logger = createLogger("reasoning-trace");

export interface TraceRecordParams {
  workflowId?: string;
  operationId: string;
  agentId: string;
  agentName: string;
  decision: DecisionRecord;
  findingsThisIteration: number;
}

export class ReasoningTraceRecorder {
  private buffer: TraceRecordParams[] = [];
  private FLUSH_THRESHOLD = 5;

  record(params: TraceRecordParams): void {
    this.buffer.push(params);
    if (this.buffer.length >= this.FLUSH_THRESHOLD) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const records = [...this.buffer];
    this.buffer = [];

    try {
      for (const rec of records) {
        await db.execute(sql`
          INSERT INTO reasoning_traces (
            workflow_id,
            operation_id,
            agent_id,
            agent_name,
            iteration,
            action,
            tool,
            confidence,
            outcome,
            duration_ms,
            findings_this_iteration,
            created_at
          ) VALUES (
            ${rec.workflowId || null},
            ${rec.operationId},
            ${rec.agentId},
            ${rec.agentName},
            ${rec.decision.iteration},
            ${rec.decision.action},
            ${rec.decision.tool || null},
            ${rec.decision.confidence},
            ${rec.decision.outcome || null},
            ${rec.decision.durationMs || null},
            ${rec.findingsThisIteration},
            NOW()
          )
        `);
      }
    } catch (err) {
      logger.warn("Failed to flush reasoning traces, re-buffering", { error: err, count: records.length });
      this.buffer = [...records, ...this.buffer];
    }
  }

  getBufferSize(): number {
    return this.buffer.length;
  }
}

export const reasoningTraceRecorder = new ReasoningTraceRecorder();
