# Agent↔Tool Interoperability — Evaluation & Consolidation

**Status:** Phase 1 (P0) + Phase 2/3 consolidation (H2, M2, thin-adapter) landed on `RT-Mod-2-Submission`; M1 (autonomous-loop→MCP) landed on branch `feat/agent-mcp-loop-integration` · 2026-06-06. Full interop loop closed (live end-to-end verification recommended before merging M1).
**Scope:** How RTPI agents are *assigned* tools/tool-skills and how they *utilize* them at runtime.
**Method:** Static analysis + source spot-verification (every Critical/High cited to `file:line`); the critical claims were re-verified against source before fixing.

---

## 1. Verified interoperability map (as-is)

**Real execution spine (sound — keep):**
`BaseTaskAgent.runToolLoop` → `tool-execution-loop.ts:run()` →
`multiContainerExecutor.executeTool()` → `runtime/container-runtime.ts:exec()` →
`docker-executor.ts:exec()`. Honors `AgentToolScope.enabledToolIds`. Synthetic
tools branch to `metasploit-executor` / `empire-executor`.

**Parallel/legacy paths (the problem):**
- `agent-tool-connector.ts:execute()` — registry lookup (`toolRegistry` then
  `securityTools`), then either `executeWithNewFramework` (real → `tool-executor`)
  or `executeAgentWithTool`. The latter's non-Docker fallback **was** the
  fabrication site.
- MCP stdio (`mcp-invoker.ts:callTool`) — real; previously only reachable from the
  human API `agent-mcp.ts POST /agents/:id/mcp-call`.
- OffSec container CLI (`offsec-agents.ts` `docker exec node /mcp/dist/index.js`) — real, isolated.
- MCP-gRPC implant bridge (`mcp-grpc-bridge.ts:executeToolOnImplant`) — real, separate.

**Assignment sources of truth:**
- `agents.config.toolContainers[]` — authoritative MCP tool sets; written by
  `agent-mcp-connector.ts:attachAgentToMCP`.
- In-memory `agentAttachments` map — populated only at attach time.
- `agentTactics` — authoritative agent↔ATT&CK tactic (semantic; does NOT scope tools).
- **Vestigial:** `toolLibrary.compatibleAgents` (never written), `agentCapabilities` (informational).

**Skill systems (two, disjoint):** generated tool-skills (`skill-generator.ts` →
`skillPath` columns → prompt at create/`tool-skill-prompt-sync.ts`) vs bug-hunter
corpus (`knowledge_base`, `retrieveBugHunterSkills` per-iteration). General reader
`knowledge-base-reader.ts:searchKnowledge` already spans all categories.

---

## 2. Findings register

| # | Finding | Evidence | Sev | Status |
|---|---------|----------|-----|--------|
| **C1** | Connector stub branches returned **fabricated success strings** (`executeOpenAI/Anthropic/MCP/Custom`) — hallucinated tool execution reachable from the workflow orchestrator + tools API. | `agent-tool-connector.ts:549-594` (old); callers `tools.ts:425,491`, `agent-workflow-orchestrator.ts:1060` | Critical | **Fixed** — stubs deleted; non-Docker path routes to real `mcpInvoker.callTool` or **throws**. Guarded by `tests/unit/server/agent-tool-connector-no-fabrication.test.ts`. |
| **C2** | `agentAttachments` map never rehydrated → MCP assignments lost on restart. Compounded: `agentMCPConnector.start()` was **never called at boot**. | `agent-mcp-connector.ts:87,98,197`; no `start()` caller | Critical | **Fixed** — `rehydrateAttachments()` rebuilds the map from `agents.config.toolContainers`; `start()` now wired into `server/index.ts` startup (delayed, non-fatal). |
| **H1** | Tool discovery was static `inferToolsFromServerConfig`, not live `tools/list`. | `agent-mcp-connector.ts:333` | High | **Fixed** — `discoverLiveTools()` calls `mcpInvoker.listTools()` for running servers; static inference is now fallback-only. |
| **H2** | `execute()` returns `string` but `tools.ts:436` reads `.exitCode/.stdout` off it → bogus failure detection; orchestrator consumes it as a string. Callers disagree on shape. | `agent-tool-connector.ts:execute`, `tools.ts:436-439` vs `agent-workflow-orchestrator.ts:1067,1077` | High | **Fixed** — `execute()` returns the canonical `AgentToolResult` (structured fields + `formatted`); all four internal executors return it; callers updated (`tools.ts` reads fields; orchestrator reads `.formatted`). |
| **M2** | Dual tool registry (`toolRegistry` vs `securityTools`) resolved ad-hoc per call site. | `agent-tool-connector.ts:37-48`, `tools.ts` | Med | **Fixed** — single `resolveTool(toolId)` (`agents/tool-resolve.ts`) used by the connector; dispatch picks the one real executor by `source`/`installed`. |
| **M1** | Autonomous loops can't reach managed MCP-stdio tools (only the human API can). | `mcp-invoker.ts`, `tool-execution-loop.ts:getAvailableTools` | Med | **Fixed** (branch `feat/agent-mcp-loop-integration`) — the loop now discovers the agent's running-server MCP tools (`getAgentMcpTools` → `mcpInvoker.listTools`), surfaces them as `mcp::<serverId>::<toolName>` with their `inputSchema`, accepts **named (object) args** (`decision.argsObject`) for them, and dispatches to `mcpInvoker.callTool` (`executeMcpTool`, soft-fail). Static + unit tested; full end-to-end (live model emitting named args + running MCP server) still recommended before merge. |
| **L1** | "Vestigial" assignment surfaces (`toolLibrary.compatibleAgents`, `agentCapabilities`). | `schema.ts:2234,2493` | Low | **No change (verified)** — neither is a dead read in a tool-*selection* path: `compatibleAgents` is legitimate `tool_library` CRUD metadata (`offsec-rd-tools.ts`), `agentCapabilities` drives *workflow* capability matching (`dynamic-workflow-orchestrator.ts`). Removing them would break real features. Documented here so they aren't mistaken for tool-selection inputs. |
| **L2** | Skills can drift from the assigned toolset. | `tool-skill-prompt-sync.ts`, `tool-execution-loop.ts:982` | Low | **Largely already coherent (verified)** — `syncAgentPromptForToolset` → `loadAgentToolSkills(agent.config)` already derives injected skills from the agent's configured toolset (mcpServerIds/enabledTools). Remaining nicety (tactics biasing tool ordering) deferred with M1. |

