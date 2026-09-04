/**
 * Harness Tool Executor — v3.10 WS2
 *
 * Maps RTPI tool registry entries to nexus-harness skill paths and
 * executes them via the ferry client. Replaces Docker container
 * dispatch for tools that have nexus-harness skill equivalents.
 */

import { randomUUID } from 'crypto';
import { ferryClient, type FerryTaskResult, FerryClientError } from './ferry-client';
import { createLogger } from '../lib/logger';
const log = createLogger('harness-tool-executor');

// ---------------------------------------------------------------------------
// Tool → Skill mapping
// ---------------------------------------------------------------------------

interface SkillMapping {
  skillPath: string;
  requiresApproval: boolean;
}

export const TOOL_SKILL_MAP: Record<string, SkillMapping> = {
  'nmap': { skillPath: 'offense/recon/nmap-scan', requiresApproval: false },
  'nuclei': { skillPath: 'offense/web/nuclei-scan', requiresApproval: false },
  'nikto': { skillPath: 'offense/web/nikto-scan', requiresApproval: false },
  'sqlmap': { skillPath: 'offense/web/sqlmap-inject', requiresApproval: true },
  'gobuster': { skillPath: 'offense/web/dir-bruteforce', requiresApproval: false },
  'dirb': { skillPath: 'offense/web/dir-bruteforce', requiresApproval: false },
  'subfinder': { skillPath: 'offense/recon/subdomain-enum', requiresApproval: false },
  'amass': { skillPath: 'offense/recon/subdomain-enum', requiresApproval: false },
  'bbot': { skillPath: 'offense/recon/asset-discovery', requiresApproval: false },
  'netexec': { skillPath: 'offense/infrastructure/netexec-enum', requiresApproval: false },
  'crackmapexec': { skillPath: 'offense/infrastructure/netexec-enum', requiresApproval: false },
  'hydra': { skillPath: 'offense/passwords/hydra-bruteforce', requiresApproval: true },
  'hashcat': { skillPath: 'offense/passwords/hashcat-crack', requiresApproval: true },
  'metasploit': { skillPath: 'offense/infrastructure/metasploit-exploit', requiresApproval: true },
  'msfconsole': { skillPath: 'offense/infrastructure/metasploit-exploit', requiresApproval: true },
  'burpsuite': { skillPath: 'offense/web/burpsuite-pro', requiresApproval: false },
  'masscan': { skillPath: 'offense/recon/masscan-sweep', requiresApproval: false },
  'ffuf': { skillPath: 'offense/web/dir-bruteforce', requiresApproval: false },
  'wpscan': { skillPath: 'offense/web/cms-scanner', requiresApproval: false },
  'bloodhound': { skillPath: 'offense/active-directory/bloodhound-enum', requiresApproval: false },
  'kerbrute': { skillPath: 'offense/active-directory/kerberoasting', requiresApproval: true },
  'responder': { skillPath: 'offense/infrastructure/responder-relay', requiresApproval: true },
  'impacket': { skillPath: 'offense/infrastructure/impacket-suite', requiresApproval: true },
  'john': { skillPath: 'offense/passwords/john-crack', requiresApproval: true },
};

export function resolveSkillName(toolName: string): string | null {
  const normalized = toolName.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [key, mapping] of Object.entries(TOOL_SKILL_MAP)) {
    if (normalized.includes(key)) return mapping.skillPath;
  }
  return null;
}

export function hasSkillMapping(toolName: string): boolean {
  return resolveSkillName(toolName) !== null;
}

export function needsApproval(toolName: string): boolean {
  const normalized = toolName.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [key, mapping] of Object.entries(TOOL_SKILL_MAP)) {
    if (normalized.includes(key)) return mapping.requiresApproval;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Execute via ferry
// ---------------------------------------------------------------------------

export interface HarnessExecutionResult {
  success: boolean;
  output: string;
  executionTimeMs: number;
  skillName: string;
  taskId: string;
}

export async function executeViaHarness(
  toolName: string,
  params: Record<string, unknown>,
  sessionId?: string,
  targetAgentId?: string,
): Promise<HarnessExecutionResult> {
  const skillName = resolveSkillName(toolName);
  if (!skillName) {
    throw new Error(`No harness skill mapping for tool: ${toolName}`);
  }

  const taskId = `ferry-${randomUUID()}`;
  log.info(`[harness] executing skill=${skillName} task=${taskId}`);

  try {
    const result: FerryTaskResult = await ferryClient.submitTask({
      task_id: taskId,
      tool_name: skillName,
      json_arguments: JSON.stringify(params),
      session_id: sessionId,
      target_agent_id: targetAgentId,
    });

    return {
      success: !result.is_error,
      output: result.output,
      executionTimeMs: result.execution_duration_ms,
      skillName,
      taskId: result.task_id,
    };
  } catch (err) {
    if (err instanceof FerryClientError) {
      log.warn(`[harness] ferry error: ${err.message} (HTTP ${err.httpStatus})`);
      return {
        success: false,
        output: `Ferry error: ${err.message}`,
        executionTimeMs: 0,
        skillName,
        taskId,
      };
    }
    throw err;
  }
}

export const harnessToolExecutor = {
  executeViaHarness,
  resolveSkillName,
  hasSkillMapping,
};
