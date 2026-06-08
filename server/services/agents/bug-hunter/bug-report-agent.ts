/**
 * BugReportAgent (FF_BUG_HUNTER) — phase 6.
 *
 * Generates a platform-appropriate bug-bounty / red-team report from the
 * operation's gated findings. Uses retrieve-augmented skill chunks
 * (report-writing + the platform's bugcrowd-reporting / redteam-report-
 * template) as context.
 *
 * Inference: routeReasoning (Settings → qwen3:14b default).
 *
 * Deliberately sibling — not a subclass of TechnicalWriterAgent —
 * because that agent is rigidly SysReptor-shaped and bug-bounty reports
 * target H1/Bugcrowd/Intigriti templates. A shared helper can be lifted
 * later if duplication grows.
 */

import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { vulnerabilities } from "@shared/schema";
import { BaseTaskAgent, type TaskDefinition, type TaskResult } from "../base-task-agent";
import { routeReasoning, NoInferenceProviderAvailable } from "../../inference/inference-router";
import { retrieveBugHunterSkills } from "../../knowledge/bug-hunter-skill-retriever";
import { loadEngagementMeta } from "../../bug-hunter/engagement-scaffolder";

type Platform = "hackerone" | "bugcrowd" | "intigriti" | "immunefi" | "redteam" | "internal";

const SKILL_BY_PLATFORM: Record<Platform, string> = {
  hackerone: "report-writing",
  bugcrowd: "bugcrowd-reporting",
  intigriti: "report-writing",
  immunefi: "report-writing",
  redteam: "redteam-report-template",
  internal: "report-writing",
};

export class BugReportAgent extends BaseTaskAgent {
  constructor() {
    super("Bug Hunter — Report", "bug_hunter_report", [
      "report_generation",
      "platform_templates",
      "vrt_mapping",
      "evidence_synthesis",
    ]);
  }

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    if (task.taskType !== "bug_hunter_report") {
      return { success: false, error: `Unsupported task type: ${task.taskType}` };
    }
    if (!task.operationId) {
      return { success: false, error: "operationId required" };
    }
    await this.updateStatus("running");

    try {
      const meta = await loadEngagementMeta(task.operationId);
      const platform: Platform = (task.parameters?.platform as Platform) ?? meta?.platform ?? "internal";
      const onlyPassed = task.parameters?.onlyPassed !== false;

      const all = await db.select().from(vulnerabilities).where(eq(vulnerabilities.operationId, task.operationId));
      const findings = onlyPassed
        ? all.filter((v) => {
            const m = (v as { metadata?: Record<string, unknown> }).metadata as Record<string, unknown> | undefined;
            const gate = m?.bugHunterGate as { verdict?: string } | undefined;
            return !gate || gate.verdict === "PASS" || gate.verdict === "DOWNGRADE";
          })
        : all;

      if (findings.length === 0) {
        return { success: true, data: { platform, reportMarkdown: "", findingsReported: 0 } };
      }

      const skillName = SKILL_BY_PLATFORM[platform];
      const skills = await retrieveBugHunterSkills({
        query: `${platform} bug bounty report template title summary impact reproduction steps`,
        phase: "report",
        mode: meta?.mode,
        extraTags: [`skill:${skillName}`],
        includeMeta: true,
        topK: 4,
      });

      const playbook = skills.map((s) => s.content.slice(0, 2000)).join("\n\n---\n\n").slice(0, 6000);

      // Per-finding render via single LLM call; bounded by 8 findings to
      // keep token usage predictable.
      const subset = findings.slice(0, 8);
      const findingsBlock = subset
        .map((v, i) => `### Finding ${i + 1}: ${v.title}
- Severity: ${v.severity ?? "unknown"}
- CVSS: ${(v as { cvssScore?: number | null }).cvssScore ?? "n/a"}
- Affected URL: ${(v as { affectedUrl?: string | null }).affectedUrl ?? "n/a"}
- Description: ${v.description?.slice(0, 600) ?? "(none)"}
- PoC:
${((v as { proofOfConcept?: string | null }).proofOfConcept ?? "(none)").slice(0, 1200)}`)
        .join("\n\n");

      const prompt = `Generate ${platform} report sections for each finding below. Follow the platform's template strictly. Use markdown headings. Redact any session cookies, auth headers, or PII you see; replace with [REDACTED].

PLAYBOOK:
${playbook}

FINDINGS:
${findingsBlock}

Output: one markdown document, each finding as its own H2 section.`;

      let reportMarkdown = "";
      try {
        const result = await routeReasoning({
          messages: [{ role: "user", content: prompt }],
          system: `You are a senior ${platform} reporter. Match the platform's template structure exactly. Do not invent details. Do not include credentials in output.`,
          maxTokens: 4_000,
          temperature: 0.2,
        });
        reportMarkdown = result.response.text;
      } catch (err) {
        if (err instanceof NoInferenceProviderAvailable) {
          console.warn("[BugReportAgent] no provider — emitting minimal report");
        } else {
          console.warn("[BugReportAgent] report generation failed:", err);
        }
        reportMarkdown = subset
          .map((v) => `## ${v.title}\n\n_Severity: ${v.severity}_\n\n${v.description ?? ""}`)
          .join("\n\n");
      }

      const result: TaskResult = {
        success: true,
        data: {
          platform,
          findingsReported: subset.length,
          findingsTotal: findings.length,
          reportMarkdown,
        },
      };
      await this.storeTaskMemory({ task, result, memoryType: "insight" });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    } finally {
      await this.updateStatus("idle");
    }
  }
}

export const bugReportAgent = new BugReportAgent();
