/**
 * Harness Optimization Evaluator (native port of the
 * `harness-optimization-evaluator` Claude Code agent).
 *
 * A Lean Six Sigma / DMAIC evaluator that grades how well an agent workflow (the
 * "harness") met its objectives and emits a prioritized, evidence-based
 * optimization roadmap. It is enqueued automatically after EVERY terminal
 * workflow — completed or failed — by the workflow orchestrator.
 *
 * Design notes:
 * - The `harness_evaluations` row IS the durable job queue. `enqueue()` inserts
 *   a `queued` row and fires `run()` out-of-band; `run()` moves it through
 *   running → completed/failed. `recoverPending()` re-drives stranded rows on
 *   boot. This mirrors the pdf_jobs pattern in server/api/v1/reports.ts.
 * - Verification is DATA-DRIVEN: we analyze the persisted execution record
 *   (tasks, logs, the `workflow_outcome` payload) rather than re-running tools
 *   or driving a browser. Quantitative CTQ baselines are computed
 *   deterministically in `computeMetrics()` (the "KPI normalizer" the
 *   orchestrator's completion log was already feeding) and handed to the LLM as
 *   FACTS — the model interprets, it does not invent the numbers.
 * - LLM analysis routes through the provider-agnostic inference router with a
 *   deterministic template fallback (cf. technical-writer-agent.ts).
 */

import path from "path";
import { promises as fs } from "fs";
import { eq, inArray, asc } from "drizzle-orm";
import { db } from "../db";
import {
  agentWorkflows,
  workflowTasks,
  workflowLogs,
  operations,
  notifications,
  harnessEvaluations,
} from "@shared/schema";
import { routeReasoning, NoInferenceProviderAvailable } from "./inference/inference-router";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const EVAL_DIR = path.join(UPLOAD_DIR, "harness-evaluations");
// Optional explicit model override; otherwise the router resolves the default
// reasoning model from Settings / provider chain.
const EVAL_MODEL = process.env.HARNESS_EVAL_MODEL?.trim() || undefined;

const SYSTEM_PROMPT = `You are a Principal Agent Harness Optimization Engineer and certified Lean Six Sigma Black Belt. You evaluate the effectiveness of an AI agent workflow run (the "harness": its orchestration loop, tasks, tools, prompts, and error recovery) and produce a prioritized, evidence-based optimization roadmap.

Your defining trait: you trust nothing you cannot verify. You are given the workflow's persisted execution record — task list with statuses/durations/retries/errors, structured logs, and a deterministic metrics block computed from that record. Treat the metrics block as FACTS. Treat task error messages and log entries as EVIDENCE. Treat your inferred causes and expected impacts as HYPOTHESES. Never blur these lines, and never assert a success the evidence does not support — if the record shows the workflow failed or produced no findings, say so plainly.

Apply DMAIC + Lean:
- Define: infer the workflow's objective and what "a defect" means here (failed/ retried task, unrecovered error, zero real findings, wasted steps).
- Measure: use the provided metrics as baselines (success rate, defect rate, retries, durations, steps-to-completion, findings count).
- Verify objectives via the evidence in the record (data-driven; no live re-execution available). For each objective give a PASS / FAIL / PARTIAL / UNVERIFIABLE verdict tied to specific evidence.
- Analyze root causes with structured reasoning (5 Whys / Fishbone categories: Prompt, Tooling, Orchestration, Context/Memory, Model, Environment). Pareto-rank them.
- Improve: concrete, smallest-highest-leverage changes. Eliminate waste before adding complexity. Prioritize P0 (quick win) / P1 (high-leverage) / P2 (strategic) by Impact vs Effort.
- Control & Retrospect: how each gain is locked in, plus a short retrospective feeding the next Kaizen cycle.

Respond with ONLY a single JSON object (no prose, no code fences) matching exactly this shape:
{
  "verdict": "effective" | "partial" | "ineffective",
  "effectivenessScore": <integer 0-100>,
  "executiveSummary": "<2-4 sentences: overall verdict + top actions>",
  "objectiveVerification": [ { "objective": "...", "claim": "...", "method": "...", "evidence": "...", "verdict": "PASS"|"FAIL"|"PARTIAL"|"UNVERIFIABLE" } ],
  "wasteAnalysis": [ { "waste": "<one of the 8 lean wastes adapted to agents>", "observation": "...", "impact": "..." } ],
  "rootCauses": [ { "cause": "...", "category": "Prompt"|"Tooling"|"Orchestration"|"Context/Memory"|"Model"|"Environment", "evidence": "...", "contribution": "<high|medium|low>" } ],
  "roadmap": [ { "priority": "P0"|"P1"|"P2", "action": "...", "impact": "...", "effort": "<low|medium|high>", "expectedCtqImprovement": "...", "howMeasured": "..." } ],
  "controlPlan": [ "<guardrail / eval / regression check to lock in gains>" ],
  "retrospective": { "worked": "...", "didntWork": "...", "surprised": "...", "changeNext": "..." }
}`;

