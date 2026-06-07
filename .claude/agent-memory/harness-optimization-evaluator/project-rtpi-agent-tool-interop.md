---
name: rtpi-agent-tool-interop
description: Agent↔tool interoperability evaluation for RTPI (2026-06-06) — verified execution paths, stub branches, in-memory divergence, skill coherence gaps, and prioritized roadmap
metadata:
  type: project
---

Evaluation of RTPI agent↔tool assignment and utilization interoperability, completed 2026-06-06.

**Why:** User requested a READ-ONLY evaluation to produce a prioritized roadmap for making "tools and agents interoperate as intended."

**How to apply:** Use this as a baseline for the next kaizen cycle; verify P0 fixes by re-running interop checks against the specific call sites noted.

## Verified execution paths

- PRIMARY (working): `ToolExecutionLoop` → `multiContainerExecutor` → `containerRuntime`. Scoped by `AgentToolScope.enabledToolIds` from `agent.config.enabledTools`. Used by `runScopedAttackTree` and `base-task-agent.runToolLoop`.
- SECONDARY (working for new-registry tools): `tool-executor.ts:executeTool()` → `containerRuntime`. Self-heals via SKILL.md deriver. Records to `toolExecutions`.
- LEGACY/BROKEN: `AgentToolConnector.executeAgentWithTool()` stub branches — `executeOpenAI`, `executeAnthropic`, `executeCustom`, `executeMCP` all return hardcoded fictional strings. Reached via `tools.ts:425/491` and `agent-workflow-orchestrator.ts:1060`.
- MCP stdio (working): `mcp-invoker.callTool()` via `POST /:agentId/mcp-call` API. Not connected to autonomous loops.
- OffSec one-shot CLI (working but isolated): `docker exec <container> node /mcp/dist/index.js --execute-tool`. Per-call process spawn; not connected to toolRegistry or skills.
- MCP-gRPC bridge (working when bridge active): `mcp-grpc-bridge.executeToolOnImplant()`. Separate telemetry.

## Critical defects (P0)

1. `agentMCPConnector.agentAttachments` in-memory map NEVER rehydrated from DB on restart. `start()` at `agent-mcp-connector.ts:98` only calls `discoverAllServerCapabilities()`, not a DB query for existing agent attachments. After restart, all `getAgentTools(agentId)` calls return empty.
2. `AgentToolConnector` legacy stub branches return fabricated success strings — CONFIRMED hallucinated success. The `executeMCP` branch even reads the MCP server status from DB before discarding the result and returning a hardcoded string (`"MCP server processing complete."`).
3. `discoverServerCapabilities()` uses static keyword matching on server command/name strings (`inferToolsFromServerConfig`), NOT real `mcpInvoker.listTools()`. Returns hardcoded tool schemas for Tavily/Filesystem/GitHub/Nuclei patterns; generic stubs for unknowns.

## Skill coherence gaps

- `createBugHunterToolLoop` (`bug-hunter-tool-loop.ts:117`) passes NO `AgentToolScope` → loop uses global tool catalog + no `## Tool Skills` in system prompt.
- `executeAutonomousToolLoop` in orchestrator (`agent-workflow-orchestrator.ts:2226`) also passes no scope.
- `base-task-agent.runToolLoop()` (`base-task-agent.ts:211`) passes no scope.
- No boot-time sweep for agents with stale prompts lacking `## Tool Skills`.

## Vestigial surfaces (never consulted at runtime for tool selection)

- `agentTactics` table: UI-only, ATT&CK mapping, never filters tool catalog.
- `toolLibrary.compatibleAgents`: written by offsec-rd-tools API and sync script; never read for execution routing.
- `agentCapabilities` table: used only for hardware validation (`agent-tool-validator.ts`), not for tool authorization.

## Key file:line references

- In-memory map: `agent-mcp-connector.ts:87`
- Stub branches: `agent-tool-connector.ts:549–594`
- Static inference: `agent-mcp-connector.ts:313`
- Scope-restricted catalog: `tool-execution-loop.ts:982–1025`
- Bug-hunter no-scope: `bug-hunter-tool-loop.ts:117–128`
- Orchestrator no-scope: `agent-workflow-orchestrator.ts:2226`
- Skill sync trigger: `agents.ts:toolsetChanged`, `tool-skill-prompt-sync.ts:368`

See [[rtpi-harness-state]] for broader baseline context.
