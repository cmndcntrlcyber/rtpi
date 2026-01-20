/**
 * Agent-Tool Assignment Validation Service
 *
 * Validates compatibility between agents and security tools before execution.
 * Ensures agents have the required capabilities and tools meet prerequisites.
 */

import { db } from "../db";
import { agents, securityTools } from "@shared/schema";
import { eq } from "drizzle-orm";

// Tool capability requirements
interface ToolRequirements {
  platform?: string[]; // Required OS platforms
  minMemory?: number; // Minimum memory in MB
  minCpu?: number; // Minimum CPU cores
  networkAccess?: boolean; // Requires network access
  privilegedAccess?: boolean; // Requires elevated privileges
  dependencies?: string[]; // Required software dependencies
  category?: string; // Tool category
}

// Agent capabilities
interface AgentCapabilities {
  platform?: string;
  memory?: number;
  cpu?: number;
  hasNetworkAccess?: boolean;
  hasPrivilegedAccess?: boolean;
  installedDependencies?: string[];
  agentType?: string;
}

// Validation result
export interface ValidationResult {
  isCompatible: boolean;
  errors: string[];
  warnings: string[];
  recommendations?: string[];
}

/**
 * Define tool capability requirements matrix
 */
const TOOL_REQUIREMENTS: Record<string, ToolRequirements> = {
  // Reconnaissance tools
  nmap: {
    platform: ["linux", "macos"],
    minMemory: 512,
    minCpu: 1,
    networkAccess: true,
    privilegedAccess: false,
    dependencies: ["nmap"],
    category: "reconnaissance",
  },
  masscan: {
    platform: ["linux"],
    minMemory: 1024,
    minCpu: 2,
    networkAccess: true,
    privilegedAccess: true,
    dependencies: ["masscan"],
    category: "reconnaissance",
  },
  bbot: {
    platform: ["linux", "macos"],
    minMemory: 2048,
    minCpu: 2,
    networkAccess: true,
    privilegedAccess: false,
    dependencies: ["python3", "bbot"],
    category: "reconnaissance",
  },
  nuclei: {
    platform: ["linux", "macos", "windows"],
    minMemory: 1024,
    minCpu: 2,
    networkAccess: true,
    privilegedAccess: false,
    dependencies: ["nuclei"],
    category: "web_security",
  },

  // Exploitation tools
  metasploit: {
    platform: ["linux", "macos"],
    minMemory: 4096,
    minCpu: 4,
    networkAccess: true,
    privilegedAccess: false,
    dependencies: ["metasploit-framework", "postgresql"],
    category: "exploitation",
  },
  sqlmap: {
    platform: ["linux", "macos", "windows"],
    minMemory: 1024,
    minCpu: 1,
    networkAccess: true,
    privilegedAccess: false,
    dependencies: ["python3", "sqlmap"],
    category: "exploitation",
  },

  // Web Security tools
  burpsuite: {
    platform: ["linux", "macos", "windows"],
    minMemory: 4096,
    minCpu: 2,
    networkAccess: true,
    privilegedAccess: false,
    dependencies: ["java"],
    category: "web_security",
  },
  nikto: {
    platform: ["linux", "macos"],
    minMemory: 512,
    minCpu: 1,
    networkAccess: true,
    privilegedAccess: false,
    dependencies: ["perl", "nikto"],
    category: "web_security",
  },

  // Default requirements for unknown tools
  default: {
    platform: ["linux"],
    minMemory: 512,
    minCpu: 1,
    networkAccess: true,
    privilegedAccess: false,
    dependencies: [],
  },
};

/**
 * Agent type to capability mapping
 */
const AGENT_TYPE_CAPABILITIES: Record<string, Partial<AgentCapabilities>> = {
  penetration_tester: {
    hasNetworkAccess: true,
    hasPrivilegedAccess: true,
    platform: "linux",
  },
  reconnaissance: {
    hasNetworkAccess: true,
    hasPrivilegedAccess: false,
    platform: "linux",
  },
  web_security: {
    hasNetworkAccess: true,
    hasPrivilegedAccess: false,
    platform: "linux",
  },
  operations_lead: {
    hasNetworkAccess: true,
    hasPrivilegedAccess: false,
    platform: "linux",
  },
};

/**
 * Get tool requirements by tool name or ID
 */
function getToolRequirements(toolName: string): ToolRequirements {
  const normalizedName = toolName.toLowerCase();

  // Check for exact match
  if (TOOL_REQUIREMENTS[normalizedName]) {
    return TOOL_REQUIREMENTS[normalizedName];
  }

  // Check for partial match
  for (const [key, requirements] of Object.entries(TOOL_REQUIREMENTS)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return requirements;
    }
  }

  // Return default requirements
  return TOOL_REQUIREMENTS.default;
}

/**
 * Get agent capabilities from database and agent type
 */
async function getAgentCapabilities(agentId: string): Promise<AgentCapabilities> {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent) {
    throw new Error("Agent not found");
  }

  // Get base capabilities from agent type
  const typeCapabilities = AGENT_TYPE_CAPABILITIES[agent.agentType] || {};

  // Merge with agent metadata
  const agentMetadata = agent.metadata as any || {};

  return {
    platform: agentMetadata.platform || typeCapabilities.platform || "linux",
    memory: agentMetadata.memory || 2048,
    cpu: agentMetadata.cpu || 2,
    hasNetworkAccess: agentMetadata.hasNetworkAccess !== undefined
      ? agentMetadata.hasNetworkAccess
      : typeCapabilities.hasNetworkAccess !== undefined
      ? typeCapabilities.hasNetworkAccess
      : true,
    hasPrivilegedAccess: agentMetadata.hasPrivilegedAccess !== undefined
      ? agentMetadata.hasPrivilegedAccess
      : typeCapabilities.hasPrivilegedAccess !== undefined
      ? typeCapabilities.hasPrivilegedAccess
      : false,
    installedDependencies: agentMetadata.installedDependencies || [],
    agentType: agent.agentType,
  };
}