export interface HarnessMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
  inProgressTasks: number;
  successRate: number; // 0-1, completed / (completed + failed)
  defectRate: number; // 0-1, failed / total
  totalRetries: number;
  stepsToCompletion: number;
  totalDurationMs: number | null;
  avgTaskDurationMs: number | null;
  realFindingsCount: number;
  toolResultsCount: number;
  overallSuccess: boolean;
  errorCount: number;
}

class HarnessOptimizationEvaluator {
  /**
   * Enqueue an evaluation for a terminal workflow. Inserts a durable `queued`
   * row and drives it out-of-band so the caller (the orchestrator) is never
   * blocked. Safe to call fire-and-forget; all errors are swallowed/persisted.
   */
  async enqueue(workflowId: string): Promise<string | null> {
    try {
      const [wf] = await db
        .select()
        .from(agentWorkflows)
        .where(eq(agentWorkflows.id, workflowId))
        .limit(1);
      if (!wf) {
        console.warn(`[harness-eval] workflow ${workflowId} not found; skipping enqueue`);
        return null;
      }

      const [row] = await db
        .insert(harnessEvaluations)
        .values({
          workflowId,
          operationId: wf.operationId ?? null,
          workflowFinalStatus: wf.status,
          status: "queued",
        })
        .returning({ id: harnessEvaluations.id });

      // Out-of-band — run() persists running/completed/failed to the row.
      this.run(row.id).catch((err) => {
        console.error(`[harness-eval] worker for ${row.id} threw:`, err);
      });
      return row.id;
    } catch (err) {
      console.error(`[harness-eval] enqueue failed for workflow ${workflowId}:`, err);
      return null;
    }
  }

  /**
   * On boot, re-drive evaluations stranded in queued/running by a crash.
   * Best-effort; never throws.
   */
  async recoverPending(): Promise<void> {
    try {
      const stuck = await db
        .select({ id: harnessEvaluations.id })
        .from(harnessEvaluations)
        .where(inArray(harnessEvaluations.status, ["queued", "running"]));
      if (stuck.length === 0) return;
      console.log(`[harness-eval] recovering ${stuck.length} pending evaluation(s)`);
      for (const row of stuck) {
        this.run(row.id).catch((err) => {
          console.error(`[harness-eval] recovery for ${row.id} threw:`, err);
        });
      }
    } catch (err) {
      console.warn(`[harness-eval] recoverPending failed:`, err);
    }
  }

