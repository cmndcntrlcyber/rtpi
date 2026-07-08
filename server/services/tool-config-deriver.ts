/**
 * SKILL.md → tool_registry.config deriver.
 *
 * On the first execution of a tool whose `tool_registry.config` is empty,
 * `buildCommand` in tool-executor.ts calls into this module. We hand the
 * tool's SKILL.md body and the agent's input parameters (e.g. `{ target }`)
 * to the reasoning model and ask it to produce a structured
 * `{ baseCommand, parameters[] }` template. The caller then caches the
 * result back into the registry row, so subsequent runs read it
 * deterministically (no extra LLM call).
 *
 * The strict JSON schema embedded in the prompt deliberately matches
 * tool-executor's `formatParameter()`:
 *   - `flag` (e.g. "-t", "--url") wins over `name` for the CLI switch
 *   - `positional: true` emits the value bare (no switch token)
 *   - boolean / array types follow the same emit rules formatParameter
 *     enforces in the runtime path
 *
 * Returns null when the SKILL.md is too short to be useful, when the model
 * is unavailable, or when the response can't be parsed. Callers fall back
 * to the legacy positional stub in those cases.
 */

import { routeReasoning, NoInferenceProviderAvailable } from "./inference/inference-router";
import { createLogger } from '../lib/logger';
const log = createLogger("tool-config-deriver");

export type DerivedParameterType = "string" | "number" | "boolean" | "array";

export interface DerivedParameter {
  /** Must match the key in the agent-supplied `agentInputs` object. */
  name: string;
  type: DerivedParameterType;
  /** Explicit CLI flag (`-t`, `--url`). Absent ⇒ formatParameter falls back to `--name`. */
  flag?: string;
  /** When true, the value is emitted bare (no switch token). */
  positional?: boolean;
  required?: boolean;
}

export interface DerivedToolConfig {
  /** The first token(s) of the command line; the binary path is prepended by runCommand. */
  baseCommand: string;
  parameters: DerivedParameter[];
}

export interface DeriveInput {
  toolId: string;
  toolName: string;
  skillBody: string;
  /** The exact object the orchestrator passes to executeRegisteredTool. */
  agentInputs: Record<string, unknown>;
}

const SKILL_TRIM_BYTES = 6000;
const MIN_SKILL_BYTES = 80;

const VALID_TYPES: ReadonlySet<DerivedParameterType> = new Set([
  "string",
  "number",
  "boolean",
  "array",
]);

/**
 * Builds the strict-JSON prompt for the reasoning model. The prompt
 * intentionally:
 *   - Lists every key the agent will hand in, so the model can't invent
 *     parameters the runtime won't supply.
 *   - Spells out the emit semantics of formatParameter so the chosen
 *     flag/positional values produce the right shell args.
 *   - Asks for a single JSON object response with no commentary, which
 *     parseDerivedToolConfig accepts code-fenced or bare.
 */
function buildPrompt(input: DeriveInput): string {
  const trimmedSkill =
    input.skillBody.length > SKILL_TRIM_BYTES
      ? input.skillBody.slice(0, SKILL_TRIM_BYTES) + "\n…[skill trimmed]"
      : input.skillBody;
  const inputKeys = Object.keys(input.agentInputs);
  const keyList = inputKeys.length > 0 ? inputKeys.join(", ") : "(none)";

  return `You are mapping a security tool's SKILL.md manual into a structured command template the runtime can execute.

TOOL: ${input.toolName} (id=${input.toolId})

AGENT INPUT KEYS (you may only reference these names in "parameters"; no others): ${keyList}

SKILL.md:
\`\`\`md
${trimmedSkill}
\`\`\`

Produce a JSON object describing how to invoke the tool given the agent's inputs. The runtime joins:

    <binaryPath>  <baseCommand>  <each non-null parameter formatted by its definition>

Emit rules the runtime uses for each parameter:
  - When "positional": true   → emits the value bare (no flag token).
  - When "flag" is set        → emits "<flag> <value>" (e.g. "-t example.com" for {"name":"target","flag":"-t"}).
  - When neither              → emits "--<name> <value>" (legacy default).
  - type:"boolean"            → emits just the flag (or "--<name>") when value is truthy; omitted when falsy.
  - type:"array"              → emits the flag/value pair once per element.

Pick the SHORTEST correct invocation documented in the SKILL.md. Choose the flag form the tool actually accepts (short form like -u/-t when documented; do not invent flags). When the tool takes the target as a positional argument, set "positional": true and omit "flag". Do NOT include parameters the agent didn't supply.

RESPOND WITH STRICT JSON ONLY, this exact shape:

{
  "baseCommand": "<string, may be empty>",
  "parameters": [
    { "name": "target", "type": "string", "flag": "-t", "required": true }
  ]
}

No prose, no markdown fences, no commentary.`;
}

