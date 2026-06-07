/**
 * Bug-Hunter agent barrel (FF_BUG_HUNTER).
 *
 * Exports the singleton agents the orchestrator dispatches to. Importing
 * this barrel registers each agent (their constructors run; the DB row
 * is created on first `.initialize()` call).
 */

export { scopeAgent, ScopeAgent } from "./scope-agent";
export { reconAgent, ReconAgent } from "./recon-agent";
export { huntAgent, HuntAgent } from "./hunt-agent";
export { chainAgent, ChainAgent } from "./chain-agent";
export { validateAgent, ValidateAgent } from "./validate-agent";
export { captureAgent, CaptureAgent } from "./capture-agent";
export { bugReportAgent, BugReportAgent } from "./bug-report-agent";
export { createBugHunterToolLoop, buildBugHunterPrePromptHook } from "./bug-hunter-tool-loop";

import { scopeAgent } from "./scope-agent";
import { reconAgent } from "./recon-agent";
import { huntAgent } from "./hunt-agent";
import { chainAgent } from "./chain-agent";
import { validateAgent } from "./validate-agent";
import { captureAgent } from "./capture-agent";
import { bugReportAgent } from "./bug-report-agent";

/**
 * Initialize all bug-hunter agents (DB rows + message-bus registration).
 * Called from workflow-event-handlers.initializeAgentSystem() when
 * FF_BUG_HUNTER is enabled.
 */
export async function initializeBugHunterAgents(): Promise<void> {
  await Promise.all([
    scopeAgent.initialize(),
    reconAgent.initialize(),
    huntAgent.initialize(),
    chainAgent.initialize(),
    validateAgent.initialize(),
    captureAgent.initialize(),
    bugReportAgent.initialize(),
  ]);
}