  /** Process a single evaluation row end to end. */
  async run(evaluationId: string): Promise<void> {
    const startedAt = new Date();
    await db
      .update(harnessEvaluations)
      .set({ status: "running", startedAt })
      .where(eq(harnessEvaluations.id, evaluationId));

    try {
      const [evaluation] = await db
        .select()
        .from(harnessEvaluations)
        .where(eq(harnessEvaluations.id, evaluationId))
        .limit(1);
      if (!evaluation) throw new Error(`evaluation ${evaluationId} disappeared`);

      const [workflow] = await db
        .select()
        .from(agentWorkflows)
        .where(eq(agentWorkflows.id, evaluation.workflowId))
        .limit(1);
      if (!workflow) throw new Error(`workflow ${evaluation.workflowId} not found`);

      const tasks = await db
        .select()
        .from(workflowTasks)
        .where(eq(workflowTasks.workflowId, workflow.id))
        .orderBy(asc(workflowTasks.sequenceOrder));

      const logs = await db
        .select()
        .from(workflowLogs)
        .where(eq(workflowLogs.workflowId, workflow.id))
        .orderBy(asc(workflowLogs.timestamp));

      const metrics = this.computeMetrics(workflow, tasks, logs);

      let analysis: any;
      let generatedBy: string;
      let model: string | null = null;

      try {
        const prompt = this.buildPrompt(workflow, tasks, logs, metrics);
        const result = await routeReasoning({
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
          maxTokens: 4096,
          temperature: 0.3,
          responseFormat: { type: "json_object" },
          explicitModel: EVAL_MODEL,
        });
        analysis = this.parseAnalysis(result.response.text);
        generatedBy = result.provider;
        model = result.model;
      } catch (err) {
        if (err instanceof NoInferenceProviderAvailable) {
          console.warn(`[harness-eval] no provider for ${evaluationId}; using template fallback`);
        } else {
          console.warn(`[harness-eval] LLM analysis failed for ${evaluationId}; using template fallback:`, err);
        }
        analysis = this.templateAnalysis(workflow, metrics);
        generatedBy = "template";
      }

      const markdown = this.renderMarkdown(workflow, metrics, analysis, generatedBy, model);
      const { filePath, fileSize } = await this.writeMarkdown(evaluationId, markdown);

      const completedAt = new Date();
      await db
        .update(harnessEvaluations)
        .set({
          status: "completed",
          verdict: typeof analysis?.verdict === "string" ? analysis.verdict : null,
          effectivenessScore: Number.isFinite(analysis?.effectivenessScore)
            ? Math.max(0, Math.min(100, Math.round(analysis.effectivenessScore)))
            : null,
          summary: typeof analysis?.executiveSummary === "string" ? analysis.executiveSummary : null,
          metrics,
          analysis,
          filePath,
          fileSize,
          generatedBy,
          model,
          completedAt,
        })
        .where(eq(harnessEvaluations.id, evaluationId));

      await this.notify(workflow, evaluationId, analysis, metrics);
    } catch (err: any) {
      console.error(`[harness-eval] evaluation ${evaluationId} failed:`, err);
      await db
        .update(harnessEvaluations)
        .set({
          status: "failed",
          error: err?.message || "Unknown evaluation error",
          completedAt: new Date(),
        })
        .where(eq(harnessEvaluations.id, evaluationId));
    }
  }

