# RTPI Harness Optimization Plan

## Overview

This document synthesizes patterns from 23 external repositories, papers, and guides into a concrete optimization plan for the rtpi platform, prioritizing the reduction of wasteful interactions and the following features:

1. **Accuracy to intent** — the agent faithfully executes what the user means
2. **Knowledge storage-retrieval efficiency** — memory that retains, recalls, and reflects
3. **J-Space flexibility** — joint reasoning/judgment space for multi-tier decision making
4. **Elegant adaptability → persistent characterization** — behavioral profiles that evolve across sessions

---

## Implementation Summary

**Status: ALL 21 ITEMS COMPLETE** — 104 unit tests passing, 0 regressions, 0 TypeScript errors.

| Phase | Items | Status | Feature Flags |
|-------|-------|--------|---------------|
| 1. Intent Accuracy | 4/4 | DONE | `FF_INTENT_ACCURACY_ENGINE` |
| 2. Knowledge Storage | 4/4 | DONE | `FF_MEMORY_ROUTER` |
| 3. J-Space Flexibility | 4/4 | DONE | `FF_JUDGMENT_SPACE` |
| 4. Persistent Characterization | 4/4 | DONE | `FF_AGENT_PERSONAS`, `FF_SKILL_SELF_IMPROVEMENT`, `FF_CROSS_SESSION_LEARNING` |
| 5. Loop Engineering | 5/5 | DONE | `FF_LOOP_ENGINEERING` |

All features are opt-in (flags default to `false`). Enable in `.env` and restart the backend.
After enabling `FF_AGENT_PERSONAS`, run `npm run db:push` and `npx tsx server/scripts/data/seed-personas.ts`.

---

## Implementation Status

### Phase 1: Intent Accuracy Engine

**Goal:** Reduce wasted agent cycles by ensuring the agent understands and faithfully executes user intent before committing resources.

**Sources:** [Hermes Agent] (learning loop), [VVAH] (deterministic voting, threat-modeling-before-analysis), [HarnessAgent] (compilation-error triage), [Learn Harness Engineering] (closed-loop verification, premature victory prevention), [NeuroSploit] (deterministic probe-before-model), [Aikido] (independent validation stages)

#### 1.1 Deterministic Probe Before Model (P0)

**Pattern from:** NeuroSploit's deterministic HTTP probe, VVAH's threat-modeling-before-analysis

Before the LLM reasons about a target, the harness runs a deterministic evidence-gathering probe — real request/response analysis (status codes, security headers, cookie flags, CORS, tech fingerprint, JS endpoints, 404 baseline) — and feeds observed facts into the agent context. This grounds agent decisions in evidence, not hallucination.

**Current state:** `tool-execution-loop.ts` sends raw tool output back to the LLM. No pre-reasoning evidence collection exists.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Create `DeterministicProbe` service that runs HTTP probes, port scans, and DNS lookups before agent reasoning begins | `server/services/agents/deterministic-probe.ts` | DONE |
| Integrate probe results into `agent-prompt-generator.ts` as a `## Ground Truth` section | `server/services/agent-prompt-generator.ts` | DONE |
| Add probe cache (keyed by target+probe-type, TTL 15m) to avoid redundant network calls | `server/services/agents/probe-cache.ts` | DONE |
| Wire into `tool-execution-loop.ts` — probe runs once before the first LLM iteration | `server/services/agents/tool-execution-loop.ts` | DONE |

#### 1.2 Compilation-Error Triage (P0)

**Pattern from:** HarnessAgent's error classification and routing

When tool execution fails, classify the error type (timeout, auth, config, runtime, network) and route to the appropriate fix action instead of blindly retrying or sending raw error text to the LLM.

**Current state:** `tool-execution-loop.ts` passes raw stderr/stdout back. The LLM wastes iterations guessing at error causes.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Create `ErrorTriageClassifier` with categories: `timeout`, `auth`, `missing_dep`, `config`, `runtime`, `network`, `permission` | `server/services/agents/error-triage.ts` | DONE |
| Build fix-action registry mapping error class to deterministic fix (retry with backoff, install dep, escalate to user) | `server/services/agents/error-triage.ts` | DONE |
| Integrate into `tool-execution-loop.ts` — classify before feeding back to LLM, attach structured error context | `server/services/agents/tool-execution-loop.ts` | DONE |
| Add `triageAttempts` counter to `LoopConstraints` to cap error-fix cycles (default: 3) | `server/services/agents/tool-execution-loop.ts` | DONE |

#### 1.3 Anti-Premature-Victory Gate (P1)

**Pattern from:** Learn Harness Engineering (preventing premature victory declaration), T3MP3ST (evidence vault with anti-fitting guard)

Agents must not declare "task complete" without evidence. The harness enforces a verification gate: the agent's completion claim is checked against structured evidence (tool output, findings list, coverage metrics) before the workflow advances.

**Current state:** `autonomous-operation-orchestrator.ts` has a QA phase (up to 3 iterations), but agents in `tool-execution-loop.ts` can exit the loop by returning a completion message with no structured verification.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Define `CompletionEvidence` schema: `{ findings: Finding[], toolsRun: string[], coverageMetrics: object, evidenceHashes: string[] }` | `shared/types/completion-evidence.ts` | DONE |
| Add `validateCompletion()` to `tool-execution-loop.ts` — rejects exits without minimum evidence thresholds | `server/services/agents/tool-execution-loop.ts` | DONE |
| Integrate with `tool-evidence.ts` (already gated by `FF_REQUIRE_TOOL_EVIDENCE`) to strengthen the existing evidence assessment | `server/services/tool-evidence.ts` | DONE |
| Add a "contrarian reviewer" micro-agent that challenges completion claims (reuse `technical-reviewer-agent.ts` pattern) | `server/services/agents/completion-reviewer.ts` | DONE |

#### 1.4 Multi-Agent Deterministic Voting (P1)

**Pattern from:** VVAH (multi-agent voting), Aikido (independent validation stages)

