# v{X.Y.Z} — {Enhancement Title}

<!-- ============================================================
     RTPI Enhancement Document Template
     ============================================================
     Two document types are supported — pick the section set that
     fits your work, delete the other, and remove all HTML comments.

     TYPE A — Feature Spec  (new capability, integration, workflow)
              Used by: v2.9.x, v3.0.x
     TYPE B — Repair / Audit  (health grade, evidence-based fixes)
              Used by: v3.1.x

     Shared sections (both types):  Overview, Verification
     ============================================================ -->

<!-- ─── Metadata: pick ONE block ─── -->

<!-- TYPE A — Feature Spec -->
**Created:** {YYYY-MM-DD}
**Status:** Planning | In Progress | Complete
**Priority:** LOW | MEDIUM | HIGH | CRITICAL — {one-line justification}

<!-- TYPE B — Repair / Audit -->
**Grade: {F–A}** | Target: {F–A} | Priority: {1–N (1 = fix first)}

---

## Overview

<!-- 1–3 paragraphs. What this enhancement does (Type A) or what the current
     state looks like and why it needs repair (Type B). Reference existing
     services, routes, and schema tables by relative path so readers can
     click through. -->

{Describe the enhancement, its scope, and its relationship to existing RTPI
subsystems. Link to prior enhancements if this builds on earlier work.}

---

<!-- ============================================================
     TYPE A — Feature Spec sections
     ============================================================ -->

## Current State Analysis

### Existing Implementation

<!-- Bullet list of what already exists: services, routes, schema tables,
     hooks, components. Include file paths and line numbers. -->

- [`shared/schema.ts:{lines}`](../../../shared/schema.ts#L{start}-L{end}) — {what it defines}
- [`server/services/{service}.ts`](../../../server/services/{service}.ts) — {what it does}
- [`server/api/v1/{route}.ts`](../../../server/api/v1/{route}.ts) — {endpoints it exposes}
- [`client/src/hooks/{hook}.ts`](../../../client/src/hooks/{hook}.ts) — {frontend data layer}

### What's Missing

<!-- Bullet list of gaps this enhancement fills. -->

- {Gap 1}
- {Gap 2}
- {Gap 3}

---

## Architecture

<!-- ASCII or Mermaid diagram showing how the new components relate to
     existing ones. Keep it readable at 80 columns. -->

```
┌─────────────────────┐
│  {New Component}    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  {Existing Service} │
└─────────────────────┘
```

---

## Engineering Scaffold — Phase {N}: {Phase Title}

<!-- Repeat this section for each phase. Phases are ordered by dependency:
     schema first, then backend, then frontend, then tests/docs. -->

- **Goal:** {One sentence — what this phase delivers.}
- **Reuses:** {Existing files/patterns this builds on, with relative links.}
- **Work items:**
  - [ ] {Task 1 — specific enough to be a single PR}
  - [ ] {Task 2}
  - [ ] {Task 3}
- **API additions:**
  - `{METHOD} /api/v1/{resource}` `[{roles}]` — {what it does}
  - none (if no new endpoints)
- **Schema changes:**
  - Migration `{NNNN}_{name}.sql` — {what it alters/adds}
  - none (if no schema changes)
- **Acceptance:**
  - {Concrete, testable criterion 1}
  - {Concrete, testable criterion 2}
- **Effort:** S | M | L | XL. **Flag:** `{FF_FEATURE_NAME}` | none.

---

<!-- Duplicate the "Engineering Scaffold" block above for each additional
     phase. Number phases sequentially. -->

<!-- ============================================================
     TYPE B — Repair / Audit sections
     ============================================================ -->

## Evidence

<!-- Bullet list linking to specific files and line numbers that support the
     grade. Each bullet should state what was found, not what should change. -->

- **{Component}** (`{file path}`): {What exists / what's broken / what's missing.}
- **Test coverage**: {Which tests exist, which are absent.}

---

## Repair Items

<!-- Table of prioritized fixes. Effort key: S = hours, M = 1-2 days,
     L = 3-5 days, XL = 1-2 weeks. -->

| # | Item | Effort | Files |
|---|------|--------|-------|
| 1 | {Highest-priority fix} | S | `{file path}` |
| 2 | {Next fix} | M | `{file path}` |
| 3 | {Next fix} | L | New: `{file path}` |

---

## Implementation Notes

<!-- One subsection per non-trivial repair item. Describe the approach,
     reference existing patterns to follow, and call out gotchas. -->

### {Repair Item Title}

{How to implement this item. Reference existing code patterns. Call out
edge cases or ordering dependencies between items.}

---

<!-- ============================================================
     Shared sections (both types)
     ============================================================ -->

## Verification

<!-- Numbered list of manual or automated checks that confirm the
     enhancement is complete. These should be runnable by any team member. -->

1. {Check 1 — e.g., "Confirm `GET /api/v1/{resource}` returns 200 with expected shape"}
2. {Check 2 — e.g., "Run `npm test -- --grep '{pattern}'` and confirm all pass"}
3. {Check 3 — e.g., "Start the dev server; navigate to {page}; verify {behavior}"}

---

## Cross-References

<!-- Optional. Link to related enhancements, shared repair items, or
     external documentation. -->

- Related: [v{X.Y.Z}]({relative path}) — {why it's related}
- Shared item: [{description}]({link to item in another doc})
- External: [{doc name}]({relative path}) — {what it covers}

---

<!-- ============================================================
     VERSION-LEVEL INDEX (v{X.Y}-IMPLEMENTATION-STATUS.md)
     ============================================================
     When a version has multiple enhancement docs, create a sibling
     index file following this structure:
     ============================================================ -->

<!--
# v{X.Y} — {Version Theme}

**Audited:** {YYYY-MM-DD}
**Theme:** {One-line description of the version's focus}

## Scorecard

| Enhancement | Component | Grade | Target | Status |
|-------------|-----------|-------|--------|--------|
| [v{X.Y.1}](v{X.Y.1}-{slug}.md) | {Component Name} | {Grade} | {Target} | Not started / In progress / Complete |

## Effort Summary

| Effort | Count | Description |
|--------|-------|-------------|
| S (hours) | {N} items | Quick fixes, config changes, single-file edits |
| M (1-2 days) | {N} items | Moderate scope, multi-file changes |
| L (3-5 days) | {N} items | Significant new functionality or test suites |
| XL (1-2 weeks) | {N} items | Large-scale systematic changes |

## Critical Path

1. **v{X.Y.Z} Item {N}** — {Description} ({severity}, effort {S/M/L/XL})

## Cross-References

- Items shared between enhancements:
  - {Description}: [v{X.Y.A} Item {N}](v{X.Y.A}-{slug}.md) = [v{X.Y.B} Item {N}](v{X.Y.B}-{slug}.md)
-->