  /** Deterministic KPI normalizer — computes CTQ baselines from the record. */
  private computeMetrics(workflow: any, tasks: any[], logs: any[]): HarnessMetrics {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const failedTasks = tasks.filter((t) => t.status === "failed").length;
    const skippedTasks = tasks.filter((t) => t.status === "skipped").length;
    const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;
    const totalRetries = tasks.reduce((n, t) => n + (t.retryCount || 0), 0);

    const durations = tasks
      .filter((t) => t.startedAt && t.completedAt)
      .map((t) => new Date(t.completedAt).getTime() - new Date(t.startedAt).getTime())
      .filter((d) => Number.isFinite(d) && d >= 0);
    const avgTaskDurationMs = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;
    const totalDurationMs =
      workflow.startedAt && workflow.completedAt
        ? new Date(workflow.completedAt).getTime() - new Date(workflow.startedAt).getTime()
        : null;

    const outcome = logs.find((l) => (l.context as any)?.type === "workflow_outcome")?.context as any;
    const realFindingsCount = Number(outcome?.realFindingsCount) || 0;
    const toolResultsCount = Number(outcome?.toolResultsCount) || 0;
    const overallSuccess =
      typeof outcome?.overallSuccess === "boolean"
        ? outcome.overallSuccess
        : workflow.status === "completed";
    const errorCount = logs.filter((l) => l.level === "error").length;

    const decided = completedTasks + failedTasks;
    return {
      totalTasks,
      completedTasks,
      failedTasks,
      skippedTasks,
      inProgressTasks,
      successRate: decided > 0 ? completedTasks / decided : 0,
      defectRate: totalTasks > 0 ? failedTasks / totalTasks : 0,
      totalRetries,
      stepsToCompletion: totalTasks,
      totalDurationMs,
      avgTaskDurationMs,
      realFindingsCount,
      toolResultsCount,
      overallSuccess,
      errorCount,
    };
  }

  private buildPrompt(workflow: any, tasks: any[], logs: any[], metrics: HarnessMetrics): string {
    const taskLines = tasks
      .map(
        (t, i) =>
          `${i + 1}. [${t.status}] ${t.taskName} (type=${t.taskType}, retries=${t.retryCount}/${t.maxRetries})` +
          (t.errorMessage ? `\n   error: ${truncate(t.errorMessage, 400)}` : ""),
      )
      .join("\n");

    // Keep the most diagnostic logs: errors and warnings, plus the outcome line.
    const notable = logs
      .filter((l) => l.level === "error" || l.level === "warning" || (l.context as any)?.type === "workflow_outcome")
      .slice(-40)
      .map((l) => `- [${l.level}] ${truncate(l.message, 300)}`)
      .join("\n");

    return `## Workflow under evaluation
Name: ${workflow.name}
Type: ${workflow.workflowType}
Final status: ${workflow.status}
Progress: ${workflow.progress}%

## Deterministic metrics (FACTS — do not alter these numbers)
${JSON.stringify(metrics, null, 2)}

## Task execution record (EVIDENCE)
${taskLines || "(no tasks recorded)"}

## Notable logs (EVIDENCE)
${notable || "(no error/warning logs)"}

Evaluate this workflow run per your methodology and respond with ONLY the JSON object specified in your instructions.`;
  }

  private parseAnalysis(text: string): any {
    let s = text.trim();
    // Strip ```json fences if a provider added them.
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();
    // Fall back to the first {...} span if there's leading/trailing prose.
    if (!s.startsWith("{")) {
      const start = s.indexOf("{");
      const end = s.lastIndexOf("}");
      if (start >= 0 && end > start) s = s.slice(start, end + 1);
    }
    return JSON.parse(s);
  }