/**
 * Validate agent-tool compatibility
 */
export async function validateAgentToolAssignment(
  agentId: string,
  toolId: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  try {
    // Get agent capabilities
    const agentCapabilities = await getAgentCapabilities(agentId);

    // Get tool from database
    const tool = await db.query.securityTools.findFirst({
      where: eq(securityTools.id, toolId),
    });

    if (!tool) {
      errors.push("Tool not found");
      return { isCompatible: false, errors, warnings, recommendations };
    }

    // Get tool requirements
    const toolRequirements = getToolRequirements(tool.name);

    // Validate platform compatibility
    if (toolRequirements.platform && toolRequirements.platform.length > 0) {
      if (!toolRequirements.platform.includes(agentCapabilities.platform || "")) {
        errors.push(
          `Tool requires ${toolRequirements.platform.join(" or ")} platform, ` +
          `but agent is running ${agentCapabilities.platform}`
        );
      }
    }

    // Validate memory requirements
    if (toolRequirements.minMemory && agentCapabilities.memory) {
      if (agentCapabilities.memory < toolRequirements.minMemory) {
        warnings.push(
          `Tool requires ${toolRequirements.minMemory}MB memory, ` +
          `but agent only has ${agentCapabilities.memory}MB`
        );
      }
    }

    // Validate CPU requirements
    if (toolRequirements.minCpu && agentCapabilities.cpu) {
      if (agentCapabilities.cpu < toolRequirements.minCpu) {
        warnings.push(
          `Tool requires ${toolRequirements.minCpu} CPU cores, ` +
          `but agent only has ${agentCapabilities.cpu} cores`
        );
      }
    }

    // Validate network access
    if (toolRequirements.networkAccess && !agentCapabilities.hasNetworkAccess) {
      errors.push("Tool requires network access, but agent has no network connectivity");
    }

    // Validate privileged access
    if (toolRequirements.privilegedAccess && !agentCapabilities.hasPrivilegedAccess) {
      errors.push("Tool requires elevated privileges, but agent lacks privileged access");
      recommendations.push("Consider running agent with elevated privileges or using a different tool");
    }

    // Validate dependencies
    if (toolRequirements.dependencies && toolRequirements.dependencies.length > 0) {
      const missingDeps = toolRequirements.dependencies.filter(
        (dep) => !agentCapabilities.installedDependencies?.includes(dep)
      );

      if (missingDeps.length > 0) {
        errors.push(`Missing required dependencies: ${missingDeps.join(", ")}`);
        recommendations.push(`Install missing dependencies: ${missingDeps.join(", ")}`);
      }
    }

    // Agent type recommendations
    if (toolRequirements.category && agentCapabilities.agentType) {
      const recommendedTypes = {
        reconnaissance: ["reconnaissance", "penetration_tester"],
        exploitation: ["penetration_tester"],
        web_security: ["web_security", "penetration_tester"],
        network_security: ["penetration_tester"],
      };

      const recommended = recommendedTypes[toolRequirements.category as keyof typeof recommendedTypes];
      if (recommended && !recommended.includes(agentCapabilities.agentType)) {
        warnings.push(
          `Tool is typically used by ${recommended.join(" or ")} agents, ` +
          `but current agent is ${agentCapabilities.agentType}`
        );
      }
    }

    // Overall compatibility
    const isCompatible = errors.length === 0;

    return {
      isCompatible,
      errors,
      warnings,
      recommendations,
    };
  } catch (error: any) {
    errors.push(`Validation error: ${error.message}`);
    return {
      isCompatible: false,
      errors,
      warnings,
      recommendations,
    };
  }
}

/**
 * Suggest alternative tools if validation fails
 */
export async function suggestAlternativeTools(
  agentId: string,
  category: string
): Promise<any[]> {
  try {
    const agentCapabilities = await getAgentCapabilities(agentId);

    // Get all tools in the same category
    const allTools = await db.query.securityTools.findMany();

    const compatibleTools = [];

    for (const tool of allTools) {
      // Filter by category if provided
      if (category && tool.category !== category) {
        continue;
      }

      const validation = await validateAgentToolAssignment(agentId, tool.id);

      if (validation.isCompatible) {
        compatibleTools.push({
          ...tool,
          validationResult: validation,
        });
      }
    }

    return compatibleTools;
  } catch (error) {
    console.error("Failed to suggest alternative tools:", error);
    return [];
  }
}

/**
 * Batch validate multiple agent-tool assignments
 */
export async function batchValidateAssignments(
  assignments: Array<{ agentId: string; toolId: string }>
): Promise<Record<string, ValidationResult>> {
  const results: Record<string, ValidationResult> = {};

  for (const { agentId, toolId } of assignments) {
    const key = `${agentId}-${toolId}`;
    results[key] = await validateAgentToolAssignment(agentId, toolId);
  }

  return results;
}
