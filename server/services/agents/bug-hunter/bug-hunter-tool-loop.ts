/**
 * BugHunterToolExecutionLoop (FF_BUG_HUNTER)
 *
 * Wraps the generic ToolExecutionLoop with a pre-prompt hook that pulls
 * relevant skill chunks from the knowledge_base on every iteration and
 * splices them into the user prompt. The selection is driven by the
 * current findings (kind / value) — so once Recon surfaces an /oauth/
 * URL, the next iteration prompt carries hunt-oauth content.
 *
 * Inference path: skills are embedded with the embedding-role default
 * (qwen3-embedding:4b). The loop's own reasoning calls go through
 * routeReasoning (qwen3:14b by default). Both are honored automatically
 * by the inference router when the operator hasn't pinned a per-agent
 * override.
 */

import {
  ToolExecutionLoop,
  type LoopConstraints,
  type PrePromptHook,
  type PrePromptHookContext,
} from "../tool-execution-loop";
import {
  retrieveBugHunterSkills,
  formatSkillsForPrompt,
  type BugHunterPhase,
} from "../../knowledge/bug-hunter-skill-retriever";

interface HookOptions {
  mode?: "redteam" | "wapt";
  phase?: BugHunterPhase;
  topK?: number;
  /** Cap how many characters of skill content we splice in. */
  maxChars?: number;
}

/**
 * Build a pre-prompt hook that retrieves bug-hunter skill chunks on each
 * iteration. The query is composed from the loop objective + the most
 * recent findings so retrieval narrows as discovery progresses.
 */
export function buildBugHunterPrePromptHook(opts: HookOptions = {}): PrePromptHook {
  const topK = opts.topK ?? 4;
  const maxChars = opts.maxChars ?? 5_000;
  const phase = opts.phase ?? "hunt";

  return async (ctx: PrePromptHookContext): Promise<string | null> => {
    // Compose query: objective + the most recent 5 finding values.
    const recent = ctx.discoveredFindings.slice(-5);
    const findingsHint = recent
      .map((f) => `[${f.kind}] ${f.value}`)
      .join(" ");
    const query = [ctx.objective, findingsHint].filter(Boolean).join("\n").slice(0, 1_000);

    // Optional vuln-class hint: if a recent finding is tagged 'vulnerability'
    // and its value mentions a class keyword we know, narrow further.
    let vuln: string | undefined;
    const lowered = findingsHint.toLowerCase();
    for (const cls of [
      "sqli",
      "xss",
      "idor",
      "ssrf",
      "rce",
      "jwt",
      "oauth",
      "saml",
      "graphql",
      "xxe",
      "ssti",
      "csrf",
      "smuggling",
      "ntlm",
    ]) {
      if (lowered.includes(cls)) {
        vuln = cls;
        break;
      }
    }

    const skills = await retrieveBugHunterSkills({
      query,
      phase,
      mode: opts.mode,
      vuln,
      topK,
    });
    if (skills.length === 0) return null;

    const formatted = formatSkillsForPrompt(skills, maxChars);
    if (!formatted) return null;

    return [
      "### BUG-HUNTER SKILLS (retrieved per iteration)",
      `# query: ${query.replace(/\n/g, " ").slice(0, 200)}`,
      `# matched: ${skills.length} chunk(s) from ${new Set(skills.map((s) => s.tags.find((t) => t.startsWith("skill:")))).size} skill(s)`,
      "",
      formatted,
    ].join("\n");
  };
}

export interface BugHunterToolLoopOptions {
  agentId: string;
  agentName: string;
  operationId: string;
  targetId: string;
  objective: string;
  constraints?: Partial<LoopConstraints>;
  hook?: HookOptions;
}

/**
 * Factory: returns a ToolExecutionLoop pre-wired with the bug-hunter
 * skill-retrieval hook. Callers still invoke `.run()` themselves.
 */
export function createBugHunterToolLoop(opts: BugHunterToolLoopOptions): ToolExecutionLoop {
  const loop = new ToolExecutionLoop(
    opts.agentId,
    opts.agentName,
    opts.operationId,
    opts.targetId,
    opts.objective,
    opts.constraints ?? {},
  );
  loop.setPrePromptHook(buildBugHunterPrePromptHook(opts.hook));
  return loop;
}