  /** Pure-metrics fallback when no inference provider is available. */
  private templateAnalysis(workflow: any, m: HarnessMetrics): any {
    const verdict =
      workflow.status === "completed" && m.successRate >= 0.8 && m.realFindingsCount > 0
        ? "effective"
        : workflow.status === "completed" && m.successRate > 0
          ? "partial"
          : "ineffective";
    const score = Math.round(
      Math.max(
        0,
        Math.min(
          100,
          m.successRate * 70 +
            (m.realFindingsCount > 0 ? 20 : 0) +
            (m.totalRetries === 0 ? 10 : 0),
        ),
      ),
    );
    const rootCauses: any[] = [];
    if (m.failedTasks > 0)
      rootCauses.push({
        cause: `${m.failedTasks} task(s) failed`,
        category: "Orchestration",
        evidence: `defectRate=${m.defectRate.toFixed(2)}`,
        contribution: "high",
      });
    if (m.totalRetries > 0)
      rootCauses.push({
        cause: `${m.totalRetries} retry attempt(s)`,
        category: "Tooling",
        evidence: `totalRetries=${m.totalRetries}`,
        contribution: "medium",
      });
    if (m.realFindingsCount === 0)
      rootCauses.push({
        cause: "Workflow produced zero real findings",
        category: "Tooling",
        evidence: `realFindingsCount=0, toolResultsCount=${m.toolResultsCount}`,
        contribution: "high",
      });

    const roadmap: any[] = [];
    if (m.failedTasks > 0)
      roadmap.push({
        priority: "P0",
        action: "Add error recovery / retry-with-backoff for the failing task type(s)",
        impact: "Raises success rate and reduces unrecovered defects",
        effort: "medium",
        expectedCtqImprovement: `successRate ${m.successRate.toFixed(2)} → target ≥0.95`,
        howMeasured: "harness_evaluations.metrics.successRate over subsequent runs",
      });
    if (m.realFindingsCount === 0)
      roadmap.push({
        priority: "P1",
        action: "Audit tool wiring/inputs so executed tools emit parseable findings",
        impact: "Converts effort into actual findings",
        effort: "medium",
        expectedCtqImprovement: "realFindingsCount 0 → >0",
        howMeasured: "metrics.realFindingsCount",
      });

    return {
      verdict,
      effectivenessScore: score,
      executiveSummary: `Template (no-LLM) evaluation: workflow ended "${workflow.status}" with successRate=${m.successRate.toFixed(2)}, ${m.failedTasks} failed / ${m.completedTasks} completed tasks, ${m.realFindingsCount} findings. Verdict: ${verdict}.`,
      objectiveVerification: [
        {
          objective: "Complete the workflow successfully",
          claim: `status=${workflow.status}`,
          method: "execution-record inspection",
          evidence: `completed=${m.completedTasks}, failed=${m.failedTasks}, findings=${m.realFindingsCount}`,
          verdict: workflow.status === "completed" ? (m.realFindingsCount > 0 ? "PASS" : "PARTIAL") : "FAIL",
        },
      ],
      wasteAnalysis: [
        ...(m.totalRetries > 0
          ? [{ waste: "Defects/Retries", observation: `${m.totalRetries} retries`, impact: "Wasted compute & latency" }]
          : []),
      ],
      rootCauses,
      roadmap,
      controlPlan: ["Track metrics.successRate and metrics.realFindingsCount per run; alert on regression"],
      retrospective: {
        worked: m.completedTasks > 0 ? `${m.completedTasks} task(s) completed` : "n/a",
        didntWork: m.failedTasks > 0 ? `${m.failedTasks} task(s) failed` : "n/a",
        surprised: "n/a (deterministic fallback — no LLM)",
        changeNext: roadmap[0]?.action || "Maintain current configuration",
      },
    };
  }

