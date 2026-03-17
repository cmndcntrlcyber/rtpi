/**
 * Technical Reviewer Agent (v2.4 Phase 4 - System 2)
 *
 * Validates findings from the Technical Operator with a contrarian approach.
 * Seeks to disprove findings as false positives. Concedes only after thorough
 * validation confirms a finding as a true positive.
 */

import { BaseTaskAgent, TaskDefinition, TaskResult } from './base-task-agent';
import { db } from '../../db';
import { vulnerabilities } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { ollamaAIClient } from '../ollama-ai-client';

// ============================================================================
// Types
// ============================================================================

export interface ReviewVerdict {
  findingId: string;
  findingTitle: string;
  verdict: 'confirmed' | 'false_positive' | 'inconclusive' | 'needs_retest';
  confidence: number; // 0-100
  reasoning: string;
  contrarian_arguments: string[];
  validation_steps: string[];
  conceded: boolean; // true = contrarian objective conceded (finding is valid)
}

// ============================================================================
// Technical Reviewer Agent
// ============================================================================

class TechnicalReviewerAgent extends BaseTaskAgent {
  constructor() {
    super(
      'Technical Reviewer Agent',
      'technical_reviewer',
      ['finding_validation', 'contrarian_review', 'false_positive_detection']
    );
  }

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    await this.updateStatus('running');

    try {
      switch (task.taskType) {
        case 'review_findings':
          return await this.reviewFindings(task);
        case 'review_single_finding':
          return await this.reviewSingleFinding(task);
        default:
          return { success: false, error: `Unknown task type: ${task.taskType}` };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    } finally {
      await this.updateStatus('idle');
    }
  }

  /**
   * Review all findings for an operation
   */
  private async reviewFindings(task: TaskDefinition): Promise<TaskResult> {
    const { operationId } = task.parameters;

    const findings = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.operationId, operationId));

    if (findings.length === 0) {
      return {
        success: true,
        data: { message: 'No findings to review', verdicts: [] },
      };
    }

    const verdicts: ReviewVerdict[] = [];

    for (const finding of findings) {
      const verdict = await this.performContrarianReview(finding);
      verdicts.push(verdict);

      // Update finding status based on verdict
      if (verdict.verdict === 'false_positive') {
        await db
          .update(vulnerabilities)
          .set({ status: 'false_positive' })
          .where(eq(vulnerabilities.id, finding.id));
      }
    }

    const confirmed = verdicts.filter(v => v.verdict === 'confirmed').length;
    const falsePositives = verdicts.filter(v => v.verdict === 'false_positive').length;
    const inconclusive = verdicts.filter(v => v.verdict === 'inconclusive' || v.verdict === 'needs_retest').length;

    return {
      success: true,
      data: {
        operationId,
        totalReviewed: verdicts.length,
        confirmed,
        falsePositives,
        inconclusive,
        verdicts,
      },
    };
  }

  /**
   * Review a single finding
   */
  private async reviewSingleFinding(task: TaskDefinition): Promise<TaskResult> {
    const { vulnerabilityId } = task.parameters;

    const [finding] = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.id, vulnerabilityId))
      .limit(1);

    if (!finding) {
      return { success: false, error: `Finding ${vulnerabilityId} not found` };
    }

    const verdict = await this.performContrarianReview(finding);

    return {
      success: true,
      data: { verdict },
    };
  }

  /**
   * Perform contrarian review of a finding.
   * The reviewer's objective is to DISPROVE the finding.
   * It concedes only when evidence strongly supports the finding.
   */
  private async performContrarianReview(finding: any): Promise<ReviewVerdict> {
    // Build contrarian arguments
    const contrarian_arguments: string[] = [];
    const validation_steps: string[] = [];

    // Rule-based contrarian checks
    if (!finding.description || finding.description.length < 30) {
      contrarian_arguments.push('Finding has insufficient description — may lack evidence');
    }

    if (!finding.cveId) {
      contrarian_arguments.push('No CVE ID associated — cannot verify against known vulnerability databases');
    }

    if (finding.severity === 'informational' || finding.severity === 'low') {
      contrarian_arguments.push('Low severity suggests potential noise rather than actionable finding');
    }

    if (!finding.evidence && !finding.proofOfConcept) {
      contrarian_arguments.push('No proof of concept or evidence provided — finding may be theoretical');
    }

    // AI-assisted contrarian analysis
    try {
      const aiReview = await ollamaAIClient.complete(
        [
          {
            role: 'system',
            content: `You are a contrarian security reviewer. Your objective is to challenge vulnerability findings and identify potential false positives.

Analyze the finding and provide:
1. Arguments why this might be a FALSE POSITIVE
2. Arguments why this IS a valid finding
3. Your verdict: "confirmed", "false_positive", "inconclusive", or "needs_retest"
4. Confidence level (0-100)

Output JSON: {"contrarian_args": string[], "supporting_args": string[], "verdict": string, "confidence": number, "reasoning": string}`,
          },
          {
            role: 'user',
            content: `Review this finding:
Title: ${finding.title}
Severity: ${finding.severity}
CVE: ${finding.cveId || 'None'}
Description: ${finding.description || 'N/A'}
Status: ${finding.status}
CVSS Score: ${finding.cvssScore || 'N/A'}`,
          },
        ],
        { temperature: 0.4, maxTokens: 1024 }
      );

      try {
        const parsed = JSON.parse(aiReview.content || '{}');
        if (parsed.contrarian_args) {
          contrarian_arguments.push(...parsed.contrarian_args);
        }
        if (parsed.supporting_args) {
          validation_steps.push(...parsed.supporting_args);
        }

        const verdict = parsed.verdict || 'inconclusive';
        const confidence = parsed.confidence || 50;
        const conceded = verdict === 'confirmed' && confidence >= 70;

        return {
          findingId: finding.id,
          findingTitle: finding.title,
          verdict: verdict as ReviewVerdict['verdict'],
          confidence,
          reasoning: parsed.reasoning || 'AI review completed',
          contrarian_arguments,
          validation_steps,
          conceded,
        };
      } catch {
        // AI output wasn't valid JSON
      }
    } catch {
      // AI unavailable, use rule-based only
    }

    // Rule-based verdict when AI is unavailable
    const hasStrongEvidence = finding.cveId && finding.description?.length > 100;
    const isHighSeverity = finding.severity === 'critical' || finding.severity === 'high';

    let verdict: ReviewVerdict['verdict'] = 'inconclusive';
    let confidence = 50;

    if (hasStrongEvidence && isHighSeverity) {
      verdict = 'confirmed';
      confidence = 75;
    } else if (!hasStrongEvidence && !isHighSeverity) {
      verdict = 'needs_retest';
      confidence = 40;
    }

    return {
      findingId: finding.id,
      findingTitle: finding.title,
      verdict,
      confidence,
      reasoning: 'Rule-based review (AI unavailable)',
      contrarian_arguments,
      validation_steps: hasStrongEvidence ? ['CVE ID verified', 'Sufficient description'] : [],
      conceded: verdict === 'confirmed' && confidence >= 70,
    };
  }
}

export const technicalReviewerAgent = new TechnicalReviewerAgent();