For high-stakes decisions (severity ratings, exploit viability, remediation priority), run N independent agents and aggregate via deterministic voting rather than trusting a single LLM call.

**Current state:** `technical-reviewer-agent.ts` provides a single contrarian review. No multi-voter pattern exists.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Create `VotingPanel` service: spawns N agents with identical context but independent prompts, collects structured votes | `server/services/agents/voting-panel.ts` | DONE |
| Define vote schema per decision type (severity: CVSS scores, viability: boolean + confidence, priority: ranked list) | `shared/types/voting-types.ts` | DONE |
| Aggregation logic: majority vote for categorical, median for numerical, unanimous required for "safe to exploit" | `server/services/agents/voting-panel.ts` | DONE |
| Wire into `agent-workflow-orchestrator.ts` at attack-tree decision points | `server/services/agent-workflow-orchestrator.ts` | DONE |

---

### Phase 2: Knowledge Storage-Retrieval Overhaul

**Goal:** Unify the three memory subsystems (native memory service, Mem0 sidecar, knowledge base) into a coherent state-management layer with efficient retrieval and cross-task transfer.

**Sources:** [Code-as-Harness] (memory as unified state-management layer, 5 memory tiers), [ECC] (memory persistence hooks, harness optimizer), [Sentinel AI Offensive] (persistent memory + compliance), [Awesome Harness Engineering] (COALA three-tier: procedural/semantic/episodic), [Hermes Agent] (FTS5 session search, nudge-based memory curation)

#### 2.1 Unified Memory Router (P0)

**Pattern from:** Code-as-Harness (memory as unified state-management layer)

The paper identifies five memory tiers that must coordinate: working memory (active context), semantic memory (repository evidence), experiential memory (cross-task transfer), long-term memory (validated knowledge), and multi-agent memory (shared state). RTPI has these scattered across `memory-service.ts`, `mem0-api-client.ts`, and `knowledge-base-reader.ts`.

**Current state:** Three independent systems with no unified query interface. Agents must know which subsystem to call.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Create `MemoryRouter` that accepts a single `query(text, scope, tier?)` call and fans out to all subsystems in parallel | `server/services/memory/memory-router.ts` | DONE |
| Rank/merge results by relevance score across subsystems using reciprocal rank fusion | `server/services/memory/memory-router.ts` | DONE |
| Write adapter interfaces for each backend: `NativeMemoryAdapter`, `Mem0Adapter`, `KnowledgeBaseAdapter` | `server/services/memory/adapters/` | DONE |
| Migrate all agent memory calls (`base-task-agent.ts`, `tool-execution-loop.ts`) to use the router | `server/services/agents/base-task-agent.ts` | DONE |
| Add `memory_source` field to responses so agents know provenance | `shared/types/memory-types.ts` | DONE |

#### 2.2 Experiential Memory with Cross-Task Transfer (P0)

**Pattern from:** Hermes Agent (skill creation from experience), Code-as-Harness (experiential memory), ECC (memory persistence hooks)

When an agent completes a task successfully, extract transferable lessons (what worked, what failed, which tool chains were effective) and store them as experiential memories that future agents can retrieve for similar tasks.

**Current state:** `memoryEntries` supports `memoryType: 'pattern'` and `'procedure'` but nothing writes experiential summaries post-task. The bug-hunter pipeline has no feedback loop.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Create `ExperienceExtractor` — post-task hook that summarizes: tools used, findings quality, iteration count, error patterns, successful chains | `server/services/memory/experience-extractor.ts` | DONE |
| Define `ExperientialMemory` schema: `{ taskType, targetType, toolChain, outcome, lessonsLearned, confidence, embedding }` | `shared/types/memory-types.ts` | DONE |
| Wire as a post-completion hook in `tool-execution-loop.ts` and `autonomous-operation-orchestrator.ts` | Multiple files | DONE |
| Add retrieval path: before starting a new task, query experiential memories for similar `(taskType, targetType)` pairs | `server/services/agents/tool-execution-loop.ts` | DONE |
| Implement decay function: reduce relevance score of experiential memories that haven't been accessed in 30+ days | `server/services/memory/memory-router.ts` | DONE |

#### 2.3 Memory Nudge System (P1)

**Pattern from:** Hermes Agent (periodic nudges for memory curation), Sentinel AI (persistent memory with regulatory compliance)

Instead of storing everything, the harness periodically prompts the agent to decide what's worth remembering. This keeps memory lean and high-signal.

**Current state:** `memoryEntries` has a `relevanceScore` field but no curation mechanism. Memory grows unbounded until the 1000-per-context cap in `mem0-config.ts`.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Create `MemoryNudger` that fires every N iterations during a long-running task, asking the agent: "What from the last N steps is worth remembering?" | `server/services/memory/memory-nudger.ts` | DONE |
| Agent responds with structured `NudgeResponse`: `{ store: MemoryEntry[], forget: string[], update: {id, newRelevance}[] }` | `shared/types/memory-types.ts` | DONE |
| Integrate nudge cycle into `tool-execution-loop.ts` (every 5 iterations) and `autonomous-operation-orchestrator.ts` (between phases) | Multiple files | DONE |
| Add compliance tags per Sentinel AI pattern: `{ pii: boolean, classification: 'public'|'internal'|'confidential', retention: days }` | `shared/schema.ts` (memoryEntries) | DONE |

#### 2.4 Knowledge Base Search Optimization (P2)

**Pattern from:** Arsenal-NG (search-first UX), CyberStrike (zero context pollution)

