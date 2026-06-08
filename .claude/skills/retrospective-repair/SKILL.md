---
name: retrospective-repair
description: >
  Review the latest nightly retrospective from the harness-optimization-evaluator
  and implement its Kaizen backlog — all unapplied P0 items, then the top remaining
  unapplied item — with per-item verification, rollback docs for DB/.env changes,
  and one git commit per item. Use this skill whenever the user asks to process,
  repair, implement, action, or "ship" a retrospective, retro, Kaizen backlog,
  DMAIC report, or the nightly/overnight harness evaluation findings — including
  phrasings like "fix the P0s from last night", "implement the retro", "action the
  optimization backlog", or any mention of files under docs/optimization/.
---

# Retrospective Repair

The `harness-optimization-evaluator` agent finds defects; this skill ships the fixes.
It closes the Kaizen loop: evaluator writes an evidence-based retrospective overnight,
this skill turns the backlog into verified, committed changes the next day. The same
evidence discipline the evaluator uses applies here in reverse — nothing counts as
"applied" without a verification artifact, because the next retrospective will
re-measure these CTQs and a fake fix shows up as a control breach.

## Where things live

| Artifact | Path |
|---|---|
| Retrospectives (one per cycle) | `docs/optimization/retrospectives/<YYYY-MM-DD>-<topic>.md` |
| Retro template (skip it) | `docs/optimization/retrospectives/TEMPLATE.md` |
| Paired DMAIC reports (full analysis) | `docs/optimization/rtpi-harness-dmaic*.md` |
| Fix ledger + rollback docs | `docs/optimization/proposed-fixes/` |
| Evaluator's memory (current known state) | `.claude/agent-memory/harness-optimization-evaluator/` |
| KPI tooling | `tools/harness-eval/normalize-kpis.mjs`, `tools/harness-eval/report.mjs` |

## Step 1 — Read the latest retrospective and its context

Pick the newest dated file in `docs/optimization/retrospectives/` (filename sort
works — they're date-prefixed; exclude `TEMPLATE.md`). Read in full:

1. The retrospective — especially **section 6, "Next Kaizen backlog (ICE-ranked)"**
   (a table: `# | Priority | Action | CTQ moved | Expected effect | How verified | Risk`)
   and **section 7, "Control breaches"**.
2. The paired DMAIC report it references (linked near the top) — this carries the
   root-cause analysis and exact source locations (`file.ts:line`) the backlog rows
   compress away. Implementing from the backlog row alone loses that context.
3. Everything in `docs/optimization/proposed-fixes/` — this is the ledger of what
   has already shipped.
4. The evaluator's memory files — they summarize confirmed facts and key source
   locations and are usually fresher than the prose in older reports.

## Step 2 — Establish what is already applied

Retrospectives lag reality: an item may have shipped after the retro was written.
Re-implementing an applied fix wastes a cycle at best and regresses a deliberate
decision at worst (e.g., a fix applied as "Option A" where the backlog row described
"Option B"). For each backlog item, check in order:

1. `proposed-fixes/` docs with a `Status: APPLIED` (or `BLOCKED`/`SUPERSEDED`) header
   covering the item.
2. `git log --oneline -20` for commits referencing the item or retro date.
3. The actual artifact — does the code/DB/config already contain the change? A
   30-second read of the named file or a single DB query settles it.

Treat an item as applied only when the artifact confirms it, not just because a doc
claims it. Conversely, if the artifact shows the fix exists but no ledger entry does,
record it as applied (write the ledger entry) rather than redoing it.

## Step 3 — Select the work

From the backlog table, take **every unapplied P0 item, in table order**. If no
unapplied P0s remain, take **the single top-ranked unapplied item** (lowest `#`,
i.e., best ICE score) regardless of priority. One skill run never reaches past
that — depth of verification beats breadth of changes; the nightly cycle will
surface the next item tomorrow.

Before touching anything, tell the user the selected items and what each will change
(source / DB / .env), then proceed.

If an item cannot be implemented as scoped — it needs a human decision, external
access, or contradicts something discovered in Step 2 — don't improvise a different
fix under the same name. Write a `proposed-fixes/` entry with `Status: BLOCKED` and
the reason, skip it, and continue with the next item.

## Step 4 — Implement, one item at a time

Work items strictly sequentially: implement → verify → record → commit, then the
next item. Never batch implementation ahead of verification — if item 2's change
breaks item 1's verification, interleaved evidence becomes worthless.

- **Source changes:** follow the DMAIC report's source locations. Match the
  surrounding code's idiom. Run the narrowest relevant check (`npx tsc --noEmit`
  filtered to touched files, unit tests for the touched service).
- **DB changes** (e.g., `tool_registry` rows): capture the current value FIRST
  (a `SELECT` of the rows about to change), write the rollback doc (below), then
  apply. Use the existing drizzle client or `psql` against the configured
  `DATABASE_URL`.
- **.env / feature flags:** record the prior value in the rollback doc; also check
  `.env.example` — if the flag is new, document it there too so deploys don't
  silently miss it.

### Rollback docs (required for every DB or .env change)

Before applying, write `docs/optimization/proposed-fixes/ROLLBACK-<YYYY-MM-DD>-<topic>.md`
containing: what is being changed, the exact prior state (captured values, not
described from memory), the exact commands/SQL to restore it, and why the change is
safe to revert. Source-only changes don't need one — git is their rollback.

## Step 5 — Verify with the backlog's own criterion

Each backlog row has a **"How verified"** column — that is the acceptance test, not
a suggestion. Run it (or the closest executable equivalent) and capture the artifact:
command output, DB query result, KPI report line. If the stated verification isn't
currently runnable (e.g., it requires a full harness run), say so explicitly and
verify the strongest available proxy — then record the verdict as PARTIAL, never PASS.

The evaluator's rule applies: **no PASS without an attached artifact.** Blank or
"should work" is a FAIL for the purposes of this skill.

## Step 6 — Record and commit

Per item, after verification:

1. **Ledger:** update the covering `proposed-fixes/` doc (or create
   `<YYYY-MM-DD>-<topic>.md`) with a header block: `Status: APPLIED <date>`, what
   was done, the verification verdict + evidence, and the rollback doc path if any.
   This ledger is what Step 2 of the *next* run trusts — write it for that reader.
2. **Commit on main**, one commit per backlog item, message format:

   ```
   fix(harness): <imperative summary of the change> [retro <YYYY-MM-DD> #<row>]
   ```

   Include the source changes AND the ledger/rollback docs for that item in the
   same commit, so the record travels with the change.

## Step 7 — Report

End with a summary table the user can scan in ten seconds:

```
## Retrospective Repair — <retro date>
| # | Priority | Action | Result | Evidence | Commit |
|---|----------|--------|--------|----------|--------|
| 1 | P0 | <action> | APPLIED / BLOCKED / ALREADY APPLIED | <artifact ref> | <sha> |
```

Follow with anything the next nightly evaluation should know: items left unapplied,
PARTIAL verdicts and what would upgrade them to PASS, and any discrepancy found
between the retro's claims and observed reality (the evaluator should hear about
its own measurement gaps).
