import { randomUUID } from "crypto";
import { createLogger } from "../../lib/logger";
import { JudgmentSnapshot } from "../../../shared/types/judgment-types";

const logger = createLogger("steering");

export type SteeringAction =
  | "inject_constraint"
  | "remove_constraint"
  | "boost_hypothesis"
  | "suppress_hypothesis"
  | "force_tool"
  | "set_confidence"
  | "add_note";

export interface SteeringDirective {
  id: string;
  action: SteeringAction;
  target?: string;
  value?: string | number | boolean;
  reason: string;
  operatorId: string;
  timestamp: string;
  applied: boolean;
}

export interface SteeringState {
  directives: SteeringDirective[];
  forcedTool: string | null;
  injectedConstraints: string[];
  confidenceOverride: number | null;
  notes: string[];
}

export class SteeringController {
  private state: SteeringState = {
    directives: [],
    forcedTool: null,
    injectedConstraints: [],
    confidenceOverride: null,
    notes: [],
  };

  private history: SteeringDirective[] = [];
  private boostedHypotheses: Set<string> = new Set();
  private suppressedHypotheses: Set<string> = new Set();

  applyDirective(
    directive: Omit<SteeringDirective, "id" | "timestamp" | "applied">
  ): SteeringDirective {
    const full: SteeringDirective = {
      ...directive,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      applied: true,
    };

    switch (full.action) {
      case "inject_constraint":
        this.state.injectedConstraints.push(full.value as string);
        break;
      case "remove_constraint":
        this.state.injectedConstraints = this.state.injectedConstraints.filter(
          (c) => c !== (full.value as string)
        );
        break;
      case "boost_hypothesis":
        if (full.target) this.boostedHypotheses.add(full.target);
        break;
      case "suppress_hypothesis":
        if (full.target) this.suppressedHypotheses.add(full.target);
        break;
      case "force_tool":
        this.state.forcedTool = full.value as string;
        break;
      case "set_confidence":
        this.state.confidenceOverride = full.value as number;
        break;
      case "add_note":
        this.state.notes.push(full.value as string);
        break;
    }

    this.state.directives.push(full);
    this.history.push(full);
    return full;
  }

  getState(): SteeringState {
    return this.state;
  }

  getForcedTool(): string | null {
    const tool = this.state.forcedTool;
    this.state.forcedTool = null;
    return tool;
  }

  getInjectedConstraints(): string[] {
    return this.state.injectedConstraints;
  }

  getConfidenceOverride(): number | null {
    return this.state.confidenceOverride;
  }

  getHistory(): SteeringDirective[] {
    return this.history;
  }

  formatForPrompt(): string {
    const sections: string[] = [];

    if (this.state.injectedConstraints.length > 0) {
      const items = this.state.injectedConstraints
        .map((c) => `- ${c}`)
        .join("\n");
      sections.push(`### Constraints\n${items}`);
    }

    if (this.state.notes.length > 0) {
      const items = this.state.notes.map((n) => `- ${n}`).join("\n");
      sections.push(`### Notes\n${items}`);
    }

    if (this.state.forcedTool) {
      sections.push(
        `### Forced Next Tool: ${this.state.forcedTool} (one-shot)`
      );
    }

    if (sections.length === 0) return "";

    return `## Operator Steering (Active)\n\n${sections.join("\n\n")}`;
  }

  reset(): void {
    this.state = {
      directives: [],
      forcedTool: null,
      injectedConstraints: [],
      confidenceOverride: null,
      notes: [],
    };
    this.boostedHypotheses.clear();
    this.suppressedHypotheses.clear();
  }
}

export const steeringController = new SteeringController();
