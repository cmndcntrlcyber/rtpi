---
name: feedback-evaluation-methodology
description: Hard-won lessons about how to evaluate the RTPI harness — what to check, what was missed before, and where the measurement gaps are.
metadata:
  type: feedback
---

## Always search ALL completion/success signal messages, not just the canonical one

**Why:** The RTPI orchestrator has two distinct execution paths: Attack-Tree and Template-Driven.
They emit different completion messages. `normalize-kpis.mjs` was written to query only
`message = 'Attack tree execution completed'` — which caused the prior evaluation to show
0/0 completions (UNVERIFIABLE) when 6 completions had actually occurred via the Template-Driven
path (`message = 'Workflow completed successfully'`).

**How to apply:** On any harness evaluation, first run a broad query for ALL messages containing
"complet", "success", "finish" before scoping to a specific event name. Don't trust a single
known event name to be the only completion signal.

## Process completion != effective completion — always verify output quality

**Why:** The RTPI harness emits task success=true and workflow success even when the tool
produced zero attack output (msfconsole splash screen). The AI model self-reports "no actionable
data" in the summary call but the orchestrator proceeds to emit success. Process metrics (completion
rate) can be 100% while effective outcome metrics (real findings) are 0%.

**How to apply:** Cross-reference the ai_call prompt/response text against the raw tool stdout.
If the model says "inconclusive" or "no data", that is evidence of a quality defect — do not
report it as PASS just because the exit code is 0.

## Check the tool_registry config, not just the code

**Why:** The metasploit baseCommand defect was not in orchestrator source code — it was in the
DB row (`tool_registry.config.baseCommand = ""`). The code was correct (tool-executor.ts builds
the command from the registry config), but the config was broken. Source review alone would not
have found this.

**How to apply:** For any evaluation that involves tool execution, query tool_registry for the
actual config.baseCommand and parameters of the tools used. The auto-repair stub can write
broken configs silently.

## The AI reasoning model is not the source of hallucination in this harness

**Why:** gemma4:e4b correctly identified the msfconsole splash as "no actionable data" every time.
The hallucination cascade is caused by the orchestrator design continuing the workflow after a
quality failure and passing the AI's "recommended next steps" (fabricated) text as the next
agent's ground truth.

**How to apply:** When investigating AI output quality, distinguish between model-level
hallucination (model makes up facts unprompted) and architectural hallucination (design forces
AI to reason over zero-quality input). The fix for each is different — the latter requires
orchestration changes, not model changes.
