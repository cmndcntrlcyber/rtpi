# Bug Hunter — Operator Guide

`FF_BUG_HUNTER` ships a multi-agent bug-hunting pipeline adapted from
[Claude-BugHunter][cbh]. It runs entirely on local Ollama models by
default (reasoning + tool-use + embedding), with the standard rtpi
inference router walking the fallback chain (Ollama → OpenAI → Anthropic)
when Ollama is unreachable.

[cbh]: https://github.com/cmndcntrlcyber/Claude-BugHunter

## Enable

```bash
# .env
FF_BUG_HUNTER=true

# (defaults are already correct, but set them explicitly if you've overridden
#  in Settings or want to confirm)
DEFAULT_MODEL=qwen3:14b                      # reasoning fallback
# DEFAULT_REASONING_MODEL=qwen3:14b          # optional explicit pin
# DEFAULT_AGENT_MODEL=qwen2.5-coder:14b      # optional explicit pin
EMBEDDING_MODEL=qwen3-embedding:4b           # 2560-dim, matches schema
```

```bash
docker compose up -d
npm run db:push                              # applies migration 0048 + 0049
npm run bug-hunter:import-skills             # ingest 51 SKILL.md trees → knowledge_base
```

## Architecture

```
   /api/v1/bug-hunter/*  (FF_BUG_HUNTER-gated)
        │
   ┌────┴───────┬──────────────┬─────────────┐
   ▼            ▼              ▼             ▼
 workflows.ts  queries.ts   memory.ts     admin.ts
 (9 starts)    (4 reads)    (4 writes)    (RAG sanity)
        │
   AgentWorkflowOrchestrator   ← task types: bug_hunter_{scope,recon,hunt,
        │                                    chain,validate,capture,report}
        ▼
   Scope → Recon → Hunt → Chain → Validate → Capture → Report
                       │
                       ▼
                BugHunterToolExecutionLoop
                 (per-iteration RAG hook
                  retrieves matching hunt-*
                  skill chunks)

   knowledge_base (pgvector, 2560-dim)
        ▲
   scripts/import-bug-hunter-skills.ts  ← chunks 51 SKILL.md on H2 boundaries
```

Every agent's seed config carries `ai.provider = "auto"` — **no model
strings are pinned in code**. The router consults Settings → DEFAULT_*
env → provider chain, so an operator can swap models system-wide without
touching agent code.

## Inference roles

| Agent          | LLM call kind        | Default Ollama model        |
| -------------- | -------------------- | --------------------------- |
| Scope          | `routeReasoning()`   | `qwen3:14b`                 |
| Recon          | `routeAgent()`       | `qwen2.5-coder:14b`         |
| Hunt           | `routeReasoning()` ⁂ | `qwen3:14b`                 |
| Chain          | `routeReasoning()`   | `qwen3:14b`                 |
| Validate       | `routeReasoning()`   | `qwen3:14b`                 |
| Capture        | regex-driven         | n/a                         |
| Report         | `routeReasoning()`   | `qwen3:14b`                 |
| Skill importer | `routeEmbedding()`   | `qwen3-embedding:4b` (2560-dim) |

⁂ Hunt's outer decisions go through `ToolExecutionLoop` which itself
calls `routeReasoning()`. Both reasoning and embedding kinds participate
in the loop (embedding for the per-iteration RAG retrieval).

## Endpoints

All routes require an authenticated admin/operator. Mounted under
`/api/v1/bug-hunter`. Disabled (HTTP 404) when `FF_BUG_HUNTER` is off.

### Workflows — `POST` (`workflows.ts`)

