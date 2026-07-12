import { routeReasoning, NoInferenceProviderAvailable } from "./inference/inference-router";
import { createLogger } from '../lib/logger';
const log = createLogger("agent-prompt-generator");

export interface ToolSkillSummary {
  registry: "mcp" | "registry" | "security";
  id: string;
  name: string;
  summary: string;
  skillPath: string;
}

interface GeneratePromptParams {
  description: string;
  toolContainers: string[];
  agentType: "openai" | "anthropic";
  /**
   * FF_TOOL_SKILL_GENERATION — per-tool skill summaries loaded from
   * /skills/tools/{registry}/<id>.md. Injected into both the LLM
   * meta-prompt and the template fallback so the agent's system prompt
   * always includes operational guidance for the tools it's attached to.
   */
  toolSkills?: ToolSkillSummary[];
  groundTruth?: string;
  personaBlock?: string;
}

interface GeneratePromptResult {
  prompt: string;
  generatedBy: "openai" | "anthropic" | "template";
}

/**
 * Generates a system prompt for an agent based on description and available tools
 */
export async function generateAgentPrompt(
  params: GeneratePromptParams
): Promise<GeneratePromptResult> {
  const { description, toolContainers, agentType, toolSkills = [], groundTruth, personaBlock } = params;

  const personaPrefix = personaBlock ? `${personaBlock}\n\n` : "";

  const toolSkillsBlock = toolSkills.length > 0
    ? `\n\n**Tool Skill Summaries (load-bearing — agent must read these):**\n${toolSkills
        .map(
          (s) =>
            `### ${s.name} (${s.registry}/${s.id})\n${s.summary}\n_Full manual: \`${s.skillPath}\`_`,
        )
        .join('\n\n')}`
    : '';

  const metaPrompt = `You are an expert at creating system prompts for AI agents.

Create a detailed, professional system prompt for an AI agent with the following characteristics:

**Agent Description:**
${description}

**Available Tool Containers (in execution priority order):**
${toolContainers.length > 0
  ? toolContainers.map((t, i) => `${i + 1}. ${t}`).join('\n')
  : 'No specific tool containers assigned'}${toolSkillsBlock}

**Requirements for the prompt:**
1. Be specific about the agent's role and capabilities
2. Define clear objectives and execution strategies
3. Include safety guidelines and operational boundaries
4. Reference the tool containers and how they should be used
5. Provide guidance on error handling and adaptation
6. Keep the prompt focused and actionable
7. Use a professional, technical tone appropriate for security/red team operations

Generate ONLY the system prompt text, without any additional explanation or formatting.`;

  // Route through the inference router so Settings → Default Reasoning Model
  // is honored. The `agentType` parameter is preserved as a soft hint but
  // doesn't override Settings — operators choose providers via Settings now.
  // Falls back to the deterministic template only when every provider fails.
  try {
    const result = await routeReasoning({
      messages: [{ role: "user", content: metaPrompt }],
      maxTokens: 2000,
    });
    const text = result.response.text.trim();
    if (text.length > 0) {
      const generatedBy: GeneratePromptResult["generatedBy"] =
        result.provider === "anthropic" ? "anthropic"
          : result.provider === "openai" ? "openai"
          : "template";
      if (agentType && agentType !== generatedBy && (generatedBy === "anthropic" || generatedBy === "openai")) {
        log.info(
          `[agent-prompt-generator] agentType hint=${agentType} but router served=${result.provider}/${result.model}`,
        );
      }
      const enriched = `${personaPrefix}${text}${groundTruth ? `\n\n${groundTruth}` : ""}`;
      return { prompt: enriched, generatedBy };
    }
  } catch (error) {
    if (error instanceof NoInferenceProviderAvailable) {
      log.error("Agent prompt generation: all providers exhausted, using template:", error.message);
    } else {
      log.error("Agent prompt generation router failed:", error);
    }
  }

  // Fallback to template-based generation
  return {
    prompt: generateTemplatePrompt(params),
    generatedBy: "template",
  };
}

/**
 * Generates a template-based prompt when AI services are unavailable
 */
function generateTemplatePrompt(params: GeneratePromptParams): string {
  const { description, toolContainers, toolSkills = [], groundTruth, personaBlock } = params;

  const toolSection = toolContainers.length > 0
    ? `## Available Tool Containers

