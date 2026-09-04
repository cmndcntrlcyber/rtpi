import { MemoryAdapter, MemoryScope, MemoryHit } from "../memory-router";
import { createLogger } from "../../../lib/logger";

const log = createLogger("kb-memory-adapter");

export class KnowledgeBaseAdapter implements MemoryAdapter {
  name = "kb";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async query(
    text: string,
    scope: MemoryScope,
    limit: number,
  ): Promise<MemoryHit[]> {
    try {
      const { searchKnowledge } = await import(
        "../../knowledge/knowledge-base-reader"
      );

      const results = await searchKnowledge({
        query: text,
        category: scope.category,
        topK: limit,
      });

      return results.map((r: any) => ({
        id: r.id,
        text: r.content,
        score: r.similarity || 0.5,
        source: "kb" as const,
        metadata: { category: r.category, title: r.title },
      }));
    } catch (err) {
      log.error({ err }, "knowledge base query failed");
      return [];
    }
  }
}

export const kbAdapter = new KnowledgeBaseAdapter();