**Current state:** `knowledge-base-reader.ts` uses a three-tier fallback (embedding cosine -> full-text tsvector -> ILIKE substring). This works but can return noisy results that pollute agent context.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Add category-scoped search: pass `category` filter to avoid cross-domain noise (e.g., bug_hunter skills shouldn't return CTI feeds) | `server/services/knowledge/knowledge-base-reader.ts` | DONE |
| Implement result re-ranking: after retrieval, score results against the agent's current task context using a lightweight LLM call | `server/services/knowledge/knowledge-base-reader.ts` | DONE |
| Add `maxTokens` budget to search results — truncate/summarize to fit within the agent's context window budget | `server/services/knowledge/knowledge-base-reader.ts` | DONE |
| Lazy-load skill content per CyberStrike pattern: return skill summaries first, full content only when the agent requests it | `server/services/skills/skill-loader.ts` | DONE |

---

### Phase 3: J-Space Flexibility

**Goal:** Implement a joint reasoning/judgment space that enables multi-tier decision making, interpretability monitoring, and controlled steering of agent behavior.

**Sources:** [J-Space research] (J-lens interpretability, joint policy spaces), [Neuronpedia] (SAE interpretability, feature steering), [VVAH] (Mean Time to Adapt), [Aikido] (harness > model, multi-agent review)

#### 3.1 Judgment Space Abstraction (P0)

**Pattern from:** J-Space research (low-dimensional verbalizable bottleneck mediating multi-step reasoning)

Anthropic's J-Space research reveals that LLMs maintain an internal "workspace" of active concepts that mediate reasoning. While we can't directly inspect Claude's J-Space via API, we can implement an **external analog**: a structured judgment space where agent reasoning state is made explicit, inspectable, and steerable.

**Current state:** Agent reasoning is opaque — the LLM's chain-of-thought is consumed but not structured or stored. No mechanism exists to inspect, compare, or steer agent judgment mid-task.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Define `JudgmentState` schema: `{ activeHypotheses: Hypothesis[], confidenceVector: number[], decisionHistory: Decision[], activeConstraints: string[], reasoningTrace: string[] }` | `shared/types/judgment-types.ts` | DONE |
| Create `JudgmentSpace` service that maintains per-agent judgment state, updated after each LLM call by parsing structured output | `server/services/judgment/judgment-space.ts` | DONE |
| Add judgment state serialization/deserialization for persistence across agent restarts | `server/services/judgment/judgment-space.ts` | DONE |
| Expose judgment state via WebSocket (`agent-websocket-manager.ts`) for real-time monitoring dashboard | `server/services/agent-websocket-manager.ts` | DONE |
| Create `JudgmentLens` — a read-only view that decodes the active judgment state into human-readable summaries | `server/services/judgment/judgment-lens.ts` | DONE |

#### 3.2 Multi-Tier Arbitration (P0)

**Pattern from:** J-Space (supervisor inspects mid-inference), Aikido (independent validation stages), zsec (revalidation patterns)

Implement a tiered decision architecture where low-confidence or high-impact decisions are automatically escalated to a higher-tier arbiter (stronger model, human-in-the-loop, or voting panel).

**Current state:** `agent-websocket-manager.ts` supports human-in-the-loop approval gates. `AutonomyLevel` (1-10) exists in `distributed-workflow-orchestrator.ts`. But there's no automatic escalation based on confidence or impact.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Define escalation policy: `{ confidenceThreshold: number, impactCategories: string[], escalationTarget: 'stronger_model' | 'voting_panel' | 'human' }` | `server/services/judgment/escalation-policy.ts` | DONE |
| Create `Arbiter` service that intercepts agent decisions, evaluates against escalation policy, and routes accordingly | `server/services/judgment/arbiter.ts` | DONE |
| Integrate with `AutonomyLevel` — levels 1-3 require human approval for all decisions, 4-7 escalate only high-impact, 8-10 autonomous | `server/services/judgment/arbiter.ts` | DONE |
| Wire arbiter into `tool-execution-loop.ts` decision points (tool selection, finding severity assignment, exploitation decisions) | `server/services/agents/tool-execution-loop.ts` | DONE |
| Log all escalation events to `harness_evaluations` for retrospective analysis | `server/services/judgment/arbiter.ts` | DONE |

#### 3.3 Reasoning Trace Analytics (P1)

**Pattern from:** Neuronpedia (interpretability platform), Awesome Harness Engineering (5 recurring architectural dimensions)

Capture and analyze agent reasoning traces to identify systematic failure patterns, reasoning shortcuts, and optimization opportunities.

**Current state:** `agentConversations` stores raw messages but no structured reasoning trace. `harness-optimization-evaluator.ts` runs post-hoc DMAIC analysis but lacks per-decision granularity.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Instrument `tool-execution-loop.ts` to emit structured `ReasoningEvent` records: `{ step, hypothesis, toolSelected, toolOutput, conclusion, confidence, durationMs }` | `server/services/judgment/reasoning-trace.ts` | DONE |
| Store reasoning traces in a new `reasoning_traces` table (indexed by workflow + agent + step) | `shared/schema.ts` | DONE |
| Create aggregate analytics: avg iterations to finding, tool selection accuracy, false-positive rate by agent type | `server/services/judgment/trace-analytics.ts` | DONE |
| Feed analytics into `harness-optimization-evaluator.ts` to enrich DMAIC reports with per-decision metrics | `server/services/harness-optimization-evaluator.ts` | DONE |

#### 3.4 Controlled Steering Interface (P2)

**Pattern from:** Neuronpedia (feature steering), J-Space (read/write instrument for interventions)

Allow operators to steer agent behavior mid-task by modifying the judgment state — injecting constraints, boosting/suppressing hypotheses, or overriding confidence scores.

**Current state:** No mid-task steering exists. The only intervention is approve/deny via WebSocket.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Add `steer()` method to `JudgmentSpace`: accepts `SteeringDirective` (inject constraint, boost hypothesis, override confidence, force tool) | `server/services/judgment/judgment-space.ts` | DONE |
| Expose steering via API: `POST /api/v1/agent-workflows/:id/steer` | `server/api/v1/agent-workflows.ts` | DONE |
| Expose steering via WebSocket for real-time operator intervention | `server/services/agent-websocket-manager.ts` | DONE |
| Add steering audit trail — all directives logged with operator ID, timestamp, and effect on subsequent decisions | `shared/schema.ts` (new `steering_directives` table) | DONE |

---

### Phase 4: Persistent Characterization

**Goal:** Build behavioral profiles that evolve across sessions, enabling agents to develop domain expertise and consistent personas over time.

**Sources:** [Hermes Agent] (SOUL.md persona, Honcho dialectic user modeling, skills self-improve), [CyberStrike] (intelligence layer, 13+ domain-specialized agents), [Loop Engineering] (memory as durable spine outside any conversation), [ECC] (continuous learning, harness optimizer)

#### 4.1 Agent Persona Profiles (P0)

**Pattern from:** Hermes Agent (SOUL.md persona), CyberStrike (domain-specialized agents with methodology-driven behavior)

Each agent type should have a persistent persona profile that defines its methodology, expertise areas, behavioral constraints, and accumulated domain knowledge. This goes beyond the current `agents` table's static configuration.

**Current state:** Agent behavior is defined by system prompts generated in `agent-prompt-generator.ts` and static config in `agent-config.ts`. No persistent evolving persona exists.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Define `AgentPersona` schema: `{ agentType, methodology, expertiseDomains[], behavioralConstraints[], knownWeaknesses[], performanceHistory: { taskType: metrics }[] }` | `shared/types/agent-persona.ts` | DONE |
| Create `persona_profiles` table for persistent storage | `shared/schema.ts` | DONE |
| Create `PersonaManager` service: load persona on agent init, update post-task based on performance | `server/services/agents/persona-manager.ts` | DONE |
| Integrate persona into prompt generation: `agent-prompt-generator.ts` injects persona context into system prompts | `server/services/agent-prompt-generator.ts` | DONE |
| Seed initial personas for existing agent types (bug-hunter pipeline, technical-reviewer, qa-agent, etc.) | `server/scripts/data/seed-personas.ts` | DONE |

#### 4.2 Skill Self-Improvement (P1)

**Pattern from:** Hermes Agent (skills self-improve during use), ECC (continuous learning), CyberStrike (intelligence layer that teaches models security)

After using a skill (SKILL.md), the agent evaluates whether the skill's instructions led to success or failure. Failed skill applications generate improvement proposals; successful ones reinforce the skill's confidence score.

**Current state:** `skill-generator.ts` creates SKILL.md files from Tavily research + LLM synthesis. Once generated, skills are static. No feedback loop exists.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Add `skill_usage_log` table: `{ skillPath, agentId, taskId, outcome: 'success'|'partial'|'failure', feedbackText, timestamp }` | `shared/schema.ts` | DONE |
| Create `SkillFeedbackCollector` — post-task hook that asks the agent to rate skill usefulness and suggest improvements | `server/services/skills/skill-feedback.ts` | DONE |
| Create `SkillImprover` — periodic job that reviews feedback, generates improvement proposals, applies approved changes | `server/services/skills/skill-improver.ts` | DONE |
| Add skill versioning: keep history of skill content changes with associated performance metrics | `server/services/skills/skill-loader.ts` | DONE |
| Gate behind `FF_SKILL_SELF_IMPROVEMENT` feature flag | `shared/feature-flags.ts` | DONE |

#### 4.3 Cross-Session Learning (P1)

**Pattern from:** Hermes Agent (FTS5 session search, cross-session recall), Loop Engineering (durable spine outside any conversation)

Enable agents to search and learn from past sessions — not just stored memories, but full operational context including what was tried, what failed, and why.

**Current state:** `agentConversations` stores per-session messages. `memoryEntries` stores curated facts. No cross-session search exists.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Create `SessionIndex` service: indexes completed sessions with metadata (target type, tools used, findings count, outcome) | `server/services/memory/session-index.ts` | DONE |
| Add full-text search over session summaries (generated post-completion by LLM summarization) | `server/services/memory/session-index.ts` | DONE |
| Wire into pre-task retrieval: "Have I (or another agent of my type) seen a target like this before?" | `server/services/agents/base-task-agent.ts` | DONE |
| Add `session_summaries` table with tsvector index | `shared/schema.ts` | DONE |

#### 4.4 Behavioral Drift Detection (P2)

**Pattern from:** VVAH (Mean Time to Adapt), ECC (harness audit)

Monitor agent behavior over time to detect drift — changes in tool selection patterns, finding quality, iteration counts, or false-positive rates that indicate degradation or model updates.

**Current state:** `harness-optimization-evaluator.ts` runs post-hoc DMAIC but doesn't track behavioral trends over time.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Create `BehaviorBaseline` — statistical baseline per agent type: avg iterations, tool distribution, finding quality distribution | `server/services/agents/behavior-baseline.ts` | DONE |
| Create `DriftDetector` — compares recent N runs against baseline, alerts when metrics diverge beyond 2 sigma | `server/services/agents/drift-detector.ts` | DONE |
| Integrate drift alerts into the harness evaluation retrospective | `server/services/harness-optimization-evaluator.ts` | DONE |
| Expose drift metrics via `GET /api/v1/harness-evaluations/drift` | `server/api/v1/harness-evaluations.ts` | DONE |

---

### Phase 5: Loop Engineering Integration

**Goal:** Transform the harness from request-response agent invocations into self-sustaining loops with maker/checker splits, stage-specific context framing, and operational safety controls.

**Sources:** [Loop Engineering] (5 building blocks + Memory, maker/checker split, operating safety), [Aikido] (8 cheap agents > 1 expensive, recon/hunt/validate/trace/dedup), [zsec] (stage-specific context framing, revalidation), [Harness patterns] (6 architecture patterns), [Harness Engineering Guide] (first principles to production)

#### 5.1 Stage-Specific Context Framing (P0)

**Pattern from:** zsec (each stage receives only the context it needs), Aikido (recon/hunt/validate/trace/dedup pipeline)

Each stage in a multi-agent pipeline should receive a context frame tailored to its role. The mapping stage gets codebase structure. The hunting stage gets attack surface. The validation stage gets the finding to disprove. No stage sees the full conversation history of prior stages.

**Current state:** `agent-workflow-orchestrator.ts` passes full attack tree context to each child agent. `agent-message-bus.ts` passes `memoryContext` with `relevantMemories` but doesn't scope by stage role.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Define `StageContextFrame` per workflow stage: what input it receives, what output it produces, what it must NOT see | `server/services/agents/stage-context-frames.ts` | DONE |
| Create `ContextFramer` service that builds the minimal context for each stage from the full workflow state | `server/services/agents/context-framer.ts` | DONE |
| Apply to bug-hunter pipeline: scope-agent gets target metadata only; hunt-agent gets attack surface; validate-agent gets single finding + evidence to disprove | `server/services/agents/bug-hunter/` | DONE |
| Apply to autonomous-operation-orchestrator: each phase gets prior phase output + relevant memories, not full history | `server/services/autonomous-operation-orchestrator.ts` | DONE |
| Measure context size reduction and correlation with finding quality | Metrics in `harness-optimization-evaluator.ts` | DONE |

#### 5.2 Maker/Checker Split (P0)

**Pattern from:** Loop Engineering (maker/checker split as core primitive), Aikido (generation followed by independent validation)

Every agent output that affects system state (findings, exploitation decisions, remediation recommendations) must pass through an independent checker that has no access to the maker's reasoning, only its output and the raw evidence.

**Current state:** `technical-reviewer-agent.ts` provides contrarian review but sees the full operation context including the maker's reasoning. The producer-reviewer pattern from [Harness] is not implemented.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Create `MakerCheckerGate` — generic middleware that interposes between any maker agent and its downstream consumer | `server/services/agents/maker-checker-gate.ts` | DONE |
| Checker receives: maker's output + raw tool evidence. Does NOT receive: maker's reasoning, conversation history, or confidence scores | `server/services/agents/maker-checker-gate.ts` | DONE |
| Checker outputs: `{ verdict: 'confirmed'|'rejected'|'needs_revision', reason, suggestedFix? }` | `shared/types/maker-checker.ts` | DONE |
| Wire into bug-hunter: hunt-agent (maker) -> validate-agent (checker); capture-agent (maker) -> bug-report-agent (checker) | `server/services/agents/bug-hunter/` | DONE |
| Wire into tool-execution-loop: finding extraction (maker) -> finding validation (checker) before persisting to DB | `server/services/agents/tool-execution-loop.ts` | DONE |

#### 5.3 Multi-Agent Economy: Cheap Agents Over Expensive Ones (P1)

**Pattern from:** Aikido ("8 GPT-5.4-mini agents outperform 1 GPT-5.5 agent at the same cost"), CyberStrike (13+ specialized agents), Loop Engineering (sub-agents as building block)

Use many cheap, specialized agents in parallel rather than one expensive generalist. The inference router already supports model routing per agent — extend this to allow the orchestrator to dynamically spawn lightweight agents.

**Current state:** `inference-router.ts` resolves models per agent config. `dynamic-workflow-orchestrator.ts` supports capability-based agent matching. But the orchestrator doesn't optimize for cost — it uses the same model tier for all agents.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Add `costTier` to agent config: `'fast'` (small model, high parallelism), `'standard'` (default), `'deep'` (large model, sequential) | `shared/types/agent-config.ts` | DONE |
| Create `AgentBudgetPlanner` — given a task budget (tokens or $), plans the optimal agent mix (e.g., 8 fast hunters + 1 deep validator) | `server/services/agents/budget-planner.ts` | DONE |
| Update `inference-router.ts` resolver to map `costTier` to specific model presets | `server/services/inference/resolver.ts` | DONE |
| Add parallel agent spawning to `agent-workflow-orchestrator.ts` for fan-out/fan-in attack tree branches | `server/services/agent-workflow-orchestrator.ts` | DONE |
| Track cost-per-finding metric in harness evaluations | `server/services/harness-optimization-evaluator.ts` | DONE |

#### 5.4 Loop Safety Controls (P1)

**Pattern from:** Loop Engineering (operating safety, failure modes, anti-patterns), T3MP3ST (evidence vault, kill switches), Harness Engineering Guide (error handling, checkpoint/resume)

Production loops need: cost caps, iteration limits, kill switches, checkpoint/resume, and dead-loop detection.

**Current state:** `LoopConstraints` in `tool-execution-loop.ts` has `maxIterations` and `maxDurationMs`. `distributed-workflow-orchestrator.ts` has kill switches and forbidden commands. But there's no cost tracking, dead-loop detection, or checkpoint/resume.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Add `tokenBudget` and `costBudget` to `LoopConstraints` — loop exits when budget exhausted | `server/services/agents/tool-execution-loop.ts` | DONE |
| Implement dead-loop detection: if the last N iterations produced no new findings and used the same tools, force exit with diagnostic | `server/services/agents/tool-execution-loop.ts` | DONE |
| Add checkpoint/resume: serialize loop state (iteration, findings, tool history) every N iterations to DB | `server/services/agents/loop-checkpoint.ts` | DONE |
| Create `LoopMonitor` dashboard data: active loops, iteration counts, token spend, findings rate, estimated completion | `server/api/v1/agent-loops.ts` | DONE |
| Implement graceful degradation per Harness Engineering Guide: on repeated failures, reduce autonomy level rather than hard-stopping | `server/services/agents/tool-execution-loop.ts` | DONE |

#### 5.5 Revalidation Patterns (P2)

**Pattern from:** zsec (revalidation skill — `true_positive`, `false_positive`, `already_fixed`, `uncertain`), VVAH (multi-stage validation pipeline)

Findings should be revalidated against git history, previous scan results, and the current state of the target before being reported.

**Current state:** `validate-agent.ts` in the bug-hunter pipeline validates findings but doesn't check git history or previous scans.

**Implementation:**

| Task | File | Status |
|------|------|--------|
| Create `Revalidator` service with verdicts: `true_positive`, `false_positive`, `already_fixed`, `duplicate`, `uncertain` | `server/services/agents/revalidator.ts` | DONE |
| Check findings against git history (was this code recently changed? was a fix committed?) | `server/services/agents/revalidator.ts` | DONE |
| Check findings against previous scan results (is this a known finding from a prior operation?) | `server/services/agents/revalidator.ts` | DONE |
| Deduplicate findings that share the same root cause (per Aikido dedup stage) | `server/services/agents/revalidator.ts` | DONE |
| Wire revalidator as the final gate before findings are persisted to `vulnerabilities` table | `server/services/agents/bug-hunter/` | DONE |

---

## Research Sources

| Source | Key Patterns Extracted |
|--------|----------------------|
| [Hermes Agent](https://github.com/NousResearch/hermes-agent) | Self-improving learning loop, SOUL.md persona, skill creation from experience, FTS5 session search with LLM summarization, Honcho dialectic user modeling, periodic memory nudges, skills self-improve during use |
| [OpenHarness](https://github.com/HKUDS/OpenHarness) | 10-subsystem architecture (Agent Loop, Toolkit, Context & Memory, Governance, Swarm Coordination), permission modes, on-demand skill loading (.md), plugin ecosystem (skills + hooks + agents), MEMORY.md persistent memory |
| [VVAH](https://github.com/visa/visa-vulnerability-agentic-harness) | Multi-agent deterministic voting, threat-modeling-before-analysis, composable reusable skills per pipeline stage, SARIF emission, semantic dedup, Mean Time to Adapt metric |
| [Harness](https://github.com/revfactory/harness) | 6 architecture patterns (Pipeline, Fan-out/Fan-in, Expert Pool, Producer-Reviewer, Supervisor, Hierarchical), auto-generates skills with Progressive Disclosure, inter-agent data passing |
| [Loop Engineering](https://github.com/cobusgreyling/loop-engineering) | Five building blocks (Automations, Worktrees, Skills, Plugins/Connectors, Sub-agents) + Memory as durable spine, maker/checker split, failure mode catalog, anti-pattern registry, multi-loop coordination, cost/logging/kill guidance |
| [ECC](https://github.com/affaan-m/ecc) | Harness-native operator system, continuous learning, memory optimization, harness audit skill, loop-start/loop-status, quality-gate, model-route by complexity and budget |
| [Code-as-Harness](https://arxiv.org/pdf/2605.18747) | Memory as unified state-management layer (5 tiers: working, semantic, experiential, long-term, multi-agent), feedback-guided debugging as control over executable program state, verification tools as structured observations updating working memory |
| [HarnessAgent](https://arxiv.org/html/2512.03420v1) | Compilation-error triage (link/inclusion/missing-header classification), iterative retrieval and correction, anti-reward-hacking validation, focused retrieval actions from classified errors |
| [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/) | Closed-loop verification (constrain, maintain context, prevent premature victory, verify with full-pipeline tests), making runtime observable and debuggable |
| [Aikido blog](https://www.aikido.dev/blog/mythos-vs-harness) | 5-stage pipeline (recon/hunt/validate/trace/dedup), 8 cheap agents > 1 expensive agent at same cost, harness matters more than model, independent validation stage with no finding-generation capability |
| [zsec blog](https://blog.zsec.uk/harnessing-harnesses/) | Stage-specific context framing (each model receives only needed context), revalidation skill (`true_positive`/`false_positive`/`already_fixed`/`uncertain`), structured JSON output per stage, 8-stage Claude Code pipeline |
| [Awesome Harness Engineering](https://github.com/ai-boost/awesome-harness-engineering) | COALA three-tier memory (procedural/semantic/episodic), auto-harness self-improving systems (PROGRAM.md pattern), SquillaRouter for cheapest-capable-model routing, 5 recurring architectural dimensions |
| [J-Space research](https://datasciencedojo.com/blog/anthropic-j-space-explained) | J-lens as readout of model's internal workspace, Global Workspace Theory parallel, evaluation awareness detection (model knowing it's being tested), broadcasting pattern analogous to MCP/A2A protocols |
| [Neuronpedia](https://www.neuronpedia.org/) | SAE interpretability platform, Natural Language Autoencoders (translate internal thoughts to text), Assistant Axis (monitor/stabilize LLM character), Circuit Tracer (trace internal reasoning steps), feature steering |
| [T3MP3ST](https://github.com/elder-plinius/T3MP3ST) | Single-agent ReAct loop (benchmarked path), evidence vault with anti-fitting guard, `verify-claims` recomputation from committed oracle, lessons + proposals recording for self-improvement |
| [CyberStrike](https://github.com/CyberStrikeus/CyberStrike) | Intelligence layer (not just LLM wrapper) — injects domain-specific context into any model, lazy-loading 7300+ skills, zero context pollution, 13+ domain-specialized agents following proven frameworks (OWASP WSTG, CIS, MASTG/MASVS), multi-step attack chain orchestration |
| [NeuroSploit](https://github.com/JoasASantos/NeuroSploit/) | Deterministic HTTP probe before model recon (status/redirects/headers/cookies/CORS/tech fingerprint/JS analysis/404 baseline), 12 multi-stage attack chain agents (SQLi->RCE->LPE etc.), each stage proven before advancing, DEPTH doctrine |
| [Sentinel AI Offensive](https://github.com/mlvpatel/sentinel-ai-offensive) | Persistent hunt memory system, 7-Question Verdict Gate, regulatory compliance (NIST/GDPR/ISO 27001) built into agent harness, autonomous mode with scope enforcement, Burp MCP + HackerOne MCP integration |
| [Arsenal-NG](https://github.com/halilkirazkaya/arsenal-ng) | Search-first UX for command library, global variables auto-fill placeholders, YAML cheat-file format, fast fuzzy search over 200+ cheat-sheets |
| [Harness Engineering Guide](https://github.com/nexu-io/harness-engineering-guide) | First principles to production: Agentic Loop (think->act->observe), Tool System (registry, static/dynamic loading, MCP), Memory & Context (two-tier: daily logs + long-term, AGENTS.md + MEMORY.md), Guardrails (trust boundaries), Error Handling (classification, retry, graceful degradation, checkpoint/resume), Multi-Agent Orchestration (pipeline, fan-out, supervisor) |

## Architecture Diagram

```
                           RTPI Harness Optimization Architecture

    User / Operator
         |
         v
  +------+-------+
  | Intent Engine |  Phase 1: Deterministic probe, error triage,
  | (Pre-LLM)    |  anti-premature-victory gate, voting panel
  +------+-------+
         |
         v
  +------+---------+     +------------------+     +-------------------+
  | Judgment Space  |<--->| Memory Router    |<--->| Persona Manager   |
  | (Phase 3)       |     | (Phase 2)        |     | (Phase 4)         |
  |                 |     |                  |     |                   |
  | - Hypotheses    |     | - Native Memory  |     | - Agent Profiles  |
  | - Confidence    |     | - Mem0 Adapter   |     | - Skill Feedback  |
  | - Constraints   |     | - KB Adapter     |     | - Session Index   |
  | - Steering      |     | - Experience     |     | - Drift Detector  |
  +------+----------+     +--------+---------+     +-------------------+
         |                          |
         v                          v
  +------+---------------------------+------+
  |         Loop Engine (Phase 5)           |
  |                                         |
  |  Stage Context Framing                  |
  |  Maker/Checker Gate                     |
  |  Agent Budget Planner (cheap > costly)  |
  |  Loop Safety (cost caps, dead-loop)     |
  |  Revalidation Gate                      |
  +---------+-------------------+-----------+
            |                   |
            v                   v
  +---------+-------+  +-------+----------+
  | Tool Execution  |  | Agent Workflow   |
  | Loop            |  | Orchestrator     |
  | (existing)      |  | (existing)       |
  +---------+-------+  +-------+----------+
            |                   |
            v                   v
  +---------+-------------------+----------+
  |        Existing RTPI Infrastructure    |
  |  MCP Servers | Docker Tools | Inference|
  |  Knowledge Base | Attack Trees | DB    |
  +--------------------------------------------+
```

## New Files Added

| File | Purpose | Tests |
|------|---------|-------|
| `server/services/agents/deterministic-probe.ts` | Pre-LLM evidence gathering via HTTP probes, port scans, DNS lookups | `tests/unit/agents/deterministic-probe.test.ts` |
| `server/services/agents/probe-cache.ts` | TTL cache for probe results to avoid redundant network calls | `tests/unit/agents/probe-cache.test.ts` |
| `server/services/agents/error-triage.ts` | Classify tool errors and route to appropriate fix actions | `tests/unit/agents/error-triage.test.ts` |
| `shared/types/completion-evidence.ts` | Schema for structured completion evidence | N/A (types only) |
| `server/services/agents/completion-reviewer.ts` | Micro-agent that challenges premature completion claims | `tests/unit/agents/completion-reviewer.test.ts` |
| `server/services/agents/voting-panel.ts` | Multi-agent deterministic voting for high-stakes decisions | `tests/unit/agents/voting-panel.test.ts` |
| `shared/types/voting-types.ts` | Vote schemas per decision type | N/A (types only) |
| `server/services/memory/memory-router.ts` | Unified query interface across all memory subsystems | `tests/unit/memory/memory-router.test.ts` |
| `server/services/memory/adapters/` | Adapter interfaces for Native, Mem0, and KB backends | `tests/unit/memory/adapters.test.ts` |
| `server/services/memory/experience-extractor.ts` | Post-task experiential memory extraction | `tests/unit/memory/experience-extractor.test.ts` |
| `server/services/memory/memory-nudger.ts` | Periodic memory curation prompts during long tasks | `tests/unit/memory/memory-nudger.test.ts` |
| `shared/types/memory-types.ts` | Unified memory types including experiential and nudge schemas | N/A (types only) |
| `shared/types/judgment-types.ts` | JudgmentState, Hypothesis, Decision, SteeringDirective types | N/A (types only) |
| `server/services/judgment/judgment-space.ts` | Per-agent judgment state management | `tests/unit/judgment/judgment-space.test.ts` |
| `server/services/judgment/judgment-lens.ts` | Human-readable judgment state decoder | `tests/unit/judgment/judgment-lens.test.ts` |
| `server/services/judgment/escalation-policy.ts` | Policy definitions for multi-tier escalation | N/A (config) |
| `server/services/judgment/arbiter.ts` | Decision interceptor and escalation router | `tests/unit/judgment/arbiter.test.ts` |
| `server/services/judgment/reasoning-trace.ts` | Structured reasoning event capture | `tests/unit/judgment/reasoning-trace.test.ts` |
| `server/services/judgment/trace-analytics.ts` | Aggregate analytics over reasoning traces | `tests/unit/judgment/trace-analytics.test.ts` |
| `shared/types/agent-persona.ts` | Agent persona profile types | N/A (types only) |
| `server/services/agents/persona-manager.ts` | Persistent persona loading, updating, and prompt integration | `tests/unit/agents/persona-manager.test.ts` |
| `server/scripts/data/seed-personas.ts` | Seed initial personas for existing agent types | N/A (script) |
| `server/services/skills/skill-feedback.ts` | Post-task skill usage feedback collection | `tests/unit/skills/skill-feedback.test.ts` |
| `server/services/skills/skill-improver.ts` | Periodic skill improvement from accumulated feedback | `tests/unit/skills/skill-improver.test.ts` |
| `server/services/memory/session-index.ts` | Cross-session search and indexing | `tests/unit/memory/session-index.test.ts` |
| `server/services/agents/behavior-baseline.ts` | Statistical baseline per agent type | `tests/unit/agents/behavior-baseline.test.ts` |
| `server/services/agents/drift-detector.ts` | Behavioral drift detection with alerting | `tests/unit/agents/drift-detector.test.ts` |
| `server/services/agents/stage-context-frames.ts` | Stage-specific context frame definitions | N/A (config) |
| `server/services/agents/context-framer.ts` | Minimal context builder per workflow stage | `tests/unit/agents/context-framer.test.ts` |
| `server/services/agents/maker-checker-gate.ts` | Generic maker/checker middleware | `tests/unit/agents/maker-checker-gate.test.ts` |
| `shared/types/maker-checker.ts` | Maker/checker verdict types | N/A (types only) |
| `server/services/agents/budget-planner.ts` | Cost-optimized agent mix planner | `tests/unit/agents/budget-planner.test.ts` |
| `server/services/agents/loop-checkpoint.ts` | Loop state serialization for checkpoint/resume | `tests/unit/agents/loop-checkpoint.test.ts` |
| `server/services/agents/revalidator.ts` | Finding revalidation against git history and prior scans | `tests/unit/agents/revalidator.test.ts` |

## Configuration Reference

### New Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `FF_DETERMINISTIC_PROBE` | `true` | Enable pre-LLM deterministic probing of targets |
| `FF_ERROR_TRIAGE` | `true` | Enable structured error classification before LLM feedback |
| `FF_ANTI_PREMATURE_VICTORY` | `true` | Require structured evidence for task completion |
| `FF_VOTING_PANEL` | `false` | Enable multi-agent voting for high-stakes decisions |
| `FF_UNIFIED_MEMORY` | `false` | Route all memory queries through unified MemoryRouter |
| `FF_EXPERIENTIAL_MEMORY` | `false` | Extract and store experiential memories post-task |
| `FF_MEMORY_NUDGE` | `false` | Enable periodic memory curation nudges |
| `FF_JUDGMENT_SPACE` | `false` | Enable structured judgment state tracking |
| `FF_MULTI_TIER_ARBITRATION` | `false` | Enable automatic decision escalation |
| `FF_REASONING_TRACES` | `false` | Capture structured reasoning traces |
| `FF_AGENT_PERSONAS` | `false` | Enable persistent agent persona profiles |
| `FF_SKILL_SELF_IMPROVEMENT` | `false` | Enable skill feedback and self-improvement loop |
| `FF_CROSS_SESSION_LEARNING` | `false` | Enable cross-session search and recall |
| `FF_STAGE_CONTEXT_FRAMING` | `false` | Enable stage-specific context framing in pipelines |
| `FF_MAKER_CHECKER` | `false` | Enforce maker/checker split on agent outputs |
| `FF_AGENT_BUDGET_PLANNER` | `false` | Enable cost-optimized agent mix planning |
| `FF_LOOP_SAFETY` | `true` | Enable enhanced loop safety controls (cost caps, dead-loop detection) |
| `FF_REVALIDATION` | `false` | Enable finding revalidation against git history |

### New Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROBE_CACHE_TTL_MS` | `900000` | Deterministic probe cache TTL (15 min) |
| `ERROR_TRIAGE_MAX_RETRIES` | `3` | Max error-fix cycles before escalation |
| `MEMORY_NUDGE_INTERVAL` | `5` | Iterations between memory nudge prompts |
| `JUDGMENT_ESCALATION_THRESHOLD` | `0.6` | Confidence below which decisions escalate |
| `LOOP_TOKEN_BUDGET` | `0` | Per-loop token budget (0 = unlimited) |
| `LOOP_COST_BUDGET_USD` | `0` | Per-loop cost budget in USD (0 = unlimited) |
| `DEAD_LOOP_THRESHOLD` | `3` | Consecutive no-progress iterations before dead-loop exit |
| `VOTING_PANEL_SIZE` | `3` | Number of agents in voting panel |
| `EXPERIENCE_DECAY_DAYS` | `30` | Days before experiential memory relevance decays |
| `SKILL_IMPROVEMENT_MIN_FEEDBACK` | `5` | Minimum feedback entries before triggering skill improvement |

### New Database Tables

| Table | Phase | Description |
|-------|-------|-------------|
| `reasoning_traces` | 3 | Structured per-step reasoning events indexed by workflow/agent |
| `steering_directives` | 3 | Audit trail of operator steering interventions |
| `persona_profiles` | 4 | Persistent agent persona profiles with methodology and expertise |
| `skill_usage_log` | 4 | Skill application outcomes and feedback |
| `session_summaries` | 4 | LLM-generated session summaries with tsvector full-text index |
| `behavior_baselines` | 4 | Statistical behavioral baselines per agent type |

### Priority Rollout Order

**Immediate (P0):** These deliver the highest waste reduction with minimal risk:
1. Deterministic Probe (1.1) — eliminates hallucinated reconnaissance
2. Error Triage (1.2) — stops wasted LLM iterations on classifiable errors
3. Anti-Premature-Victory Gate (1.3) — prevents premature task completion
4. Unified Memory Router (2.1) — consolidates fragmented memory access
5. Experiential Memory (2.2) — enables cross-task learning
6. Judgment Space (3.1) — makes agent reasoning inspectable
7. Multi-Tier Arbitration (3.2) — automatic escalation for high-stakes decisions
8. Agent Persona Profiles (4.1) — consistent, evolving agent behavior
9. Stage Context Framing (5.1) — reduces context pollution across pipeline stages
10. Maker/Checker Split (5.2) — independent validation of all agent outputs

**Next Sprint (P1):** These extend the foundation:
11. Multi-Agent Voting (1.4)
12. Memory Nudge System (2.3)
13. Reasoning Trace Analytics (3.3)
14. Skill Self-Improvement (4.2)
15. Cross-Session Learning (4.3)
16. Agent Budget Planner (5.3)
17. Loop Safety Controls (5.4)

**Backlog (P2):** These add polish and advanced capabilities:
18. KB Search Optimization (2.4)
19. Controlled Steering Interface (3.4)
20. Behavioral Drift Detection (4.4)
21. Revalidation Patterns (5.5)
