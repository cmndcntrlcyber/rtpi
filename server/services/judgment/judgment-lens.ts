import { JudgmentSnapshot } from "../../../shared/types/judgment-types";

export class JudgmentLens {
  formatForPrompt(snapshot: JudgmentSnapshot): string {
    const sections: string[] = [];
    sections.push("## Current Judgment State");

    if (snapshot.activeHypotheses.length > 0) {
      sections.push("");
      sections.push("### Active Hypotheses");
      snapshot.activeHypotheses.forEach((h, i) => {
        sections.push(
          `${i + 1}. [${h.confidence.toFixed(2)}] ${h.statement} (${h.supportingEvidence.length} supporting, ${h.contradictingEvidence.length} contradicting)`
        );
      });
    }

    const domainEntries = Object.entries(snapshot.confidenceVector);
    if (domainEntries.length > 0) {
      sections.push("");
      sections.push("### Confidence by Domain");
      for (const [domain, value] of domainEntries) {
        sections.push(`- ${domain}: ${value.toFixed(2)}`);
      }
    }

    if (snapshot.constraints.length > 0) {
      sections.push("");
      sections.push("### Constraints");
      for (const constraint of snapshot.constraints) {
        sections.push(`- ${constraint}`);
      }
    }

    const recentDecisions = snapshot.decisionHistory.slice(-5);
    if (recentDecisions.length > 0) {
      sections.push("");
      sections.push("### Recent Decisions (last 5)");
      for (const d of recentDecisions.reverse()) {
        const toolPart = d.tool ? ` → ${d.tool}` : "";
        const outcomePart = d.outcome ? `, outcome: ${d.outcome}` : "";
        sections.push(
          `- Iter ${d.iteration}: ${d.action}${toolPart} [confidence: ${d.confidence}${outcomePart}]`
        );
      }
    }

    return sections.join("\n");
  }

  summarize(snapshot: JudgmentSnapshot): string {
    const count = snapshot.activeHypotheses.length;
    let avgConfidence = 0;
    if (count > 0) {
      avgConfidence =
        snapshot.activeHypotheses.reduce((sum, h) => sum + h.confidence, 0) /
        count;
    }
    const lastDecision =
      snapshot.decisionHistory[snapshot.decisionHistory.length - 1];
    const lastPart = lastDecision
      ? ` Last decision: ${lastDecision.action}${lastDecision.tool ? " " + lastDecision.tool : ""} at iteration ${lastDecision.iteration}.`
      : "";
    return `Agent ${snapshot.agentId} has ${count} active hypotheses (avg confidence: ${avgConfidence.toFixed(2)}).${lastPart} ${snapshot.constraints.length} constraints active.`;
  }
}

export const judgmentLens = new JudgmentLens();
