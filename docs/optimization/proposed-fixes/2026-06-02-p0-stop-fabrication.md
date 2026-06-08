# Proposed Fix — Stop the Fabrication Pipeline (P0)

> **Status: APPLIED 2026-06-02.**
> - **P0-2 evidence gate** — applied. Helper in `server/services/tool-evidence.ts`
>   (+ unit tests `tests/unit/services/assess-tool-evidence.test.ts`, 9/9 green);
>   gate + cascade-stop in `agent-workflow-orchestrator.ts`. `tsc`: 0 errors in
>   touched files.
> - **P0-3 observability** — applied (`workflow_outcome` event + dual-path KPI SQL).
> - **P0-1** — applied as **Option A** (recommended): Metasploit/msfconsole removed
>   from the `enabledTools` of **Operations Manager** and **Azure-AD Agent**; real
>   MSF use flows through `metasploitExecutor` on the attack-tree path. Rollback:
>   `ROLLBACK-2026-06-02-msf-enabledtools.md`. The registry `UPDATE` stopgap
>   (Option B, `metasploit-registry-config.sql`) was therefore **not** applied.
> - **Enforcement:** `FF_REQUIRE_TOOL_EVIDENCE=true` set in `.env`.
>
> The diffs below are kept as the record of what was applied (helper relocated to
> its own module `tool-evidence.ts` rather than inside `tool-executor.ts`).
> **Author context:** follows `docs/optimization/rtpi-harness-dmaic-v2.md`.

## Problem recap (one paragraph)

The generic/template tool path runs Metasploit as essentially the bare target
because the `tool_registry` rows (`metasploit` and `msfconsole`, verified live)
have `config.baseCommand: ""` **plus a self-repair-seeded positional `target`
param**. That means `buildCommand` takes the **happy path** (`tool-executor.ts:236-253`,
`hasParams` is true), not the legacy stub — it concatenates `"" + formatParameter(target)`
= the bare target string. `msfconsole` is launched with the target as a resource
arg, prints its banner, exits `0`, and the
orchestrator counts `exitCode === 0` as success (`agent-workflow-orchestrator.ts:1802,1813`),
marks the task `completed` (`:886`), logs `"Workflow completed successfully"`
(`:937`), and cascades the model's "no actionable data" narrative to five
tool-less downstream agents that elaborate it into a polished — but fabricated —
report. **The model is honest; the orchestrator manufactures the false success.**

Two structural facts make this more than a config typo:
1. **`formatParameter` only appends params after `baseCommand`** (`tool-executor.ts` —
   positional → `String(value)`, flagged → `${flag} ${value}`). It **cannot**
   interpolate a target into the middle of a `-x "use …; set RHOSTS <t>; run; exit"`
   string. So Metasploit's correct invocation is **not expressible** as a generic
   registry config: any config yields at best `msfconsole … <target>`, with the
   target as a trailing arg msfconsole treats as a resource file. A `tool_registry`
   `UPDATE` is a stopgap, not the real fix.
2. **A dedicated `metasploitExecutor.execute()` exists** but is wired only into
   the attack-tree path (`agent-workflow-orchestrator.ts:2894`) — which never
   runs in these workflows. The generic path bypasses it.

Therefore the durable fix is a **tool-agnostic evidence gate** (P0-2) plus
**outcome observability** (P0-3); the registry config (P0-1) is the stopgap.

---

## P0-2 (primary) — Evidence gate: never count a banner as success

**Goal:** exit-0 output that contains no real tool work must NOT count as a
completed tool, must NOT trigger an AI summary, and (opt-in) must fail the
workflow instead of cascading fabrication downstream.

**Design choices that keep false-positives near zero:**
- The strongest tell is **command shape**: if the executed command is just the
  bare target (the exact stub bug) or the `# no-target-supplied` sentinel, it is
  definitively misconfigured. This catches today's bug precisely.
- The secondary tell is a **known-banner signature** (e.g. the Metasploit splash)
  with no command output after it.
- A clean scan that legitimately finds nothing (e.g. nmap "0 hosts up") has
  substantive structured/long output and is **not** flagged — we never punish an
  honest empty result.
- Behavior change is gated behind `FF_REQUIRE_TOOL_EVIDENCE` (default **off**),
  so merging this changes *observability* immediately and *control flow* only
  when you opt in. Fully reversible.

### Proposed diff — `server/services/tool-executor.ts` (new exported helper)

