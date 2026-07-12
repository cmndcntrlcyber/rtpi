import { createLogger } from "../../lib/logger";

const logger = createLogger("loop-safety");

export class DeadLoopDetector {
  private history: Array<{ toolArgsHash: string; findingsCount: number }> = [];
  private consecutiveNoFindings: number = 0;
  private deadLoopThreshold: number;

  constructor() {
    this.deadLoopThreshold = parseInt(process.env.DEAD_LOOP_THRESHOLD || "3", 10);
  }

  recordIteration(tool: string | null, args: string[], findingsCount: number): void {
    const toolArgsHash = `${tool || "none"}::${args.join(",")}`;
    this.history.push({ toolArgsHash, findingsCount });
    if (this.history.length > 10) {
      this.history.shift();
    }
    if (findingsCount === 0) {
      this.consecutiveNoFindings++;
    } else {
      this.consecutiveNoFindings = 0;
    }
  }

  isStalled(): { stalled: boolean; reason: string } {
    const n = this.deadLoopThreshold;

    if (this.history.length >= n) {
      const tail = this.history.slice(-n);
      const first = tail[0].toolArgsHash;
      if (tail.every((entry) => entry.toolArgsHash === first)) {
        return { stalled: true, reason: `Same tool+args repeated ${n} times consecutively` };
      }
    }

    if (this.consecutiveNoFindings >= n) {
      return { stalled: true, reason: `No new findings in last ${n} iterations` };
    }

    return { stalled: false, reason: "" };
  }

  reset(): void {
    this.history = [];
    this.consecutiveNoFindings = 0;
  }
}

export class TokenBudgetTracker {
  private budgetTokens: number;
  private budgetCostUsd: number;
  private tokensUsed: number = 0;
  private costUsed: number = 0;

  constructor(budgetTokens: number = 0, budgetCostUsd: number = 0) {
    this.budgetTokens = budgetTokens;
    this.budgetCostUsd = budgetCostUsd;
  }

  record(tokens: number, estimatedCostUsd: number = 0): void {
    this.tokensUsed += tokens;
    this.costUsed += estimatedCostUsd;
  }

  isExhausted(): { exhausted: boolean; reason: string } {
    if (this.budgetTokens > 0 && this.tokensUsed >= this.budgetTokens) {
      return { exhausted: true, reason: `Token budget exhausted: ${this.tokensUsed}/${this.budgetTokens} tokens used` };
    }
    if (this.budgetCostUsd > 0 && this.costUsed >= this.budgetCostUsd) {
      return { exhausted: true, reason: `Cost budget exhausted: $${this.costUsed.toFixed(4)}/$${this.budgetCostUsd.toFixed(4)} used` };
    }
    return { exhausted: false, reason: "" };
  }

  getSummary(): { tokensUsed: number; costUsed: number; tokensRemaining: number; costRemaining: number } {
    return {
      tokensUsed: this.tokensUsed,
      costUsed: this.costUsed,
      tokensRemaining: this.budgetTokens > 0 ? Math.max(0, this.budgetTokens - this.tokensUsed) : Infinity,
      costRemaining: this.budgetCostUsd > 0 ? Math.max(0, this.budgetCostUsd - this.costUsed) : Infinity,
    };
  }
}
