import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// Initialize AI clients
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

interface GeneratePromptParams {
  description: string;
  toolContainers: string[];
  agentType: "openai" | "anthropic";
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
  const { description, toolContainers, agentType } = params;

  const metaPrompt = `You are an expert at creating system prompts for AI agents.

Create a detailed, professional system prompt for an AI agent with the following characteristics:

**Agent Description:**
${description}

**Available Tool Containers (in execution priority order):**
${toolContainers.length > 0
  ? toolContainers.map((t, i) => `${i + 1}. ${t}`).join('\n')
  : 'No specific tool containers assigned'}

**Requirements for the prompt:**
1. Be specific about the agent's role and capabilities
2. Define clear objectives and execution strategies
3. Include safety guidelines and operational boundaries
4. Reference the tool containers and how they should be used
5. Provide guidance on error handling and adaptation
6. Keep the prompt focused and actionable
7. Use a professional, technical tone appropriate for security/red team operations

Generate ONLY the system prompt text, without any additional explanation or formatting.`;

  // Try Anthropic first if available and agent type is anthropic
  if (anthropic && (agentType === "anthropic" || !openai)) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: metaPrompt,
          },
        ],
      });

      const textContent = response.content.find(block => block.type === "text");
      if (textContent && textContent.type === "text") {
        return {
          prompt: textContent.text.trim(),
          generatedBy: "anthropic",
        };
      }
    } catch (error) {
      console.error("Anthropic prompt generation failed:", error);
      // Fall through to OpenAI or template
    }
  }

  // Try OpenAI if available
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: metaPrompt,
          },
        ],
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return {
          prompt: content.trim(),
          generatedBy: "openai",
        };
      }
    } catch (error) {
      console.error("OpenAI prompt generation failed:", error);
      // Fall through to template
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
  const { description, toolContainers } = params;

  const toolSection = toolContainers.length > 0
    ? `## Available Tool Containers

You have access to the following tool containers in order of execution priority:
${toolContainers.map((t, i) => `${i + 1}. **${t}** - Use tools from this container for ${getToolContainerPurpose(t)}`).join('\n')}

When executing tasks, prefer tools from earlier containers unless the situation requires specialized capabilities from later ones.`
    : `## Tool Usage

You will be provided with various security and reconnaissance tools. Use them systematically to achieve your objectives while maintaining operational security.`;

  return `# Agent Role

You are an AI agent specialized in ${description}.

## Core Objectives

1. **Analysis**: Thoroughly analyze targets and environments using available tools
2. **Execution**: Execute tasks methodically, documenting each step
3. **Adaptation**: Adjust your approach based on discovered information
4. **Reporting**: Provide clear, actionable findings and recommendations

${toolSection}

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

Remember: Your role is to assist human operators in achieving their security objectives efficiently and safely.`;
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
