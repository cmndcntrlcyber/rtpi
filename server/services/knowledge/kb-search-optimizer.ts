import { createLogger } from "../../lib/logger";
import {
  routeReasoning,
  NoInferenceProviderAvailable,
} from "../inference/inference-router";

const logger = createLogger("kb-search-optimizer");

export interface KBSearchOptions {
  category?: string;
  maxTokenBudget?: number;
  rerank?: boolean;
  taskContext?: string;
}

export interface OptimizedResult {
  id: string;
  content: string;
  title?: string;
  category?: string;
  score: number;
  rerankScore?: number;
  truncated: boolean;
}

export class KBSearchOptimizer {
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  async optimizeResults(
    results: Array<{
      id: string;
      content: string;
      title?: string;
      category?: string;
      score?: number;
    }>,
    options: KBSearchOptions
  ): Promise<OptimizedResult[]> {
    let filtered = [...results];

    if (options.category) {
      const cat = options.category.toLowerCase();
      filtered = filtered.filter(
        (r) => r.category && r.category.toLowerCase() === cat
      );
    }

    if (options.rerank && options.taskContext && filtered.length > 3) {
      try {
        const summaries = filtered.map(
          (r, i) =>
            `[${i}] ${r.title || "Untitled"}: ${r.content.slice(0, 100)}`
        );
        const prompt = `Given the task context, rank these ${filtered.length} results by relevance. Return JSON array of indices (0-based) ordered by relevance. Task: ${options.taskContext}. Results: ${summaries.join("; ")}`;

        const result = await routeReasoning({
          messages: [{ role: "user", content: prompt }],
          maxTokens: 256,
        });

        const text = result.response.text;
        const match = text.match(/\[[\d\s,]+\]/);
        if (match) {
          const indices: number[] = JSON.parse(match[0]);
          const reordered = indices
            .filter((i) => i >= 0 && i < filtered.length)
            .map((i) => filtered[i]);
          const seen = new Set(indices);
          for (let i = 0; i < filtered.length; i++) {
            if (!seen.has(i)) reordered.push(filtered[i]);
          }
          filtered = reordered;
        }
      } catch (err) {
        if (!(err instanceof NoInferenceProviderAvailable)) {
          logger.warn("Reranking failed, keeping original order", { err });
        }
      }
    }

    const maxBudget = options.maxTokenBudget ?? 4000;
    const optimized: OptimizedResult[] = [];
    let accumulated = 0;

    for (let i = 0; i < filtered.length; i++) {
      const r = filtered[i];
      const tokens = this.estimateTokens(r.content);
      const rerankScore = 1.0 - i / Math.max(filtered.length, 1);

      if (accumulated + tokens <= maxBudget) {
        optimized.push({
          id: r.id,
          content: r.content,
          title: r.title,
          category: r.category,
          score: r.score ?? 0,
          rerankScore,
          truncated: false,
        });
        accumulated += tokens;
      } else {
        const remaining = maxBudget - accumulated;
        if (remaining > 0) {
          const charLimit = remaining * 4;
          optimized.push({
            id: r.id,
            content: r.content.slice(0, charLimit),
            title: r.title,
            category: r.category,
            score: r.score ?? 0,
            rerankScore,
            truncated: true,
          });
        }
        break;
      }
    }

    return optimized;
  }
}

export const kbSearchOptimizer = new KBSearchOptimizer();