/**
 * Tolerant parser for the model's JSON response. Strips markdown fences,
 * accepts the object even if extra unknown keys are present, drops any
 * parameter whose name isn't in the agent's input keys (so a hallucinated
 * `--output` field can't sneak into the command line).
 */
export function parseDerivedToolConfig(
  raw: string,
  allowedKeys: string[],
): DerivedToolConfig | null {
  let body = raw.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) body = fence[1].trim();
  if (!body.startsWith("{")) {
    const brace = body.match(/\{[\s\S]*\}/);
    body = brace?.[0] ?? "";
  }
  if (!body) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const baseCommand =
    typeof parsed.baseCommand === "string" ? parsed.baseCommand.trim() : "";
  const paramsRaw = Array.isArray(parsed.parameters) ? parsed.parameters : [];
  const allowed = new Set(allowedKeys);

  const parameters: DerivedParameter[] = [];
  for (const row of paramsRaw) {
    if (!row || typeof row !== "object") continue;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (name.length === 0) continue;
    // If the agent supplied no keys, accept all (defensive); otherwise filter
    // to only declared input keys so hallucinated parameters can't leak.
    if (allowed.size > 0 && !allowed.has(name)) continue;
    const typeRaw = typeof row.type === "string" ? row.type.trim().toLowerCase() : "string";
    const type = (VALID_TYPES.has(typeRaw as DerivedParameterType)
      ? typeRaw
      : "string") as DerivedParameterType;
    const flag = typeof row.flag === "string" && row.flag.trim().length > 0 ? row.flag.trim() : undefined;
    const positional = row.positional === true;
    const required = row.required === true;
    parameters.push({ name, type, flag, positional, required });
  }

  // Discard the whole config when it's incoherent — empty baseCommand AND no
  // parameters would emit just the binaryPath, which the caller can do anyway
  // via the legacy stub. Returning null forces the safer fallback.
  if (baseCommand.length === 0 && parameters.length === 0) return null;

  return { baseCommand, parameters };
}

export async function deriveToolConfigFromSkill(input: DeriveInput): Promise<DerivedToolConfig | null> {
  if (!input.skillBody || input.skillBody.length < MIN_SKILL_BYTES) {
    // SKILL.md is missing or stub-like — the model would only guess.
    return null;
  }

  const allowedKeys = Object.keys(input.agentInputs);
  const prompt = buildPrompt(input);

  try {
    const result = await routeReasoning({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 800,
      temperature: 0.1,
      responseFormat: { type: "json_object" },
    });
    const derived = parseDerivedToolConfig(result.response.text, allowedKeys);
    if (derived) {
      log.info(
        `[tool-config-deriver] derived config for ${input.toolId} via ${result.provider}/${result.model} (source=${result.source})`,
      );
    }
    return derived;
  } catch (err) {
    if (err instanceof NoInferenceProviderAvailable) {
      log.warn(
        `[tool-config-deriver] no reasoning provider available for ${input.toolId}; falling back to legacy stub.`,
      );
      return null;
    }
    log.warn(`[tool-config-deriver] derivation failed for ${input.toolId}:`, err);
    return null;
  }
}
