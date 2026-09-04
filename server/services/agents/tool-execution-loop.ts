/**
 * Tool Execution Loop
 *
 * The core reasoning loop for autonomous agent tool execution.
 * AI decides → selects tool → executes in container → parses output → feeds back for next decision.
 *
 * Used by BaseTaskAgent.runToolLoop() to give any agent autonomous tool execution capability.
 */

import { EventEmitter } from "events";
import { multiContainerExecutor, ToolInfo } from "./multi-container-executor";
import { ExecutionResult } from "../docker-executor";
import { memoryService, SearchResult } from "../memory-service";
import { agentMessageBus } from "../agent-message-bus";
import { routeReasoning, NoInferenceProviderAvailable } from "../inference/inference-router";
import { loadSkillBody } from "../skills/skill-loader";
import { slugifyId } from "../skills/skill-paths";
import { proposeChains, type ChainProposal } from "./tool-chain-proposer";
import { db } from "../../db";
import { toolRegistry, agents, mcpServers } from "../../../shared/schema";
import { eq, inArray } from "drizzle-orm";
import { metasploitExecutor } from "../metasploit-executor";
import { empireExecutor } from "../empire-executor";
import { mcpInvoker } from "./mcp-invoker";
import { resolveAgentMcpServerIds } from "./mcp-resolve";
import { readFeatureFlags } from '../../../shared/feature-flags';
import { triageError, formatTriagedError } from './error-triage';
import { runDeterministicProbe, formatProbeForPrompt } from './deterministic-probe';
import { probeCache } from './probe-cache';
import { reviewCompletion, MAX_REJECTIONS } from './completion-reviewer';
import { JudgmentSpace } from '../judgment/judgment-space';
import { judgmentLens } from '../judgment/judgment-lens';
import { shouldEscalate, policyForAutonomyLevel } from '../judgment/escalation-policy';
import { arbiter } from '../judgment/arbiter';
import { makerCheckerGate } from './maker-checker-gate';
import { DeadLoopDetector, TokenBudgetTracker } from './loop-safety';
import { loopCheckpoint } from './loop-checkpoint';
import { reasoningTraceRecorder } from '../judgment/reasoning-trace';
import { steeringController } from '../judgment/steering';
import { createLogger } from '../../lib/logger';
const log = createLogger("tool-execution-loop");

// ============================================================================
// Types
// ============================================================================

export interface LoopConstraints {
  /** Maximum number of tool execution iterations (default: 10) */
  maxIterations: number;
  /** Maximum total duration in milliseconds (default: 30 minutes) */
  maxDurationMs: number;
  /** Tool categories that require human approval before execution */
  requireApprovalForCategories: string[];
  /** Autonomy level 1-10 (higher = less approval needed) */
  autonomyLevel: number;
  /** Maximum output size per tool in bytes before truncation (default: 50KB) */
  maxOutputBytes: number;
  /** AI provider configuration */
  aiProvider?: "ollama" | "openai" | "anthropic" | "auto";
  /** AI model override */
  aiModel?: string;
  /** Token budget for the entire loop (0 = unlimited) */
  tokenBudget?: number;
  /** Cost budget in USD for the entire loop (0 = unlimited) */
  costBudgetUsd?: number;
  /** Enable checkpoint/resume */
  enableCheckpoints?: boolean;
  /** Checkpoint save interval in iterations (default: 3) */
  checkpointIntervalIterations?: number;
}

export interface ToolIterationResult {
  iteration: number;
  reasoning: string;
  toolUsed: string | null;
  args: string[];
  executionResult: ExecutionResult | null;
  parsedOutput: string | null;
  memoryId: string | null;
  durationMs: number;
  /** Structured findings extracted from this iteration's output (see Finding). */
  findings?: Finding[];
}

/**
 * Concrete, actionable artifact extracted from a tool's output. Used both to
 * persist into `memory_entries` tagged `finding` and to seed the next
 * iteration's "what should I do next" prompt without re-feeding raw stdout.
 *
 * `kind` is a short hand-rolled enum because the LLM rarely produces
 * consistent labels otherwise; if it returns something off-list, we coerce
 * to "other".
 */
export interface Finding {
  /** "host" | "url" | "vulnerability" | "credential" | "asset" | "other" */
  kind: string;
  /** Specific value — IP, URL, CVE id, secret, etc. */
  value: string;
  /** Optional 1-line explanation. */
  evidence?: string;
}

export interface LoopResult {
  iterations: ToolIterationResult[];
  summary: string;
  memoryIds: string[];
  status: "completed" | "approval_pending" | "max_iterations" | "timeout" | "error";
  totalDurationMs: number;
  toolsUsed: string[];
  error?: string;
}

/** AI response for a single iteration */
interface AIDecision {
  action: "execute_tool" | "complete" | "request_approval";
  tool?: string;
  /** Positional CLI args for container/synthetic tools. */
  args?: string[];
  /** Named arguments for MCP tools (`mcp::…` toolIds), keyed by the tool's
   *  inputSchema. Mutually exclusive with `args` in practice. */
  argsObject?: Record<string, unknown>;
  reasoning: string;
  summary?: string;
  approvalReason?: string;
}

/** Approval callback — injected by AgentWebSocketManager (B4) */
export type ApprovalCallback = (request: {
  tool: string;
  args: string[];
  reason: string;
  agentId: string;
  operationId: string;
}) => Promise<{ approved: boolean; reason?: string }>;

// ============================================================================
// Constants
// ============================================================================

const VALID_FINDING_KINDS = new Set([
  "host",
  "url",
  "vulnerability",
  "credential",
  "asset",
  "other",
]);

/**
 * Tolerant parser for the reasoning model's finding output. Accepts either
 * the canonical `{ "findings": [...] }` shape or a bare array, strips
 * markdown code fences, and coerces unknown kinds to "other". Returns []
 * when nothing parseable is present (the loop continues without findings).
 */
export function parseFindingJson(text: string): Finding[] {
  let body = text.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) body = fence[1].trim();
  if (!body.startsWith("{") && !body.startsWith("[")) {
    const brace = body.match(/\{[\s\S]*\}/);
    const bracket = body.match(/\[[\s\S]*\]/);
    body = brace?.[0] || bracket?.[0] || "";
  }
  if (!body) return [];
  try {
    const parsed = JSON.parse(body);
    const arr: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.findings) ? parsed.findings : [];
    return arr
      .map((row: any) => {
        if (!row || typeof row !== "object") return null;
        const value = typeof row.value === "string" ? row.value.trim() : "";
        if (value.length === 0) return null;
        const rawKind = typeof row.kind === "string" ? row.kind.trim().toLowerCase() : "other";
        const kind = VALID_FINDING_KINDS.has(rawKind) ? rawKind : "other";
        const evidence = typeof row.evidence === "string" ? row.evidence.trim() : undefined;
        return { kind, value, evidence: evidence && evidence.length > 0 ? evidence : undefined };
      })
      .filter((f): f is Finding => f !== null)
      .slice(0, 5);
  } catch {
    return [];
  }
}

