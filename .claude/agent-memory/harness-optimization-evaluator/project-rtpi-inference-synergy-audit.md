---
name: rtpi-inference-synergy-audit
description: Inference routing audit 2026-06-07 — call site inventory, synergy gaps, provider mis-routing root cause, Kaizen P0/P1/P2 backlog
metadata:
  type: project
---

Comprehensive audit of all LLM inference call sites in RTPI, triggered by workflow 082f70c9 routing all calls to anthropic/claude-sonnet-4-5 despite PREFER_LOCAL_AI=true and DEFAULT_AGENT_MODEL set to an Ollama model.

**Why:** Operator cost control and deterministic local model usage for the ReadyTensor submission. PREFER_LOCAL_AI=true should be a hard pin.

**How to apply:** When evaluating inference changes, use the three-category classification: (A) resolver-path calls, (B) bypass-hardcoded calls, (C) silent-legacy calls via ollamaAIClient.complete() without provider= arg. Only Category A calls are safe from mis-routing.

---

## Root cause (3 compounding layers)
1. `agent-workflow-orchestrator.ts:173-175` — `callAgentAI()` maps `provider="auto"` → `"anthropic"` unconditionally, ignoring PREFER_LOCAL_AI and DEFAULT_AGENT_MODEL.
2. `agent-workflow-orchestrator.ts:184` — model-scrub guard `model.includes(":")` destroys every Ollama/hf.co tag before passing to complete().
3. `agent-workflow-orchestrator.ts:527` — auto-seed bakes `{provider:"anthropic", model:"claude-sonnet-4-5"}` into new agent DB rows, poisoning future reads.
4. `tool-execution-loop.ts:381` — same `|| "anthropic"` default when `aiProvider` is absent/auto.
5. `web-hacker-agent.ts:84` — DEFAULT_CONFIG.aiProvider='anthropic'; WEB_HACKER_AI_PROVIDER in .env is never read (orphaned env var).

## Inference call site inventory (as of 2026-06-07)
- **Category A (resolver-path, correct):** 20 call sites — all `routeAgent` / `routeReasoning` / `routeEmbedding` callers. Includes: bug-hunter agents, web-hacker-agent.callAI(), executive-summary-generator, agent-prompt-generator, skill-synthesizer, technical-writer-agent, vulnerability-agent, operations-manager-agent, tool-chain-proposer, tool-config-deriver, agent-tool-builder, tool-skill-prompt-sync, seven-question-gate, harness-optimization-evaluator.
- **Category B (hardcoded bypass, defective):** 7 call sites — see P0/P1 backlog below.
- **Category C (legacy ollamaAIClient.complete() without explicit provider, PARTIAL):** 7 call sites — vulnerability-ai-enrichment.ts, rd-team-agent.ts, maldev-agent.ts (x2), poc-development-agent.ts, nuclei-template-agent.ts, review-agent.ts, technical-reviewer-agent.ts, api/v1/agent-chat.ts, api/v1/operations-management.ts, api/v1/tools.ts. These PARTIALLY respect the resolver via `selectProvider()` but only when `options.provider` is absent.
- **Category D (bespoke env var, partially orphaned):** WEB_HACKER_AI_PROVIDER in .env is never read by TypeScript. agent-config.ts uses OPS_MANAGER/PAGE_REPORTER/TASK_AGENT env vars with cloud defaults.

## KPIs measured (Postgres)
- workflow_logs ai_call entries: 62 ollama / 19 anthropic (76.5% / 23.5%)
- ai_enrichment_logs: 60 anthropic / 2 ollama (anthropic dominates enrichment path)
- 082f70c9 workflow: 7/7 calls → anthropic (confirmed mis-routed)
- 7 of 11 workflow runs → ollama (many ran under older code or with specific agent configs)
- ai_enrichment_logs: 100% anthropic except 2 ollama (qwen3:14b, general enrichment type)

## Kaizen backlog (P0 first)

### P0-1: callAgentAI anthropic hardcoding
- File: `server/services/agent-workflow-orchestrator.ts:171-191`
- Fix: Replace the `provider="anthropic"` constant with `resolveAgentTargets({agentOverride: {providerId: agent.inferenceProviderId, model: config?.ai?.model}})` and pass `{provider: targets[0].provider, model: targets[0].model}` to complete(). Remove the `:` scrub guard entirely — `inferProviderFromModel` already handles hf.co/ tags.
- Verify: Run a new workflow; check workflow_logs shows provider=ollama, model=hf.co/cmndcntrlcyber/...

### P0-2: auto-seed agents anthropic bake-in
- File: `server/services/agent-workflow-orchestrator.ts:517-529`
- Fix: Remove `ai: { provider: "anthropic", model: "claude-sonnet-4-5" }` from the auto-seed insert. Leave `ai` absent or set to `{provider: "auto"}`.
- Rollback: If agent prompts degrade, re-add the field to specific agent rows via DB update.

### P0-3: ToolExecutionLoop anthropic default
- File: `server/services/agents/tool-execution-loop.ts:381-392`
- Fix: Change default from `|| "anthropic"` to `|| "auto"`. Remove the claude/gpt model-scrub. Let `ollamaAIClient.complete()` call `selectProvider()` when provider is absent.
- Verify: autonomous_tools task runs show provider=ollama in enrichment logs.

### P1-1: attack.ts hardcoded anthropic
- File: `server/api/v1/attack.ts:547-554`
- Fix: Replace with `routeReasoning({...})` — this is a one-off reasoning call for test plan generation.

### P1-2: dynamic-workflow-orchestrator wrong callAgentAI signature
- File: `server/services/dynamic-workflow-orchestrator.ts:1051-1058`
- Fix: Replace with a direct `routeAgent({agentId: agent.id, messages: [...]})` call. callAgentAI is a private method of AgentWorkflowOrchestrator and is being called with (string, string, object) not (agent, messages[], options).

### P1-3: WEB_HACKER_AI_PROVIDER orphaned env var
- File: `server/services/agents/web-hacker-agent.ts:80-87`
- Fix: Change DEFAULT_CONFIG to read `process.env.WEB_HACKER_AI_PROVIDER as 'openai' | 'anthropic' | 'ollama' || undefined`, and have callAI() pass it as explicitProvider to routeAgent().

### P2-1: config/agent-config.ts provider type union
- File: `server/config/agent-config.ts:8`
- Fix: Expand `"openai" | "anthropic"` to include `"ollama" | "auto"` so operators can pin local providers via env vars.

### P2-2: colon-scrub heuristic in orchestrator (cross-cutting hazard)
- The guard `model.includes(":")` at orchestrator:184 and tool-execution-loop:388-392 was intended to strip Ollama tags from cloud-bound calls but is applied pre-routing, destroying any hf.co/Ollama tag even for local targets. Fix: move model validation to inside callProvider() where the provider identity is known.

## Schema gap
All 32 agent rows have NULL `config.ai` and NULL `inference_provider_id`. The model is stored at `config.model` (top-level) but `getAgentAIConfig` reads `config?.ai.model` — the top-level model is invisible to the inference path.

[[rtpi-inference-synergy-audit-file-refs]]