```diff
@@ // near the other exported helpers (e.g. after formatParameter)
+/**
+ * Evidence assessment for a tool run. Distinguishes "the tool actually ran and
+ * produced output" from "the tool was misinvoked and printed a banner / nothing"
+ * (e.g. an interactive REPL launched with no script, which exits 0). This is the
+ * backstop against architectural hallucinated-success: exit 0 is necessary but
+ * NOT sufficient to call a step real.
+ */
+export interface ToolEvidence {
+  hasEvidence: boolean;
+  reason: string; // human-readable; logged for the Pareto
+}
+
+const MIN_EVIDENCE_BYTES = 48;
+// Signatures of "launched but did no work" output. Conservative on purpose.
+const NO_WORK_SIGNATURES: RegExp[] = [
+  /=\[ metasploit/i,            // msfconsole splash art
+  /metasploit v\d/i,
+  /\bmsf\d?\s*>\s*$/i,          // bare msf prompt, no command output
+  /^#\s*no-target-supplied/i,  // our own stub sentinel
+];
+
+export function assessToolEvidence(
+  command: string | null | undefined,
+  target: string | null | undefined,
+  stdout: string | null | undefined,
+  parsedOutput: unknown,
+): ToolEvidence {
+  const cmd = (command || '').trim();
+  const out = (stdout || '').trim();
+
+  // 1. Command shape — the exact stub bug: command IS just the bare target.
+  if (target && cmd === String(target).trim()) {
+    return { hasEvidence: false, reason: 'command was bare target (misconfigured baseCommand)' };
+  }
+  if (/^#\s*no-target-supplied/.test(cmd)) {
+    return { hasEvidence: false, reason: 'no-target-supplied sentinel command' };
+  }
+
+  // 2. Structured findings are always real evidence.
+  if (parsedOutput && (Array.isArray(parsedOutput) ? parsedOutput.length > 0
+        : Object.keys(parsedOutput as object).length > 0)) {
+    return { hasEvidence: true, reason: 'parsed structured output present' };
+  }
+
+  // 3. Banner-only output → no work done.
+  if (NO_WORK_SIGNATURES.some((re) => re.test(out)) && out.length < 2000) {
+    return { hasEvidence: false, reason: 'output matched a launched-but-idle banner signature' };
+  }
+
+  // 4. Trivially short output with no structure.
+  if (out.length < MIN_EVIDENCE_BYTES) {
+    return { hasEvidence: false, reason: `output too short (${out.length}b) to be real work` };
+  }
+
+  return { hasEvidence: true, reason: 'substantive stdout' };
+}
```

### Proposed diff — `server/services/agent-workflow-orchestrator.ts` (gate the exit-0 path)

Anchor: the success branch at `:1785-1817` inside `executeGenericToolWorkflow`.

```diff
@@ -1785,6 +1785,12 @@ inside executeGenericToolWorkflow, after computing truncatedStdout
+        // EVIDENCE GATE: exit 0 is necessary but not sufficient. A REPL launched
+        // with no script (e.g. `msfconsole <target>`) exits 0 with only a banner.
+        const evidence = assessToolEvidence(
+          result.command, target.value, truncatedStdout, result.parsedOutput,
+        );
+        const realSuccess = result.exitCode === 0 && evidence.hasEvidence;
+
         const failureDetail: ToolExecutionFailureDetail | null =
-          result.exitCode === 0
+          realSuccess
             ? null
             : {
-                message: `Tool exited ${result.exitCode}${...}`,
+                message: result.exitCode === 0
+                  ? `Tool exited 0 but produced no evidence — ${evidence.reason}`
+                  : `Tool exited ${result.exitCode}${(result.stderr || "").trim() ? ` — ${(result.stderr || "").slice(0,200).trim()}` : ""}`,
                 stderr: result.stderr || null,
                 attemptedCommand: result.command || null,
                 exitCode: result.exitCode ?? null,
               };

         toolResults.push({
           ...
           execution: {
-            success: result.exitCode === 0,
+            success: realSuccess,
             ...
           },
-          error: result.exitCode === 0 ? null : failureDetail!.message,
-          status: result.exitCode === 0 ? "completed" : "failed",
+          error: realSuccess ? null : failureDetail!.message,
+          status: realSuccess ? "completed" : "failed",
           ...
         });

-        await this.log(workflowId, taskId, result.exitCode === 0 ? "info" : "warn",
-          `"${tool.name}" finished: exit=${result.exitCode}, duration=${result.duration}ms`,
+        await this.log(workflowId, taskId, realSuccess ? "info" : "warn",
+          `"${tool.name}" finished: exit=${result.exitCode}, evidence=${evidence.hasEvidence} (${evidence.reason}), duration=${result.duration}ms`,
           { executionId: result.executionId, exitCode: result.exitCode, hasEvidence: evidence.hasEvidence });
```

Because `completed` is computed from `status === "completed"` (`:1865`) and the AI
summary only fires when `completed > 0` (`:1878`), this single change already
stops the banner run from generating a fabricated summary.

### Proposed diff — opt-in cascade stop (feature-flagged, default off)

Anchor: end of `executeGenericToolWorkflow`, just before `return {…}` at `:1912`.

