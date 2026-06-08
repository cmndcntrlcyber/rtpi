import { routeReasoning, NoInferenceProviderAvailable } from "../inference/inference-router";
import type { TavilyResearchResult } from "./tavily-researcher";
import type { SkillFrontmatter } from "./skill-renderer";
import { REQUIRED_SECTIONS } from "./skill-renderer";
import type { SkillRegistry } from "./skill-paths";

export interface SynthesisInput {
  registry: SkillRegistry;
  toolId: string;
  name: string;
  description?: string | null;
  category?: string | null;
  command?: string | null;
  args?: unknown;
  version?: string | null;
  homepage?: string | null;
  githubUrl?: string | null;
  documentation?: string | null;
  research: TavilyResearchResult;
}

export interface SynthesizedSkill {
  frontmatter: Omit<SkillFrontmatter, "source_hash">;
  sections: Array<{ heading: string; body: string }>;
  generatedBy: "anthropic" | "openai" | "template";
}

const MAX_TOKENS = 3500;

function buildPrompt(input: SynthesisInput): string {
  const research = input.research.snippets
    .map(
      (s, i) =>
        `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.content.slice(0, 2000)}`,
    )
    .join("\n\n---\n\n");

  const argsStr = Array.isArray(input.args)
    ? input.args.join(" ")
    : typeof input.args === "string"
      ? input.args
      : "";

  return `You are a senior security engineer writing a SKILL.md reference for an AI agent.

The agent will be attached to this tool inside RTPI (Red Team Portable Infrastructure) and needs to know when to use it, how to invoke it, and what to watch out for. Be specific and operational. Do not invent commands, flags, or behaviors that aren't supported by the research below or by widely-known canonical usage of the tool.

# Tool metadata
- Registry: ${input.registry}
- Stable id: ${input.toolId}
- Name: ${input.name}
- Category: ${input.category ?? "(none)"}
- Version: ${input.version ?? "(unspecified)"}
- Command: ${input.command ?? "(n/a)"}
- Args: ${argsStr || "(none)"}
- Description: ${input.description ?? "(none)"}
- Homepage: ${input.homepage ?? "(none)"}
- GitHub: ${input.githubUrl ?? "(none)"}
- Documentation: ${input.documentation ?? "(none)"}

# Tavily research snippets
${research || "(no external research available — rely only on the metadata above and canonical knowledge of the tool)"}

# Output format
Return STRICT JSON (no markdown fences, no commentary) matching this TypeScript type:

{
  "description": string,    // one-line, <= 140 chars
  "tags": string[],         // 3-8 lowercase tags
  "mitre_techniques": string[], // ATT&CK technique IDs if applicable, e.g. ["T1046", "T1595.002"]; empty array if not
  "summary": string,        // <= 500 tokens, dense operational summary that will be injected into agent system prompts
  "sections": {
    "Overview": string,
    "When to use": string,
    "Authentication & setup": string,
    "Key commands / parameters": string,
    "Example workflows": string,
    "Output format": string,
    "Common pitfalls": string,
    "References": string    // bullet list of URLs from the research snippets
  }
}

The "summary" field is the load-bearing part — agents read it on every task. Write it as imperative guidance ("use when …", "invoke with …", "expect output in …"), not as marketing copy.

Required section headings (use these exact strings as JSON keys):
${REQUIRED_SECTIONS.map((s) => `- ${s}`).join("\n")}`;
}

interface LlmJson {
  description: string;
  tags?: string[];
  mitre_techniques?: string[];
  summary: string;
  sections: Record<string, string>;
}

function parseLlmJson(raw: string): LlmJson | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.description !== "string" || typeof parsed.summary !== "string") return null;
    if (!parsed.sections || typeof parsed.sections !== "object") return null;
    return parsed as LlmJson;
  } catch {
    return null;
  }
}

function toSynthesized(
  input: SynthesisInput,
  json: LlmJson,
  generatedBy: SynthesizedSkill["generatedBy"],
): SynthesizedSkill {
  const sections = REQUIRED_SECTIONS.map((heading) => ({
    heading,
    body: (json.sections[heading] ?? "").trim(),
  }));
  return {
    frontmatter: {
      name: input.name,
      description: json.description.slice(0, 200),
      registry: input.registry,
      tool_id: input.toolId,
      category: input.category ?? undefined,
      tags: (json.tags ?? []).map((t) => String(t).toLowerCase()),
      mitre_techniques: json.mitre_techniques ?? [],
      summary: json.summary,
      sources: input.research.sources,
      generated_at: new Date().toISOString(),
      generated_by: generatedBy,
    },
    sections,
    generatedBy,
  };
}

/**
 * Route this synthesis through the inference router so Settings → Default
 * Reasoning Model is honored. The router handles provider fallback; we just
 * record which provider actually served the request.
 */
async function trySynthesizeViaRouter(input: SynthesisInput): Promise<SynthesizedSkill | null> {
  try {
    const result = await routeReasoning({
      messages: [{ role: "user", content: buildPrompt(input) }],
      maxTokens: MAX_TOKENS,
      responseFormat: { type: "json_object" },
    });
    const json = parseLlmJson(result.response.text);
    if (!json) return null;
    const generatedBy: SynthesizedSkill["generatedBy"] =
      result.provider === "openai" ? "openai" : result.provider === "anthropic" ? "anthropic" : "template";
    return toSynthesized(input, json, generatedBy);
  } catch (err) {
    if (err instanceof NoInferenceProviderAvailable) {
      console.error("[skill-synthesizer] all providers exhausted:", err.message);
    } else {
      console.error("[skill-synthesizer] router failed:", err);
    }
    return null;
  }
}

function templateFallback(input: SynthesisInput): SynthesizedSkill {
  const json: LlmJson = {
    description: input.description?.slice(0, 140) ?? `${input.name} — auto-generated stub`,
    tags: [input.category ?? "tool"].filter(Boolean),
    mitre_techniques: [],
    summary:
      `${input.name} is a ${input.category ?? "tool"} registered in RTPI. ` +
      `${input.description ?? "No description available."} ` +
      `Use it when the task aligns with its category. ` +
      `${input.command ? `Invocation: \`${input.command}${Array.isArray(input.args) && input.args.length ? " " + (input.args as unknown[]).join(" ") : ""}\`. ` : ""}` +
      `This summary is a fallback generated without LLM or web research — consult ${input.homepage ?? input.githubUrl ?? "the upstream documentation"} for accurate usage.`,
    sections: {
      Overview: input.description ?? `${input.name} (no description provided).`,
      "When to use": `Use when the engagement requires capabilities in the ${input.category ?? "general"} category.`,
      "Authentication & setup": "See upstream documentation.",
      "Key commands / parameters": input.command ? `Primary command: \`${input.command}\`.` : "See upstream documentation.",
      "Example workflows": "Not available — populate this section manually or regenerate when LLM access is restored.",
      "Output format": "Unknown — depends on tool configuration.",
      "Common pitfalls": "None documented in fallback mode.",
      References: [input.homepage, input.githubUrl, input.documentation, ...input.research.sources]
        .filter(Boolean)
        .map((u) => `- ${u}`)
        .join("\n") || "_No references available._",
    },
  };
  return toSynthesized(input, json, "template");
}

export async function synthesizeSkill(input: SynthesisInput): Promise<SynthesizedSkill> {
  const fromRouter = await trySynthesizeViaRouter(input);
  if (fromRouter) return fromRouter;
  return templateFallback(input);
}