  private renderMarkdown(
    workflow: any,
    m: HarnessMetrics,
    a: any,
    generatedBy: string,
    model: string | null,
  ): string {
    const fmtMs = (ms: number | null) => (ms == null ? "n/a" : `${(ms / 1000).toFixed(1)}s`);
    const rows = (arr: any[] | undefined, fn: (x: any) => string) =>
      Array.isArray(arr) && arr.length ? arr.map(fn).join("\n") : "_None._";

    return `# Harness Optimization Evaluation

**Workflow:** ${workflow.name} (${workflow.workflowType})
**Final status:** ${workflow.status}
**Generated by:** ${generatedBy}${model ? ` (${model})` : ""}
**Verdict:** ${a?.verdict ?? "n/a"} — **Effectiveness score:** ${a?.effectivenessScore ?? "n/a"}/100

## 1. Executive Summary
${a?.executiveSummary ?? "_n/a_"}

## 2. Objective Verification
| Objective | Claim | Method | Evidence | Verdict |
|---|---|---|---|---|
${rows(
  a?.objectiveVerification,
  (o) => `| ${esc(o.objective)} | ${esc(o.claim)} | ${esc(o.method)} | ${esc(o.evidence)} | ${esc(o.verdict)} |`,
)}

## 3. Value Stream & Waste Analysis
**Baselines:** success rate ${(m.successRate * 100).toFixed(0)}% · defect rate ${(m.defectRate * 100).toFixed(0)}% · ${m.completedTasks}/${m.totalTasks} tasks · ${m.totalRetries} retries · total ${fmtMs(m.totalDurationMs)} · avg/task ${fmtMs(m.avgTaskDurationMs)} · findings ${m.realFindingsCount}

${rows(a?.wasteAnalysis, (w) => `- **${esc(w.waste)}** — ${esc(w.observation)} _(impact: ${esc(w.impact)})_`)}

## 4. Root Cause Analysis
${rows(
  a?.rootCauses,
  (r) => `- **[${esc(r.category)}]** ${esc(r.cause)} _(contribution: ${esc(r.contribution)})_ — evidence: ${esc(r.evidence)}`,
)}

## 5. Prioritized Optimization Roadmap
${rows(
  a?.roadmap,
  (r) =>
    `### ${esc(r.priority)} — ${esc(r.action)}\n- Impact: ${esc(r.impact)}\n- Effort: ${esc(r.effort)}\n- Expected CTQ improvement: ${esc(r.expectedCtqImprovement)}\n- How measured: ${esc(r.howMeasured)}`,
)}

## 6. Control Plan
${rows(a?.controlPlan, (c) => `- ${esc(typeof c === "string" ? c : JSON.stringify(c))}`)}

## 7. Retrospective & Next Kaizen Cycle
- **Worked:** ${esc(a?.retrospective?.worked)}
- **Didn't work:** ${esc(a?.retrospective?.didntWork)}
- **Surprised:** ${esc(a?.retrospective?.surprised)}
- **Change next:** ${esc(a?.retrospective?.changeNext)}
`;
  }

  private async writeMarkdown(
    evaluationId: string,
    markdown: string,
  ): Promise<{ filePath: string; fileSize: number }> {
    await fs.mkdir(EVAL_DIR, { recursive: true });
    const filename = `harness-eval-${evaluationId}.md`;
    const abs = path.join(EVAL_DIR, filename);
    await fs.writeFile(abs, markdown, "utf-8");
    const stat = await fs.stat(abs);
    // Store path relative to UPLOAD_DIR, consistent with report-generator output.
    return { filePath: path.join("harness-evaluations", filename), fileSize: stat.size };
  }

  /** Best-effort in-app notification to the workflow owner. Never throws. */
  private async notify(workflow: any, evaluationId: string, analysis: any, metrics: HarnessMetrics): Promise<void> {
    try {
      let userId: string | null = workflow.createdBy ?? null;
      if (!userId && workflow.operationId) {
        const [op] = await db
          .select({ createdBy: operations.createdBy })
          .from(operations)
          .where(eq(operations.id, workflow.operationId))
          .limit(1);
        userId = op?.createdBy ?? null;
      }
      if (!userId) return;

      await db.insert(notifications).values({
        userId,
        type: "harness_evaluation_ready",
        title: `Harness evaluation: ${analysis?.verdict ?? "ready"}`,
        message: `"${workflow.name}" scored ${analysis?.effectivenessScore ?? "n/a"}/100 — ${metrics.completedTasks}/${metrics.totalTasks} tasks, ${metrics.realFindingsCount} findings.`,
        metadata: {
          evaluationId,
          workflowId: workflow.id,
          operationId: workflow.operationId ?? null,
          verdict: analysis?.verdict ?? null,
          effectivenessScore: analysis?.effectivenessScore ?? null,
        },
      });
    } catch (err) {
      console.warn(`[harness-eval] notification failed for ${evaluationId}:`, err);
    }
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function esc(v: unknown): string {
  if (v == null) return "n/a";
  return String(v).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export const harnessOptimizationEvaluator = new HarnessOptimizationEvaluator();