```diff
+    // Opt-in: refuse to cascade a zero-evidence tool task into downstream agents.
+    // Default OFF — flip on once you trust the gate. Reversible via env.
+    if (process.env.FF_REQUIRE_TOOL_EVIDENCE === "true" && completed === 0 && enabledToolIds.length > 0) {
+      throw new Error(
+        `No tool produced real evidence for "${agent.name}" (target ${target.value}). ` +
+        `Refusing to cascade fabricated context downstream. ` +
+        `Tools: ${toolResults.map(r => `${r.toolStringId}:${r.status}`).join(", ")}`,
+      );
+    }
```

This throw routes into the existing per-task catch (`:903-924`), which marks the
task `failed` and stops the workflow — so the report writer never runs on a
fabricated chain.

---

## P0-3 — Make outcomes observable (both completion paths)

The template/generic path logs `"Workflow completed successfully"` with no
payload (`:937`), so `tools/harness-eval/normalize-kpis.mjs` (which keys on the
attack-tree event `"Attack tree execution completed"`) sees `0/0`. Emit a
structured outcome on the generic path too.

### Proposed diff — `agent-workflow-orchestrator.ts` (`:937`)

```diff
-      await this.log(workflowId, null, "info", "Workflow completed successfully");
+      // Aggregate evidence across all tool-execution tasks in this workflow so
+      // the KPI normalizer can compute a real success rate from BOTH paths.
+      const wfTasks = await db.select().from(workflowTasks).where(eq(workflowTasks.workflowId, workflowId));
+      const toolOutputs = wfTasks
+        .map(t => t.outputData as any)
+        .filter(o => o?.type === "tool_execution");
+      const realFindingsCount = toolOutputs.reduce((n, o) => n + (o.summary?.completed || 0), 0);
+      await this.log(workflowId, null, "info", "Workflow completed successfully", {
+        type: "workflow_outcome",
+        overallSuccess: realFindingsCount > 0,
+        toolResultsCount: toolOutputs.reduce((n, o) => n + (o.toolResults?.length || 0), 0),
+        realFindingsCount,
+      });
```

### Proposed diff — `tools/harness-eval/sql/baseline.sql` (Q2 picks up both events)

```diff
 FROM workflow_logs
-WHERE message = 'Attack tree execution completed';
+WHERE message IN ('Attack tree execution completed', 'Workflow completed successfully')
+  AND context ? 'overallSuccess';   -- after P0-3, json→jsonb: use context->'overallSuccess' IS NOT NULL
```

(Mirror the same `IN (...)` change in `normalize-kpis.mjs`'s `runs` query.)

---

## P0-1 (stopgap) — `tool_registry` config + correct routing

A registry config can only **append** params, so it cannot build Metasploit's
`-x` script with the target in the middle. Two honest options:

**Option A (recommended, correct):** Drive Metasploit through the dedicated
`metasploitExecutor.execute()` (already used at `:2894`) with an explicit module
+ `RHOSTS`, and **remove `metasploit` from the generic agents' `enabledTools`**
so it never takes the bare-command stub path. This is a config/agent change, not
a code rewrite.

**Option B (stopgap only):** Give the row a non-interactive `baseCommand` that at
least *fails loudly* instead of printing a banner and exiting 0, so the evidence
gate and exit code agree. See `metasploit-registry-config.sql` in this folder —
**review and run manually; it is not auto-applied.**

> Even with Option B, keep P0-2: the gate is what guarantees no *other*
> misconfigured tool can fabricate success the same way.

---

## Rollout order & verification

1. **Merge P0-3 + P0-2 helper/gate** (observability + gate; cascade flag stays off).
   - Verify: run a workflow, then `node tools/harness-eval/normalize-kpis.mjs && node tools/harness-eval/report.mjs`.
     The banner run now shows `completed=0`, `hasEvidence=false` in logs, and the
     completion event carries `overallSuccess:false`, `realFindingsCount:0`.
2. **Fix routing (P0-1 Option A)** so a real module actually runs; re-baseline and
   confirm `realFindingsCount > 0` on a genuine target.
3. **Enable `FF_REQUIRE_TOOL_EVIDENCE=true`** once the gate is trusted, so
   zero-evidence runs fail instead of cascading.

### Tests to add (proposed)
- Unit: `assessToolEvidence` — bare-target command → `hasEvidence:false`;
  msfconsole splash → false; nmap "0 hosts up" substantive output → true;
  structured `parsedOutput` → true.
- Integration: a workflow whose only tool returns exit 0 + banner ends with the
  task `failed` (flag on) / `completed=0` (flag off), and the report writer is
  not invoked on a zero-evidence chain.

## Risk & reversibility
- P0-3: additive logging only — no behavior change.
- P0-2 gate: changes which runs count as `completed`; default flag keeps control
  flow identical until you opt in. Signatures are conservative (command-shape +
  banner), so honest empty scans are unaffected.
- P0-1 Option A: removes a tool from generic agents — verify no workflow depends
  on the (currently fabricated) Metasploit-via-generic path before/after.
