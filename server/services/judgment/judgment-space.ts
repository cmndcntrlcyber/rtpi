import { randomUUID } from "crypto";
import {
  Hypothesis,
  DecisionRecord,
  JudgmentSnapshot,
} from "../../../shared/types/judgment-types";
import { createLogger } from "../../lib/logger";

const logger = createLogger("judgment-space");

const MAX_DECISIONS = 50;
const MAX_HYPOTHESES = 20;
const AUTO_ARCHIVE_THRESHOLD = 0.1;

export class JudgmentSpace {
  private agentId: string;
  private operationId: string;
  private hypotheses: Map<string, Hypothesis> = new Map();
  private decisions: DecisionRecord[] = [];
  private constraints: string[] = [];
  private reasoningTrace: string[] = [];

  constructor(agentId: string, operationId: string) {
    this.agentId = agentId;
    this.operationId = operationId;
  }

  addHypothesis(statement: string, initialConfidence: number): Hypothesis {
    if (this.hypotheses.size >= MAX_HYPOTHESES) {
      let lowestId: string | null = null;
      let lowestConfidence = Infinity;
      for (const [id, h] of this.hypotheses) {
        if (h.confidence < lowestConfidence) {
          lowestConfidence = h.confidence;
          lowestId = id;
        }
      }
      if (lowestId) {
        this.hypotheses.delete(lowestId);
        logger.info(`Archived lowest-confidence hypothesis ${lowestId}`);
      }
    }

    const hypothesis: Hypothesis = {
      id: randomUUID(),
      statement,
      confidence: Math.max(0, Math.min(1, initialConfidence)),
      supportingEvidence: [],
      contradictingEvidence: [],
      createdAtIteration: this.decisions.length,
    };

    this.hypotheses.set(hypothesis.id, hypothesis);
    return hypothesis;
  }

  updateHypothesis(
    id: string,
    evidence: string,
    direction: "support" | "contradict"
  ): void {
    const hypothesis = this.hypotheses.get(id);
    if (!hypothesis) return;

    if (direction === "support") {
      hypothesis.supportingEvidence.push(evidence);
      hypothesis.confidence = Math.min(1.0, hypothesis.confidence + 0.1);
    } else {
      hypothesis.contradictingEvidence.push(evidence);
      hypothesis.confidence = Math.max(0.0, hypothesis.confidence - 0.15);
    }

    const totalEvidence =
      hypothesis.supportingEvidence.length +
      hypothesis.contradictingEvidence.length;

    if (
      totalEvidence >= 3 &&
      hypothesis.confidence < AUTO_ARCHIVE_THRESHOLD
    ) {
      this.hypotheses.delete(id);
      logger.info(
        `Auto-archived hypothesis ${id} (confidence: ${hypothesis.confidence})`
      );
    }
  }

  recordDecision(record: DecisionRecord): void {
    this.decisions.push(record);
    if (this.decisions.length > MAX_DECISIONS) {
      this.decisions.shift();
    }
    const summary = `Iter ${record.iteration}: ${record.action}${record.tool ? " → " + record.tool : ""} [confidence: ${record.confidence}${record.outcome ? ", outcome: " + record.outcome : ""}]`;
    this.reasoningTrace.push(summary);
  }

  addConstraint(constraint: string): void {
    if (!this.constraints.includes(constraint)) {
      this.constraints.push(constraint);
    }
  }

  removeConstraint(constraint: string): void {
    const index = this.constraints.indexOf(constraint);
    if (index !== -1) {
      this.constraints.splice(index, 1);
    }
  }

  getSnapshot(): JudgmentSnapshot {
    return {
      agentId: this.agentId,
      operationId: this.operationId,
      activeHypotheses: Array.from(this.hypotheses.values()),
      confidenceVector: this.buildConfidenceVector(),
      decisionHistory: [...this.decisions],
      constraints: [...this.constraints],
      reasoningTrace: [...this.reasoningTrace],
      lastUpdated: new Date().toISOString(),
    };
  }

  getConfidence(domain?: string): number {
    if (domain) {
      const vector = this.buildConfidenceVector();
      return vector[domain] ?? 0;
    }
    if (this.hypotheses.size === 0) return 0;
    let sum = 0;
    for (const h of this.hypotheses.values()) {
      sum += h.confidence;
    }
    return sum / this.hypotheses.size;
  }

  serialize(): string {
    return JSON.stringify(this.getSnapshot());
  }

  reset(): void {
    this.hypotheses.clear();
    this.decisions = [];
    this.constraints = [];
    this.reasoningTrace = [];
  }

  private buildConfidenceVector(): Record<string, number> {
    const groups: Record<string, number[]> = {};
    for (const h of this.hypotheses.values()) {
      const domain = h.statement.split(/\s+/)[0]?.toLowerCase() ?? "unknown";
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(h.confidence);
    }
    const vector: Record<string, number> = {};
    for (const [domain, values] of Object.entries(groups)) {
      vector[domain] =
        values.reduce((a, b) => a + b, 0) / values.length;
    }
    return vector;
  }
}
