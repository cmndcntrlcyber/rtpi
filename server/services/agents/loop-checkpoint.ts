import { memoryService } from "../memory-service";
import { createLogger } from "../../lib/logger";
import type { Finding } from "./tool-execution-loop";
import type { JudgmentSnapshot } from "../../../shared/types/judgment-types";

const log = createLogger("loop-checkpoint");

export interface CheckpointState {
  iteration: number;
  findings: Finding[];
  toolsUsed: string[];
  memoryIds: string[];
  judgmentSnapshot?: JudgmentSnapshot;
  savedAt: string;
}

const CHECKPOINT_TAG = "loop_checkpoint";

function checkpointKey(agentId: string, operationId: string): string {
  return `checkpoint::${agentId}::${operationId}`;
}

export class LoopCheckpoint {
  async save(
    agentId: string,
    operationId: string,
    state: Omit<CheckpointState, "savedAt">,
  ): Promise<void> {
    try {
      const context = await memoryService.createContext({
        contextType: "operation",
        contextId: operationId,
        contextName: `Checkpoint ${operationId}`,
      });

      const checkpoint: CheckpointState = {
        ...state,
        savedAt: new Date().toISOString(),
      };

      await memoryService.addMemory({
        contextId: context.id,
        memoryText: `[CHECKPOINT] ${checkpointKey(agentId, operationId)} iter=${state.iteration} findings=${state.findings.length} tools=${state.toolsUsed.join(",")}`,
        memoryType: "event",
        sourceAgentId: agentId,
        tags: [CHECKPOINT_TAG, agentId],
        metadata: checkpoint as unknown as Record<string, unknown>,
      });
    } catch (err) {
      log.warn("Failed to save checkpoint (non-fatal):", err);
    }
  }

  async restore(
    agentId: string,
    operationId: string,
  ): Promise<CheckpointState | null> {
    try {
      const results = await memoryService.searchMemories({
        query: checkpointKey(agentId, operationId),
        contextId: operationId,
        limit: 1,
      });

      if (results.length === 0) return null;

      const meta = results[0].metadata as unknown as CheckpointState;
      if (!meta || typeof meta.iteration !== "number") return null;

      return meta;
    } catch (err) {
      log.warn("Failed to restore checkpoint (non-fatal):", err);
      return null;
    }
  }

  async clear(agentId: string, operationId: string): Promise<void> {
    try {
      const results = await memoryService.searchMemories({
        query: checkpointKey(agentId, operationId),
        contextId: operationId,
        limit: 10,
      });

      for (const r of results) {
        if (r.tags?.includes(CHECKPOINT_TAG)) {
          await memoryService.deleteMemory?.(r.id).catch(() => {});
        }
      }
    } catch (err) {
      log.warn("Failed to clear checkpoint (non-fatal):", err);
    }
  }
}

export const loopCheckpoint = new LoopCheckpoint();
