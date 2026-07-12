import { MemoryAdapter, MemoryScope, MemoryHit } from "../memory-router";
import { memoryService } from "../../memory-service";
import { createLogger } from "../../../lib/logger";

const log = createLogger("native-memory-adapter");

export class NativeMemoryAdapter implements MemoryAdapter {
  name = "native";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async query(
    text: string,
    scope: MemoryScope,
    limit: number,
  ): Promise<MemoryHit[]> {
    try {
      const contextId = scope.operationId || scope.agentId;

      const results = await memoryService.searchMemories({
        query: text,
        contextId: contextId || undefined,
        limit,
      });

      return results.map((entry) => ({
        id: entry.id,
        text: entry.memoryText,
        score: entry.score || 0.5,
        source: "native" as const,
        metadata: (entry.metadata as Record<string, unknown>) || undefined,
      }));
    } catch (err) {
      log.error({ err }, "native memory query failed");
      return [];
    }
  }
}

export const nativeMemoryAdapter = new NativeMemoryAdapter();
