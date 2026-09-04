import { db } from "../../db";
import { sql } from "drizzle-orm";
import { createLogger } from "../../lib/logger";

const log = createLogger("behavior-baseline");

export interface BaselineMetrics {
  agentType: string;
  sampleCount: number;
  avgIterations: number;
  stdIterations: number;
  avgFindings: number;
  stdFindings: number;
  successRate: number;
  toolDistribution: Record<string, number>;
  avgDurationMs: number;
  lastUpdated: string;
}

export interface DriftAlert {
  agentType: string;
  metric: string;
  baseline: number;
  current: number;
  deviation: number;
  severity: "warning" | "critical";
  message: string;
  timestamp: string;
}

export class BehaviorBaseline {
  private baselines: Map<string, BaselineMetrics> = new Map();
  private SIGMA_WARNING = 2;
  private SIGMA_CRITICAL = 3;

  async loadBaseline(agentType: string): Promise<BaselineMetrics | null> {
    try {
      const result = await db.execute(sql`
        SELECT
          agent_name,
          COUNT(*)::int AS cnt,
          AVG(iteration)::float AS avg_iter,
          STDDEV(iteration)::float AS std_iter,
          AVG(findings_count)::float AS avg_findings,
          STDDEV(findings_count)::float AS std_findings,
          AVG(CASE WHEN success THEN 1 ELSE 0 END)::float AS success_rate,
          AVG(duration_ms)::float AS avg_duration
        FROM reasoning_traces
        WHERE agent_name = ${agentType}
        GROUP BY agent_name
      `);

      const rows = (result as any).rows ?? result;
      if (!rows || rows.length === 0) {
        return null;
      }

      const row = rows[0] as Record<string, unknown>;
      const sampleCount = row.cnt as number;

      if (sampleCount < 10) {
        return null;
      }

      const baseline: BaselineMetrics = {
        agentType,
        sampleCount,
        avgIterations: (row.avg_iter as number) || 0,
        stdIterations: (row.std_iter as number) || 0,
        avgFindings: (row.avg_findings as number) || 0,
        stdFindings: (row.std_findings as number) || 0,
        successRate: (row.success_rate as number) || 0,
        toolDistribution: {},
        avgDurationMs: (row.avg_duration as number) || 0,
        lastUpdated: new Date().toISOString(),
      };

      this.baselines.set(agentType, baseline);
      return baseline;
    } catch (err) {
      log.debug({ err, agentType }, "Failed to load baseline (table may not exist)");
      return null;
    }
  }

  async checkDrift(
    agentType: string,
    recentRun: { iterations: number; findings: number; durationMs: number; toolsUsed: string[] }
  ): Promise<DriftAlert[]> {
    let baseline = this.baselines.get(agentType);
    if (!baseline) {
      baseline = (await this.loadBaseline(agentType)) ?? undefined;
    }
    if (!baseline) {
      return [];
    }

    const alerts: DriftAlert[] = [];
    const now = new Date().toISOString();

    const checks: Array<{ metric: string; current: number; mean: number; std: number }> = [
      { metric: "iterations", current: recentRun.iterations, mean: baseline.avgIterations, std: baseline.stdIterations },
      { metric: "findings", current: recentRun.findings, mean: baseline.avgFindings, std: baseline.stdFindings },
      { metric: "durationMs", current: recentRun.durationMs, mean: baseline.avgDurationMs, std: baseline.avgDurationMs * 0.3 },
    ];

    for (const check of checks) {
      if (check.std === 0) continue;
      const zScore = (check.current - check.mean) / check.std;
      const absZ = Math.abs(zScore);

      if (absZ > this.SIGMA_CRITICAL) {
        alerts.push({
          agentType,
          metric: check.metric,
          baseline: check.mean,
          current: check.current,
          deviation: zScore,
          severity: "critical",
          message: `${check.metric} deviated ${zScore.toFixed(2)} sigma from baseline (current=${check.current}, baseline=${check.mean.toFixed(2)}+-${check.std.toFixed(2)})`,
          timestamp: now,
        });
      } else if (absZ > this.SIGMA_WARNING) {
        alerts.push({
          agentType,
          metric: check.metric,
          baseline: check.mean,
          current: check.current,
          deviation: zScore,
          severity: "warning",
          message: `${check.metric} deviated ${zScore.toFixed(2)} sigma from baseline (current=${check.current}, baseline=${check.mean.toFixed(2)}+-${check.std.toFixed(2)})`,
          timestamp: now,
        });
      }
    }

    for (const tool of recentRun.toolsUsed) {
      if (!(tool in baseline.toolDistribution)) {
        alerts.push({
          agentType,
          metric: "toolDistribution",
          baseline: 0,
          current: 1,
          deviation: 0,
          severity: "warning",
          message: `Tool "${tool}" was used but never appeared in baseline for ${agentType}`,
          timestamp: now,
        });
      }
    }

    return alerts;
  }

  async updateBaseline(
    agentType: string,
    run: { iterations: number; findings: number; durationMs: number; toolsUsed: string[]; success: boolean }
  ): Promise<void> {
    const existing = this.baselines.get(agentType);

    if (!existing) {
      const baseline: BaselineMetrics = {
        agentType,
        sampleCount: 1,
        avgIterations: run.iterations,
        stdIterations: 0,
        avgFindings: run.findings,
        stdFindings: 0,
        successRate: run.success ? 1 : 0,
        toolDistribution: {},
        avgDurationMs: run.durationMs,
        lastUpdated: new Date().toISOString(),
      };
      for (const tool of run.toolsUsed) {
        baseline.toolDistribution[tool] = 1;
      }
      this.baselines.set(agentType, baseline);
      return;
    }

    const n = existing.sampleCount;
    const newCount = n + 1;

    const updateWelford = (oldMean: number, oldStd: number, value: number) => {
      const oldM2 = oldStd * oldStd * n;
      const newMean = oldMean + (value - oldMean) / newCount;
      const newM2 = oldM2 + (value - oldMean) * (value - newMean);
      const newStd = newCount > 1 ? Math.sqrt(newM2 / (newCount - 1)) : 0;
      return { mean: newMean, std: newStd };
    };

    const iter = updateWelford(existing.avgIterations, existing.stdIterations, run.iterations);
    const findings = updateWelford(existing.avgFindings, existing.stdFindings, run.findings);
    const duration = updateWelford(existing.avgDurationMs, existing.avgDurationMs * 0.3, run.durationMs);

    existing.sampleCount = newCount;
    existing.avgIterations = iter.mean;
    existing.stdIterations = iter.std;
    existing.avgFindings = findings.mean;
    existing.stdFindings = findings.std;
    existing.successRate = existing.successRate + (((run.success ? 1 : 0) - existing.successRate) / newCount);
    existing.avgDurationMs = duration.mean;
    existing.lastUpdated = new Date().toISOString();

    for (const tool of run.toolsUsed) {
      existing.toolDistribution[tool] = (existing.toolDistribution[tool] || 0) + 1;
    }

    this.baselines.set(agentType, existing);
  }

  getBaseline(agentType: string): BaselineMetrics | null {
    return this.baselines.get(agentType) ?? null;
  }

  clearCache(): void {
    this.baselines.clear();
  }
}

export const behaviorBaseline = new BehaviorBaseline();
