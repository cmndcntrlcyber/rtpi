# Harness Retrospective — <YYYY-MM-DD>

> Copy this file to `docs/optimization/retrospectives/<YYYY-MM-DD>-<topic>.md` and
> fill it in. This converts the ad-hoc `docs/archive/improvements/` practice into
> a recurring Kaizen loop. Pair each retro with a fresh baseline:
> `node tools/harness-eval/normalize-kpis.mjs <YYYY-MM-DD> && node tools/harness-eval/report.mjs`.

## 1. Cycle context
- **Period covered:**
- **Baseline label (from `out/baseline-report.md`):**
- **What changed since last cycle (proposals shipped):**

## 2. CTQ scorecard (vs. control limits)
| CTQ | Last cycle | This cycle | Control limit | In control? |
|-----|-----------|-----------|---------------|-------------|
| Workflow success rate | | | tracked once computable | |
| AI-call latency p95 | | | ≤ 30 s | |
| AI-call failure rate | | | ≤ 2% | |
| Harness token cost / run | | | (set after #2 ships) | |
| Runs hitting safety limit | | | rare | |
| Defect count (Pareto top) | | | trending down | |

> Rule: a blank / `n/a` cell is **unmeasured**, not zero. Note which CTQs are
> still unobservable and why.

## 3. Evidence-verified objectives
| Objective | Claim | Verification method | Evidence | Verdict (PASS/FAIL/PARTIAL/UNVERIFIABLE) |
|-----------|-------|---------------------|----------|------------------------------------------|
| | | | | |

> No PASS without an attached artifact (log query, sandbox output, screenshot).

## 4. Root cause of the cycle's top defect
- **Defect:**
- **Analysis tool (5 Whys / Fishbone / Pareto):**
- **Root cause:**
- **Waste category (DOWNTIME):**

## 5. What worked / what didn't / what surprised us
- **Worked:**
- **Didn't:**
- **Surprised us:**

## 6. Next Kaizen backlog (ICE-ranked)
| # | Priority | Action | CTQ moved | Expected effect | How verified | Risk |
|---|----------|--------|-----------|-----------------|--------------|------|
| 1 | | | | | | |

## 7. Control breaches this cycle
- (Any run with 0 completion events, token-less `ai_call`, or a CTQ outside its
  control limit. List them — these are not allowed to pass silently.)
