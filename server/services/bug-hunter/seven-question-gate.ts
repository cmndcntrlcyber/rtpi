/**
 * Seven-Question Gate (FF_BUG_HUNTER)
 *
 * Hybrid finding validator adapted from
 * knowledge_seed/bug_hunter_skills/triage-validation/SKILL.md. Q3 (in-scope)
 * and Q7 (always-rejected) run programmatically — they're cheap and
 * deterministic — while Q1, Q2, Q4, Q5, Q6 run through the reasoning
 * router with the triage-validation SKILL.md body as system prompt.
 *
 * Verdicts:
 *   PASS              — submit as written
 *   DOWNGRADE         — submit at lower severity
 *   CHAIN_REQUIRED    — needs an A→B chain before it's reportable
 *   KILL              — drop entirely (any of the gates failed)
 *
 * Used by ValidateAgent for the bug_hunter_validate task type and by the
 * /api/v1/bug-hunter/triage + /validate endpoints.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { routeReasoning, NoInferenceProviderAvailable } from "../inference/inference-router";
import { retrieveBugHunterSkills } from "../knowledge/bug-hunter-skill-retriever";
import { createLogger } from '../../lib/logger';
const log = createLogger("seven-question-gate");

export type Verdict = "PASS" | "DOWNGRADE" | "CHAIN_REQUIRED" | "KILL";

export interface Finding {
  title: string;
  description?: string;
  cvssScore?: number | null;
  severity?: "critical" | "high" | "medium" | "low" | "informational" | null;
  affectedUrl?: string | null;
  /** Free-text PoC / request snippet. */
  proofOfConcept?: string | null;
}

export interface ScopeContext {
  /** Parsed scope rules — set by ScopeAgent on operations.metadata. */
  inScopeDomains?: string[];
  inScopeUrlPatterns?: string[];
  outOfScopeDomains?: string[];
  outOfScopeUrlPatterns?: string[];
  /** Free-text accepted-impact list pulled from the program page. */
  acceptedImpacts?: string[];
}

export interface GateResult {
  verdict: Verdict;
  failedQuestion: number | null;
  q1: boolean | null;
  q2: boolean | null;
  q3: boolean | null;
  q4: boolean | null;
  q5: boolean | null;
  q6: boolean | null;
  q7: boolean | null;
  reasoning: string;
  matchedNeverSubmit: string | null;
  matchedChainRequired: { label: string; requires: string; validResult: string } | null;
}

