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

const TOOL_SKILL_MAP: Record<string, string> = {
  'nmap': 'offense/recon/nmap-scan',
  'nuclei': 'offense/web/nuclei-scan',
  'nikto': 'offense/web/nikto-scan',
  'sqlmap': 'offense/web/sqlmap-inject',
  'gobuster': 'offense/web/dir-bruteforce',
  'dirb': 'offense/web/dir-bruteforce',
  'subfinder': 'offense/recon/subdomain-enum',
  'amass': 'offense/recon/subdomain-enum',
  'bbot': 'offense/recon/asset-discovery',
  'netexec': 'offense/infrastructure/netexec-enum',
  'crackmapexec': 'offense/infrastructure/netexec-enum',
  'hydra': 'offense/passwords/hydra-bruteforce',
  'hashcat': 'offense/passwords/hashcat-crack',
  'metasploit': 'offense/infrastructure/metasploit-exploit',
  'msfconsole': 'offense/infrastructure/metasploit-exploit',
  'burpsuite': 'offense/web/burpsuite-pro',
  'masscan': 'offense/recon/masscan-sweep',
  'ffuf': 'offense/web/dir-bruteforce',
  'wpscan': 'offense/web/wordpress-scan',
  'bloodhound': 'offense/active-directory/bloodhound-collect',
  'kerbrute': 'offense/active-directory/kerberos-attack',
  'responder': 'offense/active-directory/responder-poison',
  'impacket': 'offense/active-directory/impacket-suite',
  'john': 'offense/passwords/john-crack',
};

export function resolveSkillName(toolName: string): string | null {
  const normalized = toolName.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [key, skill] of Object.entries(TOOL_SKILL_MAP)) {
    if (normalized.includes(key)) return skill;
  }
  return null;
}

export function hasSkillMapping(toolName: string): boolean {
  return resolveSkillName(toolName) !== null;
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
