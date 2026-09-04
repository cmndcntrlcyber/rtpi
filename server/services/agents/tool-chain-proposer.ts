/**
 * Tool-chain proposer (FF_TOOL_SKILL_GENERATION-aware).
 *
 * Given recent findings and an agent's enabled toolset, asks the reasoning
 * model which tools could consume those findings as input (bbot subdomains
 * → nuclei targets, nmap open ports → httpx probe, etc.) and returns a
 * ranked list of {tool, args, rationale, consumedFindings} proposals.
 *
 * Pure proposer — never executes. Callers decide what to do with the
 * suggestions: auto-run when autonomy is high, surface for approval when
 * not, or render them into the next iteration's prompt as a hint.
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { toolRegistry, securityTools } from "@shared/schema";
import { routeReasoning, NoInferenceProviderAvailable } from "../inference/inference-router";
import { loadSkillBody } from "../skills/skill-loader";
import { slugifyId } from "../skills/skill-paths";
import type { Finding } from "./tool-execution-loop";
import { createLogger } from '../../lib/logger';
const log = createLogger("tool-chain-proposer");

export interface ChainProposal {
  /** The toolId (short form, matches tool_registry.tool_id / security_tools.id). */
  tool: string;
  /** Human-readable name (defaults to the toolId when unknown). */
  toolName: string;
  /** Command-line args the model proposes for this invocation. */
  args: string[];
  /** One- or two-sentence explanation of why this chain is valuable. */
  rationale: string;
  /** Subset of the input findings that this proposal consumes. */
  consumedFindings: Finding[];
  /** Higher = more confident. Used for ranking when callers must pick one. */
  confidence: number;
}

export interface ProposeInput {
  agentId: string;
  recentFindings: Finding[];
  enabledToolIds: string[];
  /** Tools already executed in the current loop — proposals must skip these. */
  alreadyRunInThisLoop?: string[];
  /** Hard cap on proposals returned; defaults to 5. */
  maxProposals?: number;
}

interface ToolCandidate {
  toolId: string;
  name: string;
  registry: "registry" | "security";
  skillBody: string | null;
}

/**
 * Hydrate tool candidates from the enabled IDs, pulling SKILL.md bodies
 * where present. Falls back to short metadata when no skill exists so the
 * model still has the tool name/category to reason over.
 */
async function loadCandidates(enabledIds: string[], skipIds: Set<string>): Promise<ToolCandidate[]> {
  const ids = enabledIds.filter((id) => !skipIds.has(id));
  if (ids.length === 0) return [];

  const candidates: ToolCandidate[] = [];

  const regRows = await db
    .select({
      id: toolRegistry.id,
      toolId: toolRegistry.toolId,
      name: toolRegistry.name,
      skillPath: toolRegistry.skillPath,
    })
    .from(toolRegistry)
    .where(inArray(toolRegistry.id, ids));
  for (const r of regRows) {
    const body = r.skillPath ? await loadSkillBody("registry", r.toolId) : null;
    candidates.push({
      toolId: r.toolId,
      name: r.name,
      registry: "registry",
      skillBody: body,
    });
  }

  const seen = new Set(regRows.map((r) => r.id));
  const remaining = ids.filter((id) => !seen.has(id));
  if (remaining.length > 0) {
    const secRows = await db
      .select({ id: securityTools.id, name: securityTools.name, skillPath: securityTools.skillPath })
      .from(securityTools)
      .where(inArray(securityTools.id, remaining));
    for (const r of secRows) {
      const body = r.skillPath ? await loadSkillBody("security", slugifyId(r.name)) : null;
      candidates.push({
        toolId: r.id,
        name: r.name,
        registry: "security",
        skillBody: body,
      });
    }
  }

  return candidates;
}

function renderCandidatesForPrompt(candidates: ToolCandidate[]): string {
  return candidates
    .map((c) => {
      const skill = c.skillBody
        ? `\nSKILL.md:\n${c.skillBody.slice(0, 1500)}`
        : "\n(No SKILL.md available — rely on the tool name.)";
      return `### ${c.name} (toolId=${c.toolId})${skill}`;
    })
    .join("\n\n");
}

