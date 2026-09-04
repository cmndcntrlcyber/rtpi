import { PrePromptHook, PrePromptHookContext } from "../agents/tool-execution-loop";
import { routeReasoning } from "../inference/inference-router";
import { memoryService } from "../memory-service";
import { createLogger } from "../../lib/logger";

const logger = createLogger("memory-nudger");

export interface NudgeConfig {
  intervalIterations: number;
  operationId: string;
  agentId?: string;
}

export function createMemoryNudgeHook(config: NudgeConfig): PrePromptHook {
  return async (ctx: PrePromptHookContext): Promise<string | null> => {
    if (ctx.iteration % config.intervalIterations !== 0 || ctx.iteration === 0) {
      return null;
    }

    try {
      const recentFindings = ctx.discoveredFindings.slice(-5);
      const recentIterations = ctx.previousIterations.slice(-config.intervalIterations);

      const nudgePrompt = `You are reviewing your recent work to decide what's worth remembering for future tasks.

Iteration: ${ctx.iteration}
Objective: ${ctx.objective}
Recent findings: ${JSON.stringify(recentFindings)}
Recent iterations: ${JSON.stringify(recentIterations.map((i) => i.reasoning || i.toolUsed))}

What 1-3 facts are worth remembering for future similar tasks?
Respond with JSON: { "store": [{"text": "...", "type": "fact"|"pattern"|"insight"}], "forget": [] }`;

      const result = await routeReasoning({
        messages: [{ role: "user", content: nudgePrompt }],
        maxTokens: 512,
        temperature: 0.3,
        responseFormat: { type: "json_object" },
      });

      const content = result.response.text;

      const parsed = JSON.parse(content);

      if (parsed.store && Array.isArray(parsed.store)) {
        for (const item of parsed.store) {
          await memoryService.addMemory({
            contextId: config.operationId,
            memoryText: item.text,
            memoryType: item.type || "fact",
            tags: ["nudge", ctx.agentName],
            sourceAgentId: config.agentId,
          });
        }
      }

      return null;
    } catch (err) {
      logger.warn("Memory nudge failed", { iteration: ctx.iteration, error: err });
      return null;
    }
  };
}