| Path                    | Effect                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `/hunt`                 | Scaffold operation (if `scopeText+name` given) + start 7-phase workflow                      |
| `/autopilot`            | Same as `/hunt` but defaults to elevated iteration budget                                    |
| `/scope`                | Run ScopeAgent standalone — parses operations.scope into `scopeRules`                        |
| `/recon`                | Run ReconAgent standalone — delegates BBOT via surface-assessment-agent                      |
| `/triage`               | ValidateAgent fast mode (Q3 + Q7 only — no LLM)                                              |
| `/validate`             | ValidateAgent full mode (7-Question Gate)                                                    |
| `/chain`                | ChainAgent — proposes A→B(→C) escalations across accumulated findings                        |
| `/report`               | CaptureAgent (evidence hygiene) → BugReportAgent (platform template)                         |
| `/token-scan`           | HuntAgent narrowed to `meme-coin-audit` skill                                                |
| `/web3-audit`           | HuntAgent narrowed to `web3-audit` skill                                                     |

### Queries — `GET`/`POST` (`queries.ts`)

| Path                          | Effect                                                                |
| ----------------------------- | --------------------------------------------------------------------- |
| `GET  /scope/:operationId`    | Read parsed `scopeRules` + `mode/box/platform`                        |
| `GET  /surface/:operationId`  | Ranked attack surface from `discovered_assets`                        |
| `POST /intel`                 | Fresh CVE / disclosure intel via Tavily (requires `TAVILY_API_KEY`)   |
| `GET  /pickup/:operationId`   | Resume summary: phase progress, findings, memory tag rollup           |
| `GET  /ping`                  | Lightweight liveness probe                                            |

### Memory — `POST`/`GET` (`memory.ts`)

| Path                                | Effect                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `POST /remember`                    | Log a `finding|lead|killed|submission|note|chain` with `bh:*` tags      |
| `GET  /memory-gc/:operationId`      | Inspect tag counts + expiring entries                                   |
| `POST /memory-gc/:operationId`      | Purge memories matching tags (`dryRun` supported)                       |
| `GET  /submissions/:operationId`    | Reconstruct submissions ledger from `bh:submission`-tagged memories     |

### Admin — `POST`/`GET` (`admin.ts`)

| Path                          | Effect                                                          |
| ----------------------------- | --------------------------------------------------------------- |
| `POST /admin/skills/reimport` | Re-run the skill importer (`--force` via `{force: true}`)       |
| `GET  /admin/skills/reimport` | Status of last reimport                                         |
| `POST /admin/retrieve`        | RAG sanity check — top-K knowledge_base hits for a query        |
| `GET  /admin/skills/stats`    | Total rows, embedded rows, phase distribution                   |

## Smoke test (post-install)

```bash
# 1) Agents seeded?
curl -s localhost:3001/api/v1/agents | jq -c '.[] | select(.name | startswith("Bug Hunter")) | {name, status}'
# Expect 7 rows.

# 2) Skills ingested?
curl -s -X POST localhost:3001/api/v1/bug-hunter/admin/retrieve \
  -H "Content-Type: application/json" \
  -d '{"query":"JWT none algorithm bypass /api/auth", "topK":3}' | jq '.skills[].title'

# 3) Start a pipeline (replace <TARGET-UUID>).
curl -s -X POST localhost:3001/api/v1/bug-hunter/hunt \
  -H "Content-Type: application/json" \
  -d '{
        "name": "demo-engagement",
        "targetId": "<TARGET-UUID>",
        "scopeText": "In scope: *.example.com\nOut of scope: internal.example.com\nAccepted impacts: RCE, SSRF, ATO",
        "mode": "wapt",
        "box": "blackbox",
        "platform": "internal"
      }' | jq

# 4) Pickup a previously-started engagement.
curl -s localhost:3001/api/v1/bug-hunter/pickup/<OPERATION-UUID> | jq
```

## Autopilot

Recurring Hunt → Chain → Validate cycles. Enable per-operation by
stamping the metadata block (the scheduler polls every 5 minutes):

```sql
UPDATE operations
   SET metadata = metadata || '{"bugHunterAutopilot": {
     "enabled": true,
     "intervalMs": 1800000,
     "phases": ["hunt", "chain", "validate"],
     "mode": "wapt",
     "box": "blackbox",
     "targetId": "<TARGET-UUID>"
   }}'::jsonb
 WHERE id = '<OPERATION-UUID>';
```