function renderFindingsForPrompt(findings: Finding[]): string {
  return findings
    .map((f, i) => `${i + 1}. [${f.kind}] ${f.value}${f.evidence ? ` — ${f.evidence}` : ""}`)
    .join("\n");
}

/**
 * Parse the model's chain-proposal JSON output. Tolerant of code fences,
 * loose JSON, and unknown extra fields. Returns [] on garbage.
 */
export function parseChainProposalJson(
  text: string,
  candidates: ToolCandidate[],
  findings: Finding[],
  maxProposals: number,
): ChainProposal[] {
  let body = text.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) body = fence[1].trim();
  if (!body.startsWith("{") && !body.startsWith("[")) {
    const brace = body.match(/\{[\s\S]*\}/);
    const bracket = body.match(/\[[\s\S]*\]/);
    body = brace?.[0] || bracket?.[0] || "";
  }
  if (!body) return [];

  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }

  const rawList: any[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.proposals)
      ? parsed.proposals
      : [];
  if (rawList.length === 0) return [];

  const candidateMap = new Map(candidates.map((c) => [c.toolId.toLowerCase(), c]));

  const out: ChainProposal[] = [];
  for (const row of rawList) {
    if (!row || typeof row !== "object") continue;
    const tool = typeof row.tool === "string" ? row.tool.trim() : "";
    const match = candidateMap.get(tool.toLowerCase());
    if (!match) continue; // ignore proposals naming tools the agent doesn't have
    const args = Array.isArray(row.args) ? row.args.map((a: unknown) => String(a)) : [];
    const rationale = typeof row.rationale === "string" ? row.rationale.trim() : "";
    if (rationale.length === 0) continue;
    const consumedIdxs: number[] = Array.isArray(row.consumesFindings)
      ? row.consumesFindings.filter((i: any): i is number => Number.isInteger(i))
      : [];
    const consumed = consumedIdxs
      .map((i) => findings[i - 1]) // 1-based in prompt
      .filter((f): f is Finding => Boolean(f));
    const confidenceRaw = Number(row.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.5;
    out.push({
      tool: match.toolId,
      toolName: match.name,
      args,
      rationale,
      consumedFindings: consumed,
      confidence,
    });
    if (out.length >= maxProposals) break;
  }
  // Stable rank by confidence desc (preserving order on ties).
  return out.sort((a, b) => b.confidence - a.confidence);
}

export async function proposeChains(input: ProposeInput): Promise<ChainProposal[]> {
  if (input.recentFindings.length === 0) return [];
  if (input.enabledToolIds.length === 0) return [];

  const maxProposals = input.maxProposals ?? 5;
  const skipIds = new Set(input.alreadyRunInThisLoop ?? []);

  const candidates = await loadCandidates(input.enabledToolIds, skipIds);
  if (candidates.length === 0) return [];

  const prompt = `You are advising a security agent on the most valuable next tool to run.

The agent already discovered the following findings from prior tool runs:
${renderFindingsForPrompt(input.recentFindings)}

The agent has the following remaining tools available (with their SKILL.md manuals):

${renderCandidatesForPrompt(candidates)}

Identify chains where one or more findings can be consumed as input to one of the remaining tools. Examples:
- bbot subdomain → nuclei target list
- nmap open port → httpx probe / curl
- nuclei vuln hit → metasploit module
- discovered credential → SSH/RDP login attempt

Return up to ${maxProposals} proposals, ranked by value. STRICT JSON only:

{"proposals": [
  {
    "tool": "<toolId from the list above>",
    "args": ["..."],
    "rationale": "<one or two sentences>",
    "consumesFindings": [<1-based indices of findings above>],
    "confidence": <0.0 to 1.0>
  }
]}

Rules:
- Only propose tools from the list above. Do NOT propose tools the agent doesn't have.
- If no useful chains exist, return {"proposals": []}.
- Prefer proposals that consume specific findings over generic re-scans.`;

  try {
    const result = await routeReasoning({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 1500,
      temperature: 0.2,
    });
    return parseChainProposalJson(result.response.text, candidates, input.recentFindings, maxProposals);
  } catch (err) {
    if (err instanceof NoInferenceProviderAvailable) {
      // Quietly skip — proposing is best-effort, the loop already has its
      // own decision path.
      return [];
    }
    log.warn(`[tool-chain-proposer] failed:`, err);
    return [];
  }
}