const DEFAULT_CONSTRAINTS: LoopConstraints = {
  maxIterations: 10,
  maxDurationMs: 30 * 60 * 1000, // 30 minutes
  requireApprovalForCategories: ["exploitation", "post-exploitation", "c2"],
  autonomyLevel: 5,
  maxOutputBytes: 50 * 1024, // 50KB
};

const SLIDING_WINDOW_FULL = 5; // Keep last N iterations in full detail

// ============================================================================
// Per-agent scoping — restricts the loop's tool catalog to an agent's assigned
// tools (config.enabledTools) and composes its own systemPrompt (which carries
// the injected `## Tool Skills` section). Metasploit/Empire are surfaced as
// AI-callable synthetic tools so the kill-chain stays adaptive but runs through
// the one engine. When no scope is supplied the loop behaves exactly as before
// (global catalog, generic system prompt) — back-compat for executeAutonomousToolLoop.
// ============================================================================

/** A synthetic (non-container) tool the AI can select, dispatched specially. */
export interface SyntheticToolSpec {
  toolId: string;
  name: string;
  category: string;
  description: string;
}

export interface AgentToolScope {
  /** UUIDs from agent.config.enabledTools (tool_registry row ids). */
  enabledToolIds: string[];
  /** agent.config.systemPrompt — carries persona + `## Tool Skills`. */
  agentSystemPrompt?: string;
  /** Resolved target value, needed by synthetic MSF/Empire dispatch. */
  targetValue?: string;
  /** securityTools row id for Metasploit (metasploitExecutor keys on this). */
  msfToolId?: string;
  /** Empire C2 server id + user, when an Empire run is bound. */
  empireServerId?: string;
  empireUserId?: string;
  /** Which synthetic tools to surface in the catalog. */
  syntheticTools?: SyntheticToolSpec[];
}

const SYNTHETIC_MSF_SEARCH = "msf_search";
const SYNTHETIC_MSF_RUN = "msf_run";
const SYNTHETIC_EMPIRE_TASK = "empire_task";
const SYNTHETIC_TOOL_IDS = new Set<string>([
  SYNTHETIC_MSF_SEARCH,
  SYNTHETIC_MSF_RUN,
  SYNTHETIC_EMPIRE_TASK,
]);

// MCP tools surfaced to the autonomous loop carry a `mcp::<serverId>::<toolName>`
// toolId so the dispatcher can route them to mcpInvoker and recover both halves
// without a side table. `::` cannot appear in an MCP tool name, so the split is
// unambiguous on the first/last delimiter.
export const MCP_TOOL_PREFIX = "mcp::";
export function parseMcpToolId(toolId: string): { serverId: string; toolName: string } | null {
  if (!toolId.startsWith(MCP_TOOL_PREFIX)) return null;
  const rest = toolId.slice(MCP_TOOL_PREFIX.length);
  const sep = rest.indexOf("::");
  if (sep <= 0) return null;
  return { serverId: rest.slice(0, sep), toolName: rest.slice(sep + 2) };
}

/** Default synthetic tool specs an exploit-path agent can be given. */
export const ATTACK_SYNTHETIC_TOOLS: SyntheticToolSpec[] = [
  {
    toolId: SYNTHETIC_MSF_SEARCH,
    name: "Metasploit module search",
    category: "recon",
    description:
      "Search the Metasploit module database. args: [query, moduleType?]. Returns candidate modules (type/path [rank] description).",
  },
  {
    toolId: SYNTHETIC_MSF_RUN,
    name: "Metasploit module run",
    category: "exploitation",
    description:
      "Run a Metasploit module against the target. args: [type, path, KEY=value ...] (e.g. exploit, unix/ftp/vsftpd_234_backdoor, RPORT=21). Requires approval.",
  },
  {
    toolId: SYNTHETIC_EMPIRE_TASK,
    name: "Empire C2 task",
    category: "c2",
    description:
      "Task an existing Empire agent. args: [agentName, command...]. Requires an active Empire server + agent and approval.",
  },
];

// ============================================================================
// Pre-prompt hook — lets specialized agents (e.g. bug-hunter) inject extra
// context (retrieved skills, mode-specific rules) per iteration without
// forking the loop.
// ============================================================================

export interface PrePromptHookContext {
  iteration: number;
  objective: string;
  operationId: string;
  targetId: string;
  agentName: string;
  discoveredFindings: ReadonlyArray<Finding>;
  previousIterations: ReadonlyArray<ToolIterationResult>;
}

export type PrePromptHook = (ctx: PrePromptHookContext) => Promise<string | null | undefined>;

// ============================================================================
// Tool Execution Loop
// ============================================================================

export class ToolExecutionLoop extends EventEmitter {
  private agentId: string;
  private agentName: string;
  private operationId: string;
  private targetId: string;
  private objective: string;
  private constraints: LoopConstraints;
  private approvalCallback: ApprovalCallback | null = null;
  private aborted = false;
  /** Findings accumulated across the entire run — feeds into the next prompt. */
  private discoveredFindings: Finding[] = [];
  /** Latest chain proposals from tool-chain-proposer (refreshed when new findings land). */
  private chainProposals: ChainProposal[] = [];
  /** Extra-context generators, called per iteration before the prompt is sent. */
  private prePromptHooks: PrePromptHook[] = [];
  /** Tracks iteration counter so the hook can decorate context appropriately. */
  private currentIteration = 0;
  /** Per-agent scope (tool allowlist + prompt + synthetic tools). Null = global/unscoped. */
  private scope: AgentToolScope | null = null;
  private judgmentSpace: JudgmentSpace | null = null;
  private completionRejections = 0;
  private probeContext = "";