The autopilot only fires when `FF_BUG_HUNTER` is enabled at boot, and it
won't re-enter an operation while a prior run is still in progress
(re-entrancy guard in `bug-hunter/autopilot-scheduler.ts`).

## How skill retrieval works

1. **Ingest** (`scripts/import-bug-hunter-skills.ts`) — each SKILL.md is
   chunked on H2 boundaries when it exceeds 250 lines or 5 H2s. Mega-
   skills (`bug-bounty`, `bb-methodology`, `osint-methodology`,
   `security-arsenal`) are tagged `chunk:meta` so default retrieval
   excludes them.
2. **Tag taxonomy** — `phase:`, `vuln:`, `platform:`, `discipline:`,
   `mode:`, `chunk:`, `skill:`, `hash:`. The hash tag is what makes
   re-imports idempotent.
3. **Retrieve** (`bug-hunter-skill-retriever.ts`) — embedding-first
   cosine over `knowledge_base`, with a websearch_to_tsquery fallback
   when no embedding provider is reachable. Always returns *something*
   (you never get a silent zero).
4. **Inject** (`bug-hunter-tool-loop.ts`) — `setPrePromptHook(...)`
   appends a "BUG-HUNTER SKILLS" section to the user prompt on each
   iteration, scoped by `mode` and auto-detected `vuln` class from
   recent findings (sqli, xss, idor, ssrf, rce, jwt, oauth, saml,
   graphql, xxe, ssti, csrf, smuggling, ntlm).

## Files (high-level map)

```
data/bug-hunter/always-rejected.json           # NEVER-SUBMIT + chain-required tables (Q7 data)
knowledge_seed/bug_hunter_skills/              # read-only seed: 51 SKILL.md trees
migrations/0048_extend_task_type_for_bug_hunter.sql
migrations/0049_seed_bug_hunter_agents.sql
scripts/import-bug-hunter-skills.ts            # idempotent ingester
server/services/knowledge/bug-hunter-skill-retriever.ts
server/services/bug-hunter/
  seven-question-gate.ts                       # hybrid Q3/Q7 prog + Q1/2/4/5/6 LLM
  engagement-scaffolder.ts                     # DB-first (no FS)
  autopilot-scheduler.ts                       # cron loop
server/services/agents/bug-hunter/
  {scope,recon,hunt,chain,validate,capture,bug-report}-agent.ts
  bug-hunter-tool-loop.ts                      # extends ToolExecutionLoop via prePromptHook
  index.ts                                     # initializeBugHunterAgents()
server/api/v1/bug-hunter/
  workflows.ts                                 # 9 endpoints — agent runs
  queries.ts                                   # 4 endpoints — read-only
  memory.ts                                    # 4 endpoints — memory ops
  admin.ts                                     # 4 endpoints — RAG + reimport
docs/bug-hunter.md                             # this file
```

## Failure modes worth knowing

- **Ollama down at import time** — `embedder.embed()` returns `null`;
  the importer persists rows without embeddings. Re-run later or the
  embedding-aware retrieve fallback (websearch_to_tsquery) takes over.
- **Ollama down at run time** — inference router walks the fallback
  chain. Skills retrieved this run may be sourced via full-text rather
  than vector match; the `source` field on `RetrievedSkill` tells you.
- **`task_type` enum lookups fail** — confirm migration 0048 applied
  (`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid =
  enumtypid WHERE typname='task_type'`).
- **Agents missing** — confirm migration 0049 applied AND
  `FF_BUG_HUNTER=true` at boot (the initialize step in
  `workflow-event-handlers.ts` is gated).
- **Out-of-scope checks always pass** — ScopeAgent failed to populate
  `scopeRules`. Call `POST /bug-hunter/scope {operationId}` to retry.