interface RejectedConfig {
  neverSubmit: { pattern: string; label: string }[];
  chainRequired: { pattern: string; requires: string; validResult: string }[];
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

let rejectedConfig: RejectedConfig | null = null;
function loadRejectedConfig(): RejectedConfig {
  if (rejectedConfig) return rejectedConfig;
  const path = join(process.cwd(), "data", "bug-hunter", "always-rejected.json");
  const raw = readFileSync(path, "utf8");
  rejectedConfig = JSON.parse(raw) as RejectedConfig;
  return rejectedConfig;
}

// ---------------------------------------------------------------------------
// Programmatic gates (Q3, Q7)
// ---------------------------------------------------------------------------

function normalizeForMatch(finding: Finding): string {
  return [finding.title, finding.description, finding.proofOfConcept]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function checkAlwaysRejected(finding: Finding): {
  q7: boolean;
  matchedNeverSubmit: string | null;
  matchedChainRequired: GateResult["matchedChainRequired"];
} {
  const cfg = loadRejectedConfig();
  const haystack = normalizeForMatch(finding);

  // Chain-required hits first — they don't kill the finding, they downgrade
  // it to CHAIN_REQUIRED unless the PoC already demonstrates the chain.
  for (const entry of cfg.chainRequired) {
    const re = new RegExp(entry.pattern, "i");
    if (re.test(haystack)) {
      // Heuristic: if the PoC mentions the requirement keywords too, the
      // chain may already be built — pass Q7 and let LLM judge.
      const requiresLower = entry.requires.toLowerCase();
      const chainKeyword = requiresLower.split(/\s+/).find((w) => w.length > 4);
      const chainBuilt = chainKeyword ? haystack.includes(chainKeyword) : false;
      return {
        q7: true,
        matchedNeverSubmit: null,
        matchedChainRequired: chainBuilt ? null : { label: entry.requires, requires: entry.requires, validResult: entry.validResult },
      };
    }
  }

  for (const entry of cfg.neverSubmit) {
    const re = new RegExp(entry.pattern, "i");
    if (re.test(haystack)) {
      return {
        q7: false,
        matchedNeverSubmit: entry.label,
        matchedChainRequired: null,
      };
    }
  }
  return { q7: true, matchedNeverSubmit: null, matchedChainRequired: null };
}

function hostFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function checkInScope(finding: Finding, scope: ScopeContext): boolean {
  // Empty scope → pass; ScopeAgent should populate it from the program page.
  const has =
    (scope.inScopeDomains?.length ?? 0) > 0 ||
    (scope.inScopeUrlPatterns?.length ?? 0) > 0 ||
    (scope.outOfScopeDomains?.length ?? 0) > 0 ||
    (scope.outOfScopeUrlPatterns?.length ?? 0) > 0;
  if (!has) return true;

  const host = hostFromUrl(finding.affectedUrl);
  const haystack = normalizeForMatch(finding);

  for (const oos of scope.outOfScopeDomains ?? []) {
    const oosNorm = oos.toLowerCase();
    if (host && (host === oosNorm || host.endsWith(`.${oosNorm}`))) return false;
  }
  for (const pattern of scope.outOfScopeUrlPatterns ?? []) {
    if (new RegExp(pattern, "i").test(haystack)) return false;
  }

  if (host) {
    for (const dom of scope.inScopeDomains ?? []) {
      const domNorm = dom.toLowerCase();
      if (host === domNorm || host.endsWith(`.${domNorm}`)) return true;
    }
  }
  for (const pattern of scope.inScopeUrlPatterns ?? []) {
    if (new RegExp(pattern, "i").test(haystack)) return true;
  }

  // Domain-scoped programs with no match → out of scope.
  return false;
}

// ---------------------------------------------------------------------------
// LLM gates (Q1, Q2, Q4, Q5, Q6)
// ---------------------------------------------------------------------------

interface LlmGateResponse {
  q1: boolean;
  q2: boolean;
  q4: boolean;
  q5: boolean;
  q6: boolean;
  reasoning: string;
  severity_suggestion?: "critical" | "high" | "medium" | "low" | "informational";
}

async function runLlmGates(
  finding: Finding,
  scope: ScopeContext,
  mode: "redteam" | "wapt" | undefined,
): Promise<LlmGateResponse | null> {
  // Pull the triage-validation skill from RAG (falls back to text or empty).
  let triageSkill = "";
  try {
    const skills = await retrieveBugHunterSkills({
      query: "7-question gate finding validation cvss severity",
      phase: "validate",
      mode,
      includeMeta: true,
      topK: 3,
    });
    triageSkill = skills.map((s) => s.content.slice(0, 2000)).join("\n\n---\n\n").slice(0, 6000);
  } catch (err) {
    log.warn("[seven-question-gate] skill retrieval failed:", err);
  }

  const acceptedImpacts = scope.acceptedImpacts?.length
    ? scope.acceptedImpacts.map((a) => `- ${a}`).join("\n")
    : "(no explicit accepted-impact list captured — be conservative)";

  const userPrompt = `Evaluate the following finding against five gate questions. Return STRICT JSON.

FINDING:
title: ${finding.title}
severity (claimed): ${finding.severity ?? "unspecified"}
cvss (claimed): ${finding.cvssScore ?? "unspecified"}
affected_url: ${finding.affectedUrl ?? "n/a"}
description:
${finding.description ?? "(none)"}
proof_of_concept:
${finding.proofOfConcept ?? "(none)"}

PROGRAM ACCEPTED IMPACTS:
${acceptedImpacts}

GATE QUESTIONS — each is yes/no. "Yes" means the question passes (finding stays alive).
Q1: Can an attacker exploit this RIGHT NOW with a real HTTP request (or equivalent), no special conditions?
Q2: Does the demonstrated impact match the program's accepted impacts list above?
Q4: Is the access required realistic — a non-admin attacker (no MFA bypass, no compromised victim) can reach this?
Q5: Is this NOT already-known / NOT documented as intended behavior?
Q6: Does it merit at least CVSS Medium (~4.0)?

RESPOND WITH JSON ONLY:
{
  "q1": true|false,
  "q2": true|false,
  "q4": true|false,
  "q5": true|false,
  "q6": true|false,
  "reasoning": "1-3 sentence justification overall",
  "severity_suggestion": "critical|high|medium|low|informational"
}`;

  const system = `You are a senior bug-bounty triage analyst. Use the triage-validation playbook strictly. If a question can't be answered confidently from the evidence, lean toward false. Never invent details about the finding.

PLAYBOOK CONTEXT:
${triageSkill}`;

  try {
    const result = await routeReasoning({
      messages: [{ role: "user", content: userPrompt }],
      system,
      maxTokens: 600,
      temperature: 0.1,
    });
    const text = result.response.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as LlmGateResponse;
    return parsed;
  } catch (err) {
    if (err instanceof NoInferenceProviderAvailable) {
      log.warn("[seven-question-gate] no provider available — Q1/2/4/5/6 default to null");
    } else {
      log.warn("[seven-question-gate] llm gates failed:", err);
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Verdict resolution
// ---------------------------------------------------------------------------

function resolveVerdict(
  result: Omit<GateResult, "verdict" | "failedQuestion" | "reasoning">,
): { verdict: Verdict; failedQuestion: number | null } {
  if (result.q7 === false) return { verdict: "KILL", failedQuestion: 7 };
  if (result.q3 === false) return { verdict: "KILL", failedQuestion: 3 };

  if (result.matchedChainRequired) {
    return { verdict: "CHAIN_REQUIRED", failedQuestion: null };
  }

  // LLM gates — null means we couldn't evaluate; treat as soft-fail by
  // downgrading rather than killing outright.
  const llmQs = [result.q1, result.q2, result.q4, result.q5, result.q6];
  if (llmQs.some((q) => q === false)) {
    const idxMap = [1, 2, 4, 5, 6];
    const idx = llmQs.findIndex((q) => q === false);
    return { verdict: "KILL", failedQuestion: idxMap[idx] };
  }
  if (llmQs.some((q) => q === null)) {
    return { verdict: "DOWNGRADE", failedQuestion: null };
  }

  return { verdict: "PASS", failedQuestion: null };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RunGateOptions {
  finding: Finding;
  scope?: ScopeContext;
  mode?: "redteam" | "wapt";
  /** Skip LLM gates (fast mode for /triage endpoint). */
  fast?: boolean;
}

export async function runSevenQuestionGate(opts: RunGateOptions): Promise<GateResult> {
  const finding = opts.finding;
  const scope = opts.scope ?? {};

  // Q7 — programmatic
  const q7Result = checkAlwaysRejected(finding);

  // Q3 — programmatic
  const q3 = checkInScope(finding, scope);

  // Q1/2/4/5/6 — LLM (skipped in fast mode)
  let llmAns: LlmGateResponse | null = null;
  if (!opts.fast) {
    llmAns = await runLlmGates(finding, scope, opts.mode);
  }

  const partial = {
    q1: llmAns?.q1 ?? null,
    q2: llmAns?.q2 ?? null,
    q3,
    q4: llmAns?.q4 ?? null,
    q5: llmAns?.q5 ?? null,
    q6: llmAns?.q6 ?? null,
    q7: q7Result.q7,
    matchedNeverSubmit: q7Result.matchedNeverSubmit,
    matchedChainRequired: q7Result.matchedChainRequired,
  };

  const { verdict, failedQuestion } = resolveVerdict(partial);
  const reasoningParts: string[] = [];
  if (q7Result.matchedNeverSubmit) reasoningParts.push(`Q7 fail: matches never-submit pattern "${q7Result.matchedNeverSubmit}".`);
  if (q7Result.matchedChainRequired) reasoningParts.push(`Chain-required: needs ${q7Result.matchedChainRequired.requires}.`);
  if (!q3) reasoningParts.push("Q3 fail: target not in operation scope.");
  if (llmAns?.reasoning) reasoningParts.push(llmAns.reasoning);
  if (opts.fast) reasoningParts.push("Fast triage — Q1/2/4/5/6 not evaluated.");

  return {
    verdict,
    failedQuestion,
    ...partial,
    reasoning: reasoningParts.join(" ").trim() || "All gates passed.",
  };
}