---

## 3. Phase 1 — what landed (P0 correctness)

- **C1 — no more hallucination.** `executeAgentWithTool`'s non-Docker fallback no
  longer dispatches by `agent.type` into fabricating stubs. It routes
  MCP-capable agents to a **real** `executeMCP` (resolves the agent's attached
  servers via the shared `agents/mcp-resolve.ts`, finds the running server that
  owns the tool through `mcpInvoker.listTools`, invokes `mcpInvoker.callTool`),
  and otherwise **throws** a clear "no executable backend" error. No code path
  returns a synthesized success string. (`executeOpenAI/Anthropic/Custom` deleted.)
- **C2 — assignments survive restart.** New `rehydrateAttachments()` rebuilds the
  in-memory map from each `agents.config.toolContainers[]` (same shape the attach
  path writes); `agentMCPConnector.start()` is now invoked from `server/index.ts`
  so discovery + rehydration actually run on boot.
- **H1 — live discovery.** `discoverServerCapabilities` prefers
  `mcpInvoker.listTools()` for running servers; static inference is fallback-only.
- Shared helper `server/services/agents/mcp-resolve.ts` (`resolveAgentMcpServerIds`)
  now used by both the connector and `agent-mcp.ts` (de-duplicated).

**Phase 2/3 consolidation (also landed):**
- **H2 — one canonical result.** New `agents/tool-resolve.ts` defines
  `AgentToolResult` `{ success, exitCode, stdout, stderr, durationMs, formatted }`.
  `connector.execute()` and all four internal executors
  (`executeWithNewFramework`, `executeToolInDocker`, `executeMCP`,
  `executeAgentWithTool`) return it. Callers updated: `tools.ts:425,491` read
  structured fields; `agent-workflow-orchestrator.ts:1067` reads `.formatted`;
  the legacy in-connector loop takes `.formatted`.
- **M2 — single resolution.** `resolveTool(toolId)` (tool_registry → security_tools)
  in `tool-resolve.ts` replaces the ad-hoc per-call-site fallback;
  `connector.execute()` dispatches to the one real executor by `source`/`installed`.
- The connector is now effectively the **thin adapter**: resolve agent + tool +
  target → pick the real executor (tool-executor / docker / mcpInvoker) → return
  `AgentToolResult`. No independent or fabricated execution remains.

Verification: `npx tsc --noEmit` clean on all changed files; backend boots
(listening :3001, `/health` 200); regression test green (3 assertions).

---

## 4. M1 — autonomous loop reaches managed MCP tools (landed on branch)

Implemented on `feat/agent-mcp-loop-integration`. The args-model impedance
mismatch (loop = positional CLI `string[]`; MCP = named JSON object) is bridged
by a **dual-mode args** decision: `args` as an array → CLI/synthetic tools
(unchanged); `args` as an object → MCP named args, parsed into a separate
`decision.argsObject` so every existing `string[]` consumer is untouched.

1. **Catalog.** `getAgentMcpTools()` resolves the agent's attached running MCP
   servers (`resolveAgentMcpServerIds` + `mcpServers.status='running'`), lists
   each via `mcpInvoker.listTools`, and appends `ToolInfo`s with id
   `mcp::<serverId>::<toolName>`, `category: "mcp"`, and the tool's
   `inputSchema`. Called from both the scoped and unscoped `getAvailableTools`
   branches; returns `[]` (no behavior change) when the agent has no MCP servers.
2. **Presentation.** `buildSystemPrompt` adds an "MCP TOOL USAGE" block listing
   each MCP tool's schema and a rule: for `mcp::` ids, `args` MUST be a JSON
   object. `parseAIDecision` routes object-valued `args` to `argsObject`.
3. **Dispatch.** A `toolInfo.toolId.startsWith(MCP_TOOL_PREFIX)` branch at the
   executor fork calls `executeMcpTool` → `mcpInvoker.callTool`, normalized to
   `ExecutionResult` with the same soft-fail contract as synthetic tools.

Guarded by `tests/unit/server/agent-loop-mcp.test.ts` (id round-trip + wiring).
**Before merge:** exercise end-to-end with a live model (emitting named args)
against a running MCP server — the one thing static/unit checks can't cover.

**Tactics biasing tool ordering (L2 nicety)** remains a future enhancement.

---

## 5. Control plan

- **No-fabrication guard:** `tests/unit/server/agent-tool-connector-no-fabrication.test.ts`
  fails if any fictional-success literal or stub method returns to the connector.
- **C2:** after Phase-4 wiring, a unit test over `rehydrateAttachments` (pure
  `agents.config` → attachments mapping) + a boot assertion that the rehydration
  log line appears.
- **Consolidation:** a test asserting a single `resolveTool` lookup and that every
  execution path returns `AgentToolResult` + writes a `toolExecutions` row.

*Retrospective: the costliest defect was again a boundary-layer hallucination —
the transport (a function call) "succeeded" while the payload was fabricated.
The fix is the same discipline as the offsec-rd cycle: a path with no real
backend must fail loudly, never return a plausible success string.*