You have access to the following tool containers in order of execution priority:
${toolContainers.map((t, i) => `${i + 1}. **${t}** - Use tools from this container for ${getToolContainerPurpose(t)}`).join('\n')}

When executing tasks, prefer tools from earlier containers unless the situation requires specialized capabilities from later ones.`
    : `## Tool Usage

You will be provided with various security and reconnaissance tools. Use them systematically to achieve your objectives while maintaining operational security.`;

  const skillsSection = toolSkills.length > 0
    ? `\n\n## Tool Skills\n\n${toolSkills
        .map(
          (s) =>
            `### ${s.name}\n\n${s.summary}\n\n_Full manual: \`${s.skillPath}\` — fetch it via the filesystem MCP tool if you need parameter details, example workflows, or pitfalls beyond this summary._`,
        )
        .join('\n\n')}`
    : '';

  const personaPrefix = personaBlock ? `${personaBlock}\n\n` : "";
  const groundTruthSuffix = groundTruth ? `\n\n${groundTruth}` : "";

  return `${personaPrefix}# Agent Role

You are an AI agent specialized in ${description}.

## Core Objectives

1. **Analysis**: Thoroughly analyze targets and environments using available tools
2. **Execution**: Execute tasks methodically, documenting each step
3. **Adaptation**: Adjust your approach based on discovered information
4. **Reporting**: Provide clear, actionable findings and recommendations

${toolSection}${skillsSection}

## Operational Guidelines

### Execution Strategy
- Start with reconnaissance and information gathering
- Build a comprehensive picture before taking action
- Document all findings and decisions
- Escalate uncertain situations for human review

### Safety Requirements
- Always operate within authorized scope
- Never perform destructive actions without explicit approval
- Protect sensitive data and credentials
- Log all significant operations

### Error Handling
- If a tool fails, analyze the error and try alternative approaches
- Report persistent failures to the operator
- Do not proceed with risky operations if prerequisites fail

### Communication
- Provide clear status updates on task progress
- Highlight critical findings immediately
- Request clarification when instructions are ambiguous

## Response Format

When reporting findings, use this structure:
1. **Summary**: Brief overview of what was discovered
2. **Details**: Technical specifics and evidence
3. **Impact**: Assessment of significance
4. **Recommendations**: Suggested next steps

Remember: Your role is to assist human operators in achieving their security objectives efficiently and safely.${groundTruthSuffix}`;
}

/**
 * Infers the purpose of a tool container based on its name
 */
function getToolContainerPurpose(containerName: string): string {
  const nameLower = containerName.toLowerCase();

  if (nameLower.includes("recon") || nameLower.includes("discovery")) {
    return "reconnaissance and information gathering";
  }
  if (nameLower.includes("scan") || nameLower.includes("nuclei") || nameLower.includes("nmap")) {
    return "vulnerability scanning and enumeration";
  }
  if (nameLower.includes("exploit") || nameLower.includes("metasploit")) {
    return "exploitation and post-exploitation";
  }
  if (nameLower.includes("web") || nameLower.includes("http") || nameLower.includes("burp")) {
    return "web application testing";
  }
  if (nameLower.includes("network") || nameLower.includes("traffic")) {
    return "network analysis and traffic manipulation";
  }
  if (nameLower.includes("cred") || nameLower.includes("pass") || nameLower.includes("hash")) {
    return "credential harvesting and analysis";
  }
  if (nameLower.includes("report") || nameLower.includes("doc")) {
    return "documentation and reporting";
  }
  if (nameLower.includes("tavily") || nameLower.includes("search")) {
    return "web search and information lookup";
  }

  return "specialized operations";
}

export default { generateAgentPrompt };
