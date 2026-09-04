import { StageContextFrame, STAGE_FRAMES } from "./stage-context-frames";
import { createLogger } from "../../lib/logger";

const logger = createLogger("context-framer");

export interface FramingContext {
  operationId: string;
  targetId?: string;
  scopeRules?: Record<string, unknown>;
  findings?: Array<{ kind: string; value: string; evidence?: string }>;
  attackSurface?: Record<string, unknown>;
  allData?: Record<string, unknown>;
}

export class ContextFramer {
  buildFrame(stageName: string, context: FramingContext): string {
    const frame = STAGE_FRAMES[stageName];
    if (!frame) {
      logger.warn(`Unknown stage "${stageName}", skipping context frame`);
      return "";
    }

    const successLines = frame.successCriteria.map((c) => `- ${c}`).join("\n");
    const antiLines = frame.antiPatterns.map((p) => `- ${p}`).join("\n");
    const visible = frame.visibleData.join(", ");
    const hidden = frame.hiddenData.join(", ");

    return [
      `## Stage: ${frame.stageName}`,
      "",
      "### Your Role",
      frame.roleDescription,
      "",
      "### Success Criteria",
      successLines,
      "",
      "### Anti-Patterns (DO NOT)",
      antiLines,
      "",
      "### Data Access",
      `You have access to: ${visible}`,
      `You do NOT have access to: ${hidden}`,
    ].join("\n");
  }

  filterData(
    stageName: string,
    availableData: Record<string, unknown>,
  ): Record<string, unknown> {
    const frame = STAGE_FRAMES[stageName];
    if (!frame) {
      logger.warn(`Unknown stage "${stageName}", returning unfiltered data`);
      return availableData;
    }

    const normalize = (key: string) => key.toLowerCase().replace(/_/g, "");

    const hiddenNormalized = new Set(frame.hiddenData.map(normalize));
    const visibleNormalized = new Set(frame.visibleData.map(normalize));

    const filtered: Record<string, unknown> = {};

    for (const key of Object.keys(availableData)) {
      const norm = normalize(key);
      if (hiddenNormalized.has(norm)) {
        continue;
      }
      if (visibleNormalized.has(norm)) {
        filtered[key] = availableData[key];
      }
    }

    return filtered;
  }

  getFrame(stageName: string): StageContextFrame | null {
    return STAGE_FRAMES[stageName] || null;
  }
}

export const contextFramer = new ContextFramer();