  constructor(
    agentId: string,
    agentName: string,
    operationId: string,
    targetId: string,
    objective: string,
    constraints: Partial<LoopConstraints> = {},
    scope: AgentToolScope | null = null,
  ) {
    super();
    this.agentId = agentId;
    this.agentName = agentName;
    this.operationId = operationId;
    this.targetId = targetId;
    this.objective = objective;
    this.constraints = { ...DEFAULT_CONSTRAINTS, ...constraints };
    this.scope = scope;
    if (readFeatureFlags(process.env).judgmentSpace) {
      this.judgmentSpace = new JudgmentSpace(agentId, operationId);
    }
  }

  /** Set the approval callback (wired by AgentWebSocketManager in B4) */
  setApprovalCallback(cb: ApprovalCallback): void {
    this.approvalCallback = cb;
  }

  setPrePromptHook(hook: PrePromptHook): void {
    this.prePromptHooks.push(hook);
  }

  addPrePromptHook(hook: PrePromptHook): void {
    this.prePromptHooks.push(hook);
  }

  /** Abort the loop externally */
  abort(): void {
    this.aborted = true;
  }

  /**
   * Run the autonomous tool execution loop.
   */
  async run(): Promise<LoopResult> {
    const startTime = Date.now();
    const iterations: ToolIterationResult[] = [];
    const memoryIds: string[] = [];
    const toolsUsed: string[] = [];

    try {
      // 1. Gather context
      const [availableTools, relevantMemories] = await Promise.all([
        this.getAvailableTools(),
        this.getRelevantMemories(),
      ]);

      const flags = readFeatureFlags(process.env);

      const deadLoopDetector = flags.loopEngineering ? new DeadLoopDetector() : null;
      const budgetTracker = flags.loopEngineering
        ? new TokenBudgetTracker(this.constraints.tokenBudget || 0, this.constraints.costBudgetUsd || 0)
        : null;

      if (flags.intentAccuracyEngine) {
        try {
          let probeResult = probeCache.get(this.targetId);
          if (!probeResult) {
            probeResult = await runDeterministicProbe(this.targetId);
            probeCache.set(this.targetId, probeResult);
          }
          this.probeContext = formatProbeForPrompt(probeResult);
        } catch (err) {
          log.warn("[tool-execution-loop] probe failed (non-fatal):", err);
        }
      }

      if (availableTools.length === 0) {
        return {
          iterations: [],
          summary: "No tools available in the registry.",
          memoryIds: [],
          status: "error",
          totalDurationMs: Date.now() - startTime,
          toolsUsed: [],
          error: "No tools found in registry. Run tool discovery first.",
        };
      }

      // 2. Iteration loop
      for (let i = 0; i < this.constraints.maxIterations; i++) {
        this.currentIteration = i + 1;
        if (this.aborted) {
          return this.buildResult(iterations, memoryIds, toolsUsed, startTime, "error", "Aborted by user");
        }

        // Check timeout
        if (Date.now() - startTime > this.constraints.maxDurationMs) {
          return this.buildResult(iterations, memoryIds, toolsUsed, startTime, "timeout");
        }

        if (budgetTracker) {
          const budget = budgetTracker.isExhausted();
          if (budget.exhausted) {
            return this.buildResult(iterations, memoryIds, toolsUsed, startTime, "max_iterations", budget.reason);
          }
        }

        const iterStart = Date.now();

        // 2a. Call AI for decision
        let decision = await this.getAIDecision(
          availableTools,
          relevantMemories,
          iterations,
        );

        const forcedTool = steeringController.getForcedTool();
        if (forcedTool && decision.action === "execute_tool") {
          decision = { ...decision, tool: forcedTool, reasoning: `[STEERED] Operator forced tool: ${forcedTool}. Original: ${decision.tool}` };
        }

        if (flags.judgmentSpace && this.judgmentSpace) {
          const escalation = shouldEscalate(
            this.judgmentSpace.getSnapshot(),
            decision,
            policyForAutonomyLevel(this.constraints.autonomyLevel),
          );
          if (escalation.escalate) {
            try {
              const result = await arbiter.arbitrate({
                decision,
                snapshot: this.judgmentSpace.getSnapshot(),
                policy: policyForAutonomyLevel(this.constraints.autonomyLevel),
                availableTools: availableTools.map((t) => ({ toolId: t.toolId, name: t.name, category: t.category })),
                approvalCallback: this.approvalCallback || undefined,
              });
              if (result.escalated) {
                decision = result.finalDecision as AIDecision;
                log.info(`[ToolExecutionLoop] decision escalated via ${result.escalationRoute}: ${result.overrideReason || "no reason"}`);
              }
            } catch (arbErr) {
              log.warn("[ToolExecutionLoop] arbitration failed (using original decision):", arbErr);
            }
          }
        }

        // 2b. Handle decision
        if (decision.action === "complete") {
          if (flags.intentAccuracyEngine && this.completionRejections < MAX_REJECTIONS) {
            const review = reviewCompletion({
              iterations,
              findings: this.discoveredFindings,
              objective: this.objective,
              toolsUsed,
              availableTools,
            });
            if (!review.accepted) {
              this.completionRejections++;
              iterations.push({
                iteration: i + 1,
                reasoning: `COMPLETION REJECTED (${this.completionRejections}/${MAX_REJECTIONS}): ${review.reason}. Required: ${review.requiredActions?.join(", ") || "none"}`,
                toolUsed: null,
                args: [],
                executionResult: null,
                parsedOutput: null,
                memoryId: null,
                durationMs: Date.now() - iterStart,
              });
              continue;
            }
          }

          iterations.push({
            iteration: i + 1,
            reasoning: decision.reasoning,
            toolUsed: null,
            args: [],
            executionResult: null,
            parsedOutput: null,
            memoryId: null,
            durationMs: Date.now() - iterStart,
          });

          return this.buildResult(
            iterations,
            memoryIds,
            toolsUsed,
            startTime,
            "completed",
            undefined,
            decision.summary,
          );
        }

        if (decision.action === "request_approval") {
          iterations.push({
            iteration: i + 1,
            reasoning: decision.reasoning,
            toolUsed: null,
            args: [],
            executionResult: null,
            parsedOutput: null,
            memoryId: null,
            durationMs: Date.now() - iterStart,
          });

          return this.buildResult(iterations, memoryIds, toolsUsed, startTime, "approval_pending");
        }

        // 2c. Validate tool exists
        const toolName = decision.tool!;
        const toolInfo = availableTools.find(
          (t) => t.toolId === toolName || t.name === toolName,
        );
        if (!toolInfo) {
          // Tool not found — feed error back and let AI retry
          iterations.push({
            iteration: i + 1,
            reasoning: decision.reasoning,
            toolUsed: toolName,
            args: decision.args || [],
            executionResult: { stdout: "", stderr: `Tool '${toolName}' not found in registry.`, exitCode: 1, timedOut: false },
            parsedOutput: null,
            memoryId: null,
            durationMs: Date.now() - iterStart,
          });
          continue;
        }

        // 2d. Check if tool category requires approval
        if (this.needsApproval(toolInfo.category)) {
          if (this.approvalCallback) {
            const approval = await this.approvalCallback({
              tool: toolName,
              args: decision.args || [],
              reason: decision.reasoning,
              agentId: this.agentId,
              operationId: this.operationId,
            });

            if (!approval.approved) {
              iterations.push({
                iteration: i + 1,
                reasoning: `Approval denied for ${toolName}: ${approval.reason || "no reason given"}`,
                toolUsed: toolName,
                args: decision.args || [],
                executionResult: null,
                parsedOutput: null,
                memoryId: null,
                durationMs: Date.now() - iterStart,
              });
              continue;
            }
          } else {
            // No approval callback wired — block and return pending
            return this.buildResult(iterations, memoryIds, toolsUsed, startTime, "approval_pending");
          }
        }

        // 2e. Execute tool in container
        this.emit("tool_start", { iteration: i + 1, tool: toolName, args: decision.args });

        let execResult: ExecutionResult;
        try {
          if (SYNTHETIC_TOOL_IDS.has(toolInfo.toolId)) {
            execResult = await this.executeSyntheticTool(toolInfo.toolId, decision.args || []);
          } else if (toolInfo.toolId.startsWith(MCP_TOOL_PREFIX)) {
            execResult = await this.executeMcpTool(toolInfo.toolId, decision.argsObject || {});
          } else {
            execResult = await multiContainerExecutor.executeTool(
              toolInfo.toolId,
              decision.args || [],
              { timeout: Math.min(300000, this.constraints.maxDurationMs - (Date.now() - startTime)) },
            );
          }
        } catch (execError) {
          execResult = {
            stdout: "",
            stderr: execError instanceof Error ? execError.message : String(execError),
            exitCode: 1,
            timedOut: false,
          };
        }

        if (flags.intentAccuracyEngine && (execResult.exitCode !== 0 || execResult.timedOut)) {
          const triage = triageError(
            execResult.stderr || "",
            execResult.exitCode,
            toolInfo.toolId,
            execResult.timedOut,
          );
          execResult = {
            ...execResult,
            stderr: formatTriagedError(triage, execResult.stderr || ""),
          };
        }

        // 2f. Truncate output
        const truncatedOutput = this.truncateOutput(execResult.stdout || execResult.stderr);
        if (!toolsUsed.includes(toolName)) {
          toolsUsed.push(toolName);
        }

        this.emit("tool_complete", {
          iteration: i + 1,
          tool: toolName,
          exitCode: execResult.exitCode,
          outputLength: (execResult.stdout || "").length,
        });

        if (this.judgmentSpace) {
          const decisionRecord = {
            iteration: i + 1,
            action: "execute_tool",
            tool: toolName,
            confidence: this.judgmentSpace.getConfidence(),
            outcome: (execResult.exitCode === 0 ? "success" : "failure") as "success" | "failure",
            durationMs: Date.now() - iterStart,
          };
          this.judgmentSpace.recordDecision(decisionRecord);
          this.emit("judgment_update", this.judgmentSpace.getSnapshot());

          if (flags.judgmentSpace) {
            reasoningTraceRecorder.record({
              operationId: this.operationId,
              agentId: this.agentId,
              agentName: this.agentName,
              decision: decisionRecord,
              findingsThisIteration: 0,
            });
          }
        }

        if (deadLoopDetector) {
          deadLoopDetector.recordIteration(toolName, decision.args || [], 0);
          const stall = deadLoopDetector.isStalled();
          if (stall.stalled) {
            log.warn(`[ToolExecutionLoop] Dead loop detected: ${stall.reason}. Reducing autonomy.`);
            this.constraints.autonomyLevel = Math.max(1, this.constraints.autonomyLevel - 2);
          }
        }

        if (budgetTracker && this.judgmentSpace) {
          budgetTracker.record(2048, 0);
        }

        if (flags.loopEngineering && this.constraints.enableCheckpoints) {
          const interval = this.constraints.checkpointIntervalIterations || 3;
          if ((i + 1) % interval === 0) {
            loopCheckpoint.save(this.agentId, this.operationId, {
              iteration: i + 1,
              findings: this.discoveredFindings,
              toolsUsed,
              memoryIds,
              judgmentSnapshot: this.judgmentSpace?.getSnapshot(),
            }).catch(() => {});
          }
        }

        // 2g. Store result in memory
        let memoryId: string | null = null;
        try {
          const context = await memoryService.createContext({
            contextType: "operation",
            contextId: this.operationId,
            contextName: `Operation ${this.operationId}`,
          });

          const memory = await memoryService.addMemory({
            contextId: context.id,
            memoryText: `[${this.agentName}] Tool: ${toolName} ${(decision.args || []).join(" ")}\nExit: ${execResult.exitCode}\nOutput: ${truncatedOutput.slice(0, 2000)}`,
            memoryType: "event",
            sourceAgentId: this.agentId,
            tags: [toolName, toolInfo.category, execResult.exitCode === 0 ? "success" : "failure"],
            metadata: {
              iteration: i + 1,
              toolName,
              args: decision.args,
              exitCode: execResult.exitCode,
              outputLength: (execResult.stdout || "").length,
            },
          });
          memoryId = memory.id;
          memoryIds.push(memory.id);
        } catch (memErr) {
          log.error(`[ToolExecutionLoop] Failed to store memory:`, memErr);
        }

        // 2h. Emit progress
        await this.emitProgress(i + 1, toolName, execResult);

        // 2i. Extract structured findings from the output via the reasoning
        // model. Findings get persisted to memory tagged `finding` so the
        // operation's memory feed surfaces concrete artifacts, and they're
        // also accumulated on the loop so the next iteration's prompt can
        // reference them without re-feeding raw stdout. Errors here are
        // logged and swallowed — extraction is best-effort.
        let findings: Finding[] = [];
        if (execResult.exitCode === 0 && (execResult.stdout || "").length > 0) {
          try {
            findings = await this.extractFindings(toolInfo, decision.args || [], execResult.stdout);
            if (findings.length > 0 && flags.loopEngineering) {
              const verified: Finding[] = [];
              for (const f of findings) {
                try {
                  const checkResult = await makerCheckerGate.check({
                    source: this.agentName,
                    content: `[${f.kind}] ${f.value}${f.evidence ? ` — ${f.evidence}` : ""}`,
                    contentType: "finding",
                    rawEvidence: [truncatedOutput],
                    confidence: 1.0,
                  });
                  if (checkResult.checkerVerdict.accepted) verified.push(f);
                  else log.info(`[ToolExecutionLoop] checker rejected finding: ${f.value} — ${checkResult.checkerVerdict.reason}`);
                } catch (checkErr) {
                  verified.push(f);
                }
              }
              findings = verified;
            }
            if (findings.length > 0) {
              await this.persistFindings(findings, toolInfo, decision.args || [], i + 1);
              this.discoveredFindings.push(...findings);
            }
          } catch (err) {
            log.warn(`[ToolExecutionLoop] finding extraction failed for ${toolName}:`, err);
          }
        }

        // 2j. Refresh chain proposals when new findings landed. Each proposal
        // names a tool the agent already has that can consume one of the
        // findings (e.g. bbot subdomain → nuclei target list). Rendered into
        // the next iteration's prompt so the AI strongly considers the
        // suggested pipeline. Best-effort — never blocks the loop.
        if (findings.length > 0) {
          try {
            this.chainProposals = await proposeChains({
              agentId: this.agentId,
              recentFindings: this.discoveredFindings,
              enabledToolIds: availableTools.map((t) => t.toolId),
              alreadyRunInThisLoop: toolsUsed,
              maxProposals: 5,
            });
          } catch (err) {
            log.warn(`[ToolExecutionLoop] chain proposer failed:`, err);
          }
        }

        iterations.push({
          iteration: i + 1,
          reasoning: decision.reasoning,
          toolUsed: toolName,
          args: decision.args || [],
          executionResult: execResult,
          parsedOutput: truncatedOutput,
          memoryId,
          durationMs: Date.now() - iterStart,
          findings,
        });
      }

      // Hit max iterations
      return this.buildResult(iterations, memoryIds, toolsUsed, startTime, "max_iterations");
    } catch (error) {
      return this.buildResult(
        iterations,
        memoryIds,
        toolsUsed,
        startTime,
        "error",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // ============================================================================
  // AI Decision Making
  // ============================================================================

  private async getAIDecision(
    tools: ToolInfo[],
    memories: SearchResult[],
    previousIterations: ToolIterationResult[],
  ): Promise<AIDecision> {
    const systemPrompt = this.buildSystemPrompt(tools);
    let userPrompt = this.buildUserPrompt(memories, previousIterations);

    if (this.prePromptHooks.length > 0) {
      const hookCtx: PrePromptHookContext = {
        iteration: this.currentIteration,
        objective: this.objective,
        operationId: this.operationId,
        targetId: this.targetId,
        agentName: this.agentName,
        discoveredFindings: this.discoveredFindings,
        previousIterations,
      };
      const extras: string[] = [];
      for (const hook of this.prePromptHooks) {
        try {
          const extra = await hook(hookCtx);
          if (extra && extra.trim()) extras.push(extra.trim());
        } catch (err) {
          log.warn(`[tool-execution-loop] pre-prompt hook failed:`, err);
        }
      }
      if (extras.length > 0) {
        userPrompt = `${userPrompt}\n\n--- ADDITIONAL CONTEXT ---\n${extras.join("\n\n")}`;
      }
    }

    // Route the next-step decision through the reasoning resolver so the
    // operator's Settings (DEFAULT_REASONING_MODEL → DEFAULT_MODEL) drive
    // selection. An explicit aiModel on the loop constraints still wins.
    const explicitModel = this.constraints.aiModel?.trim() || undefined;
    const result = await routeReasoning({
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
      maxTokens: 2048,
      temperature: 0.2,
      explicitModel,
    });

    return this.parseAIDecision(result.response.text);
  }

  private buildSystemPrompt(tools: ToolInfo[]): string {
    const toolList = tools
      .map((t) => `- ${t.toolId} (${t.category}): ${t.name} [container: ${t.containerName}]`)
      .join("\n");

    const approvalCategories = this.constraints.requireApprovalForCategories.join(", ");

    // Synthetic tools carry an args contract the AI must follow; surface it.
    const syntheticUsage = (this.scope?.syntheticTools ?? []).length
      ? `\n\nSYNTHETIC TOOL USAGE (exact arg formats):\n${this.scope!.syntheticTools!
          .map((s) => `- ${s.toolId}: ${s.description}`)
          .join("\n")}`
      : "";

    // MCP tools take NAMED arguments (a JSON object), not positional CLI args.
    // Surface each one's input schema and instruct the model to pass `args` as
    // an object for these toolIds.
    const mcpTools = tools.filter((t) => t.toolId.startsWith(MCP_TOOL_PREFIX));
    const mcpUsage = mcpTools.length
      ? `\n\nMCP TOOL USAGE — for these toolIds, "args" MUST be a JSON OBJECT of named arguments matching the schema (NOT an array):\n${mcpTools
          .map((t) => {
            const schema = t.inputSchema ? ` schema: ${JSON.stringify(t.inputSchema)}` : "";
            const desc = t.description ? ` — ${t.description}` : "";
            return `- ${t.toolId}${desc}${schema}`;
          })
          .join("\n")}`
      : "";

    // The action protocol + tool list are machine-authoritative and MUST come
    // last so the parser and tool-name validation keep working even when an
    // agent's own systemPrompt precedes them.
    const protocol = `AVAILABLE TOOLS:
${toolList}${syntheticUsage}${mcpUsage}

RULES:
1. Select tools from the AVAILABLE TOOLS list ONLY. Use the exact toolId.
2. For normal tools, provide "args" as an array of strings (command-line args). For "mcp::" toolIds, provide "args" as a JSON OBJECT of named arguments matching that tool's schema.
3. Categories requiring approval before execution: ${approvalCategories}
4. When the objective is achieved or you have enough information, use action "complete".
5. If you need human approval for a sensitive action, use action "request_approval".
6. Analyze tool output carefully before deciding the next step.
7. Do not repeat the same tool with the same arguments unless you have reason to expect different results.

RESPOND WITH VALID JSON ONLY:
{
  "action": "execute_tool" | "complete" | "request_approval",
  "tool": "toolId",
  "args": ["arg1", "arg2"],
  "reasoning": "Why this action",
  "summary": "Final summary (only for complete action)",
  "approvalReason": "Why approval is needed (only for request_approval)"
}`;

    // Per-agent: lead with the agent's own persona + `## Tool Skills`, then the
    // authoritative protocol. Unscoped: keep the original generic preamble.
    const agentPrompt = this.scope?.agentSystemPrompt?.trim();
    if (agentPrompt) {
      return `${agentPrompt}

---

You are operating as an autonomous security agent. Follow your role above, but you may use ONLY the tools and the response protocol defined below.

${protocol}`;
    }

    return `You are an autonomous security assessment agent executing tools to achieve an objective.

${protocol}`;
  }

  private buildUserPrompt(
    memories: SearchResult[],
    previousIterations: ToolIterationResult[],
  ): string {
    const parts: string[] = [];

    parts.push(`OBJECTIVE: ${this.objective}`);
    parts.push(`TARGET: ${this.targetId}`);
    parts.push(`OPERATION: ${this.operationId}`);

    if (this.probeContext) {
      parts.push("");
      parts.push(this.probeContext);
    }

    if (this.judgmentSpace) {
      const snapshot = this.judgmentSpace.getSnapshot();
      if (snapshot.activeHypotheses.length > 0 || snapshot.decisionHistory.length > 0) {
        parts.push("");
        parts.push(judgmentLens.formatForPrompt(snapshot));
      }
    }

    const steeringPrompt = steeringController.formatForPrompt();
    if (steeringPrompt) {
      parts.push("");
      parts.push(steeringPrompt);
    }

    // Relevant memories
    if (memories.length > 0) {
      parts.push("\nRELEVANT CONTEXT FROM MEMORY:");
      for (const mem of memories.slice(0, 5)) {
        parts.push(`- [${mem.memoryType}] ${mem.memoryText.slice(0, 300)}`);
      }
    }

    // Previous iterations with sliding window
    if (previousIterations.length > 0) {
      parts.push("\nPREVIOUS ITERATIONS:");

      const totalIters = previousIterations.length;
      const fullStart = Math.max(0, totalIters - SLIDING_WINDOW_FULL);

      // Summarized older iterations
      if (fullStart > 0) {
        parts.push(`[${fullStart} earlier iterations summarized]`);
        for (let i = 0; i < fullStart; i++) {
          const iter = previousIterations[i];
          parts.push(`  ${i + 1}. ${iter.toolUsed || "no-tool"}: ${iter.reasoning.slice(0, 100)}`);
        }
      }

      // Full recent iterations
      for (let i = fullStart; i < totalIters; i++) {
        const iter = previousIterations[i];
        parts.push(`\nIteration ${iter.iteration}:`);
        parts.push(`  Tool: ${iter.toolUsed || "none"}`);
        parts.push(`  Args: ${iter.args.join(" ")}`);
        parts.push(`  Reasoning: ${iter.reasoning}`);
        if (iter.executionResult) {
          parts.push(`  Exit Code: ${iter.executionResult.exitCode}`);
          parts.push(`  Output:\n${(iter.parsedOutput || "").slice(0, 3000)}`);
        }
      }
    }

    if (this.discoveredFindings.length > 0) {
      parts.push("\nDISCOVERED FINDINGS (concrete artifacts surfaced from prior tool runs):");
      const recent = this.discoveredFindings.slice(-20);
      for (const f of recent) {
        parts.push(`- [${f.kind}] ${f.value}${f.evidence ? ` — ${f.evidence}` : ""}`);
      }
      parts.push(
        "When choosing the next tool, prefer one that consumes or validates these findings (e.g. probe a discovered host, exploit a known vuln, follow up on a credential).",
      );
    }

    if (this.chainProposals.length > 0) {
      parts.push("\nSUGGESTED TOOL CHAINS (ranked by the reasoning model — each consumes specific findings):");
      for (const p of this.chainProposals.slice(0, 5)) {
        const consumed = p.consumedFindings.length > 0
          ? ` (consumes: ${p.consumedFindings.map((f) => `[${f.kind}] ${f.value}`).join(", ")})`
          : "";
        parts.push(`- ${p.tool} ${p.args.join(" ")} — ${p.rationale}${consumed}`);
      }
      parts.push(
        "Strongly consider the top-ranked suggestion. Pick a different tool only if you have a specific reason.",
      );
    }

    parts.push("\nWhat should be done next? Respond with JSON.");
    return parts.join("\n");
  }

  /**
   * Ask the reasoning model to pull 0-5 concrete findings out of a tool's
   * output. Loads the tool's SKILL.md body (if present) so the model has
   * documented patterns to look for. Strict JSON contract; on any parse
   * failure returns [] and lets the caller move on.
   */
  private async extractFindings(
    tool: ToolInfo,
    args: string[],
    rawOutput: string,
  ): Promise<Finding[]> {
    const trimmed = rawOutput.length > 8000 ? rawOutput.slice(0, 8000) + "\n…[trimmed]" : rawOutput;

    // Try both registries — skill files for the same tool may live under
    // either. Misses are silent.
    const skillBody =
      (await loadSkillBody("registry", tool.toolId).catch(() => null)) ||
      (await loadSkillBody("security", slugifyId(tool.name)).catch(() => null));

    const skillSection = skillBody
      ? `\n\nTOOL MANUAL (SKILL.md — use to recognize meaningful output patterns):\n${skillBody.slice(0, 4000)}`
      : "";

    const prompt = `Extract concrete, actionable security findings from the tool output below. Return STRICT JSON.

TOOL: ${tool.name} (${tool.toolId})
COMMAND ARGS: ${args.join(" ")}${skillSection}

TOOL OUTPUT:
\`\`\`
${trimmed}
\`\`\`

Rules:
- Return at most 5 findings. Quality over quantity — only include items that warrant follow-up.
- Each finding must have a "kind" (one of: host, url, vulnerability, credential, asset, other), a "value" (the specific artifact), and an optional "evidence" (≤1 sentence explaining why it matters).
- Return an empty array [] if nothing actionable was discovered.
- Do NOT include vague summaries, banners, version strings unless they map to a known vuln, or noise.

Respond with valid JSON only, in this exact shape:
{"findings": [{"kind": "...", "value": "...", "evidence": "..."}]}`;

    try {
      const result = await routeReasoning({
        messages: [{ role: "user", content: prompt }],
        maxTokens: 1024,
        temperature: 0.1,
      });
      const text = result.response.text.trim();
      const parsed = parseFindingJson(text);
      return parsed;
    } catch (err) {
      if (err instanceof NoInferenceProviderAvailable) {
        // Don't spam logs in the no-provider case — the loop continues fine
        // without findings extraction.
        return [];
      }
      throw err;
    }
  }

  /**
   * Persists each finding into `memory_entries` tagged `finding` so they
   * surface in the operation's memory feed. Best-effort — per-row failures
   * are logged, not thrown.
   */
  private async persistFindings(
    findings: Finding[],
    tool: ToolInfo,
    args: string[],
    iteration: number,
  ): Promise<void> {
    try {
      const context = await memoryService.createContext({
        contextType: "operation",
        contextId: this.operationId,
        contextName: `Operation ${this.operationId}`,
      });
      for (const f of findings) {
        try {
          await memoryService.addMemory({
            contextId: context.id,
            memoryText: `[${f.kind}] ${f.value}${f.evidence ? ` — ${f.evidence}` : ""}`,
            memoryType: "fact",
            sourceAgentId: this.agentId,
            tags: ["finding", f.kind, tool.toolId],
            metadata: {
              iteration,
              toolId: tool.toolId,
              toolName: tool.name,
              args,
              findingKind: f.kind,
            },
          });
        } catch (err) {
          log.warn(`[ToolExecutionLoop] failed to persist finding ${f.kind}/${f.value}:`, err);
        }
      }
    } catch (err) {
      log.error(`[ToolExecutionLoop] persistFindings context creation failed:`, err);
    }
  }

  private parseAIDecision(content: string): AIDecision {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      // Try to find raw JSON
      const braceMatch = content.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        jsonStr = braceMatch[0];
      }
    }

    try {
      const parsed = JSON.parse(jsonStr);
      // Dual-mode args: an array → positional CLI args (container/synthetic);
      // a plain object → named args for an MCP tool. Keep them in separate
      // fields so every existing `decision.args` (string[]) consumer is unaffected.
      const rawArgs = parsed.args;
      const argsObject =
        rawArgs && !Array.isArray(rawArgs) && typeof rawArgs === "object"
          ? (rawArgs as Record<string, unknown>)
          : undefined;
      return {
        action: parsed.action || "complete",
        tool: parsed.tool,
        args: Array.isArray(rawArgs) ? rawArgs.map(String) : [],
        argsObject,
        reasoning: parsed.reasoning || "No reasoning provided",
        summary: parsed.summary,
        approvalReason: parsed.approvalReason,
      };
    } catch {
      // If JSON parsing fails, treat as complete with the raw text as summary
      return {
        action: "complete",
        reasoning: "Failed to parse AI response as JSON",
        summary: content.slice(0, 500),
      };
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Dispatch a synthetic (non-container) tool to its dedicated executor and
   * normalize the result into the loop's ExecutionResult shape. Always returns
   * (never throws) — a missing binding degrades to a soft exit-1 result so the
   * loop continues rather than aborting the whole run.
   */
  /**
   * Dispatch an MCP tool (`mcp::<serverId>::<toolName>`) to its server over
   * JSON-RPC and normalize the content blocks into the loop's ExecutionResult
   * shape. Same soft-fail contract as executeSyntheticTool — never throws.
   */
  private async executeMcpTool(
    toolId: string,
    args: Record<string, unknown>,
  ): Promise<ExecutionResult> {
    const fail = (stderr: string): ExecutionResult => ({ stdout: "", stderr, exitCode: 1, timedOut: false });
    const parsed = parseMcpToolId(toolId);
    if (!parsed) return fail(`Malformed MCP tool id '${toolId}'`);
    try {
      const result = await mcpInvoker.callTool(parsed.serverId, parsed.toolName, args);
      const blocks = Array.isArray((result as any).content) ? (result as any).content : [];
      const text = blocks
        .map((b: any) => (typeof b?.text === "string" ? b.text : JSON.stringify(b)))
        .join("\n");
      const isError = Boolean((result as any).isError);
      return {
        stdout: isError ? "" : text,
        stderr: isError ? text : "",
        exitCode: isError ? 1 : 0,
        timedOut: false,
      };
    } catch (e: any) {
      return fail(`MCP tool '${parsed.toolName}' error: ${e?.message || String(e)}`);
    }
  }

  private async executeSyntheticTool(toolId: string, args: string[]): Promise<ExecutionResult> {
    const fail = (stderr: string): ExecutionResult => ({ stdout: "", stderr, exitCode: 1, timedOut: false });
    try {
      if (toolId === SYNTHETIC_MSF_SEARCH) {
        const query = (args[0] || "").trim();
        if (!query) return fail("msf_search requires a search query as the first argument");
        const results = await metasploitExecutor.searchModules(query, args[1]);
        const text = (results || [])
          .slice(0, 25)
          .map(
            (m: any) =>
              `${m.type || "?"}/${m.path || m.fullPath || "?"}  [${m.rank || "unknown"}] ${m.description || ""}`,
          )
          .join("\n");
        return { stdout: text || "No modules found.", stderr: "", exitCode: 0, timedOut: false };
      }

      if (toolId === SYNTHETIC_MSF_RUN) {
        if (!this.scope?.msfToolId || !this.scope?.targetValue) {
          return fail("msf_run unavailable: no Metasploit tool / target bound to this run");
        }
        const type = (args[0] || "exploit") as any;
        const path = (args[1] || "").trim();
        if (!path) return fail("msf_run requires a module path as the second argument (after type)");
        const parameters: Record<string, string> = {};
        for (const kv of args.slice(2)) {
          const idx = kv.indexOf("=");
          if (idx > 0) parameters[kv.slice(0, idx)] = kv.slice(idx + 1);
        }
        const r = await metasploitExecutor.execute(
          this.scope.msfToolId,
          { type, path, parameters },
          this.scope.targetValue,
        );
        return {
          stdout: r.output || "",
          stderr: r.stderr || "",
          exitCode: r.success ? 0 : r.exitCode || 1,
          timedOut: false,
        };
      }

      if (toolId === SYNTHETIC_EMPIRE_TASK) {
        if (!this.scope?.empireServerId) {
          return fail(
            "empire_task unavailable: no Empire C2 server bound to this run (configure an Empire server + active agent)",
          );
        }
        const agentName = (args[0] || "").trim();
        const command = args.slice(1).join(" ").trim();
        if (!agentName || !command) return fail("empire_task requires [agentName, command...]");
        const r: any = await empireExecutor.executeTask(
          this.scope.empireServerId,
          this.scope.empireUserId || "system",
          { agentName, command },
        );
        return {
          stdout: typeof r?.output === "string" ? r.output : JSON.stringify(r ?? {}),
          stderr: typeof r?.error === "string" ? r.error : "",
          exitCode: r?.success === false ? 1 : 0,
          timedOut: false,
        };
      }

      return fail(`Unknown synthetic tool '${toolId}'`);
    } catch (e: any) {
      return fail(`Synthetic tool '${toolId}' error: ${e?.message || String(e)}`);
    }
  }

  private async getAvailableTools(): Promise<ToolInfo[]> {
    // Per-agent scope: restrict the catalog to the agent's enabledTools
    // (tool_registry rows, installed only) + the configured synthetic tools.
    // Resolution mirrors the generic path (UUID -> tool.toolId slug); executions
    // run via multiContainerExecutor which keys on the slug, so anything not in
    // tool_registry simply isn't executable here.
    if (this.scope?.enabledToolIds?.length) {
      const rows = await db
        .select()
        .from(toolRegistry)
        .where(inArray(toolRegistry.id, this.scope.enabledToolIds));
      const scoped: ToolInfo[] = rows
        .filter((r) => r.installStatus === "installed")
        .map((r) => ({
          toolId: r.toolId,
          name: r.name,
          binaryPath: r.binaryPath,
          containerName: r.containerName || "rtpi-tools",
          containerUser: r.containerUser || "rtpi-tools",
          category: String(r.category),
          version: r.version ?? null,
        }));
      // Append synthetic (MSF/Empire) tools the AI may select.
      for (const spec of this.scope.syntheticTools ?? []) {
        scoped.push({
          toolId: spec.toolId,
          name: spec.name,
          binaryPath: spec.toolId,
          containerName: "synthetic",
          containerUser: "synthetic",
          category: spec.category,
          version: null,
        });
      }
      // Append the agent's MCP tools (M1) so the autonomous loop can call them
      // through the same decision protocol.
      scoped.push(...(await this.getAgentMcpTools()));
      return scoped;
    }

    // Unscoped (autonomous loop): global catalog + the agent's MCP tools.
    const toolsByContainer = await multiContainerExecutor.listToolsByContainer();
    const allTools: ToolInfo[] = [];
    for (const tools of toolsByContainer.values()) {
      allTools.push(...tools);
    }
    allTools.push(...(await this.getAgentMcpTools()));
    return allTools;
  }

  /**
   * Discover the MCP tools available to THIS agent — the tools exposed by each
   * running MCP server attached via `agents.config` (M1). Each becomes a
   * `ToolInfo` with a `mcp::<serverId>::<toolName>` id and the tool's
   * `inputSchema` (so the model is told to pass named args). Best-effort: any
   * failure (no servers, server down, listTools error) yields [] so the loop
   * proceeds with its container/synthetic tools unchanged.
   */
  private async getAgentMcpTools(): Promise<ToolInfo[]> {
    try {
      const [agent] = await db
        .select({ config: agents.config })
        .from(agents)
        .where(eq(agents.id, this.agentId))
        .limit(1);
      if (!agent) return [];

      const serverIds = resolveAgentMcpServerIds(agent.config);
      if (serverIds.length === 0) return [];

      const rows = await Promise.all(
        serverIds.map((id) =>
          db.select().from(mcpServers).where(eq(mcpServers.id, id)).limit(1).then((r) => r[0]),
        ),
      );
      const running = rows.filter(
        (s): s is NonNullable<typeof s> => Boolean(s) && s.status === "running",
      );

      const out: ToolInfo[] = [];
      for (const server of running) {
        try {
          const tools = await mcpInvoker.listTools(server.id);
          for (const t of tools) {
            out.push({
              toolId: `${MCP_TOOL_PREFIX}${server.id}::${t.name}`,
              name: t.name,
              binaryPath: "",
              containerName: "mcp",
              containerUser: "mcp",
              category: "mcp",
              version: null,
              description: t.description,
              inputSchema: t.inputSchema,
            });
          }
        } catch (err) {
          log.warn(
            `[tool-execution-loop] MCP tool discovery failed for server ${server.name}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
      return out;
    } catch (err) {
      log.warn("[tool-execution-loop] getAgentMcpTools failed (non-fatal):", err);
      return [];
    }
  }

  private async getRelevantMemories(): Promise<SearchResult[]> {
    try {
      return await memoryService.searchMemories({
        query: this.objective,
        limit: 10,
      });
    } catch {
      return [];
    }
  }

  private needsApproval(category: string): boolean {
    if (this.constraints.autonomyLevel >= 9) return false;
    return this.constraints.requireApprovalForCategories.includes(category);
  }

  private truncateOutput(output: string): string {
    if (!output) return "";
    const maxBytes = this.constraints.maxOutputBytes;
    if (Buffer.byteLength(output) <= maxBytes) return output;
    // Truncate at character boundary
    let truncated = output;
    while (Buffer.byteLength(truncated) > maxBytes) {
      truncated = truncated.slice(0, truncated.length - 1000);
    }
    return truncated + `\n... [truncated, original ${Buffer.byteLength(output)} bytes]`;
  }

  private async emitProgress(
    iteration: number,
    toolName: string,
    result: ExecutionResult,
  ): Promise<void> {
    try {
      await agentMessageBus.sendMessage({
        messageType: "status",
        from: { agentId: this.agentId, agentRole: "tool_executor" },
        broadcastToRole: "operations_manager",
        subject: `Tool Execution: ${toolName} (iter ${iteration})`,
        content: {
          summary: `${toolName} exit=${result.exitCode}`,
          data: {
            iteration,
            toolName,
            exitCode: result.exitCode,
            outputLength: (result.stdout || "").length,
            operationId: this.operationId,
            targetId: this.targetId,
          },
        },
      });
    } catch {
      // Non-critical — don't break the loop
    }

    this.emit("iteration_complete", {
      iteration,
      toolName,
      exitCode: result.exitCode,
      agentId: this.agentId,
      operationId: this.operationId,
    });
  }

  private buildResult(
    iterations: ToolIterationResult[],
    memoryIds: string[],
    toolsUsed: string[],
    startTime: number,
    status: LoopResult["status"],
    error?: string,
    summary?: string,
  ): LoopResult {
    return {
      iterations,
      summary:
        summary ||
        `Loop ${status}: ${iterations.length} iterations, ${toolsUsed.length} tools used (${toolsUsed.join(", ")})`,
      memoryIds,
      status,
      totalDurationMs: Date.now() - startTime,
      toolsUsed,
      error,
    };
  }
}
