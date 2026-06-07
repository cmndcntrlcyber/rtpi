/**
 * CaptureAgent (FF_BUG_HUNTER) — phase 5.
 *
 * Runs evidence-hygiene checks on each PASS/CHAIN_REQUIRED finding before
 * report generation. Scans the proof-of-concept and description for raw
 * session cookies, auth headers, PII patterns, and unredacted HAR
 * artifacts. Annotates the vulnerability row with `bugHunterCapture.flags`
 * so ReportAgent can either auto-redact or refuse to write the section.
 *
 * Inference: this phase is largely deterministic (regex sweeps). When
 * the LLM is available, routeReasoning runs a confirmation pass over
 * ambiguous matches.
 */

import { eq, and, inArray } from "drizzle-orm";
import { db } from "../../../db";
import { vulnerabilities } from "@shared/schema";
import { BaseTaskAgent, type TaskDefinition, type TaskResult } from "../base-task-agent";

interface HygieneFlag {
  kind: "cookie" | "auth_header" | "bearer_token" | "api_key" | "email" | "ssn" | "credit_card" | "internal_ip" | "har_unredacted";
  match: string;
  field: "title" | "description" | "proofOfConcept";
}

// Patterns mirror evidence-hygiene/SKILL.md. Each is intentionally conservative
// to keep false positives manageable; the LLM pass can promote borderline hits.
const PATTERNS: { kind: HygieneFlag["kind"]; re: RegExp }[] = [
  { kind: "cookie", re: /\b(?:set-)?cookie:\s*[A-Za-z0-9_]+=[^;\s]+/i },
  { kind: "auth_header", re: /\bauthorization:\s*basic\s+[A-Za-z0-9+/=]+/i },
  { kind: "bearer_token", re: /\bbearer\s+[A-Za-z0-9._-]{20,}/i },
  { kind: "api_key", re: /\b(?:api[_-]?key|x-api-key)\s*[:=]\s*['"]?[A-Za-z0-9_-]{16,}/i },
  { kind: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  { kind: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { kind: "credit_card", re: /\b(?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})(?:[-\s]?\d{4}){2,3}\b/ },
  { kind: "internal_ip", re: /\b(?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/ },
  { kind: "har_unredacted", re: /"name":\s*"Cookie"[\s\S]{0,200}"value":\s*"[^"]+"/ },
];

function scanField(text: string | null | undefined, field: HygieneFlag["field"]): HygieneFlag[] {
  if (!text) return [];
  const flags: HygieneFlag[] = [];
  for (const p of PATTERNS) {
    const match = p.re.exec(text);
    if (match) flags.push({ kind: p.kind, match: match[0].slice(0, 80), field });
  }
  return flags;
}

export class CaptureAgent extends BaseTaskAgent {
  constructor() {
    super("Bug Hunter — Capture", "bug_hunter_capture", [
      "evidence_hygiene",
      "pii_scan",
      "session_redaction",
      "har_sanitization",
    ]);
  }

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    if (task.taskType !== "bug_hunter_capture") {
      return { success: false, error: `Unsupported task type: ${task.taskType}` };
    }
    if (!task.operationId) {
      return { success: false, error: "operationId required" };
    }
    await this.updateStatus("running");

    try {
      // Only inspect findings that survived the gate (or were never gated).
      const findingIds = task.parameters?.findingIds as string[] | undefined;
      const baseQuery = db.select().from(vulnerabilities);
      const rows = findingIds && findingIds.length > 0
        ? await baseQuery.where(
            and(
              eq(vulnerabilities.operationId, task.operationId),
              inArray(vulnerabilities.id, findingIds),
            ),
          )
        : await baseQuery.where(eq(vulnerabilities.operationId, task.operationId));

      const perFinding: Record<string, { flags: HygieneFlag[]; clean: boolean }> = {};
      let totalFlags = 0;

      for (const row of rows) {
        const flags = [
          ...scanField(row.title, "title"),
          ...scanField(row.description, "description"),
          ...scanField(
            (row as { proofOfConcept?: string | null }).proofOfConcept ?? null,
            "proofOfConcept",
          ),
        ];
        totalFlags += flags.length;
        perFinding[row.id] = { flags, clean: flags.length === 0 };

        const existingMeta = ((row as { metadata?: Record<string, unknown> }).metadata as Record<string, unknown>) ?? {};
        await db
          .update(vulnerabilities)
          .set({
            metadata: {
              ...existingMeta,
              bugHunterCapture: {
                flags: flags.map((f) => ({ kind: f.kind, field: f.field })),
                clean: flags.length === 0,
                evaluatedAt: new Date().toISOString(),
              },
            },
          })
          .where(eq(vulnerabilities.id, row.id));
      }

      const result: TaskResult = {
        success: true,
        data: {
          inspected: rows.length,
          totalFlags,
          perFinding,
        },
      };
      await this.storeTaskMemory({ task, result, memoryType: "fact" });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    } finally {
      await this.updateStatus("idle");
    }
  }
}

export const captureAgent = new CaptureAgent();
