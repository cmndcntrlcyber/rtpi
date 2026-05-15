# ADR 012 — GML telemetry is shadow-only in the v2.9.6.1 initiative

**Status:** Accepted
**Date:** 2026-05-06
**Initiative:** v2.9.6.1 (Phase G + I)
**Owner:** services/gml-inference + Operations / Intelligence / Automation surface owners

## Context

v2.9.6.1's research doc describes a Graph Machine Learning pipeline (heterogeneous GraphSAGE on hourly snapshots, supervised on SIEM alert counts) terminating in a hysteresis-based control loop that throttles agent activity rates when "noise" exceeds a learned threshold.

The doc explicitly warns:

> Coordinate with security teams — never deploy silent activity throttling without visibility.

Throttling is the high-value endpoint of the pipeline. It is also the highest-risk: a model trained on biased data, attacked with adversarial inputs, or drifted off-distribution can silently strangle red-team operations during a live engagement.

## Decision

This initiative ships GML in **shadow + visualization mode only**:

- The model trains on real data (B3's `agentSwarmGraphs` snapshots and `siemAlerts` table).
- Predictions are logged to a `gmlPredictions` table (Phase G) and surfaced in three read-only places (Phase I): an Operations widget, a CTI confidence multiplier, and a `gml.high_noise_detected` event with no listeners.
- **No throttling, no rate floors, no hysteresis control loop, no kill-switch wiring.** The downstream control work is explicitly carved out and deferred to a follow-up enhancement (working name: v2.9.6.1.1).

When the user, security team, and operations team are jointly ready to greenlight enforcement, that initiative will:

1. Add hysteresis state machine (with documented entry/exit thresholds).
2. Add per-operation kill switch (independent of `FF_GML_TELEMETRY` so flag-flip races can't disable the safety).
3. Add per-agent rate floor (a minimum activity level the model cannot drive below).
4. Run shadow-vs-enforced parallel for ≥2 engagements before defaulting on.

## Consequences

**Easier:**
- This initiative finishes in 13 weeks instead of 17–20.
- Security-team review is simpler: there is no enforcement path to audit.
- Model can be retrained, replaced, or removed with zero blast radius on operations.

**Harder:**
- The downstream throttling work doesn't get the benefit of "the pipeline is already deployed; we just add a switch." A v2.9.6.1.1 must explicitly engineer the hysteresis controller from scratch.
- Operators may see the GML widget and assume something is acting on it. The widget UI must clearly label this as advisory/observational.

**Constrained:**
- `workflow-event-handlers.ts` adds a `gml.high_noise_detected` event type but **must not register any listener** in this initiative. Explicit comment on the event registration site.
- `hourly-ops-workflow.ts` may include GML scores in `agentActivityReports` (informational) but **must not branch decisions** on them.
- The frontend graph viz (Phase G) and Operations widget (Phase I) must include a "Shadow mode — not enforcing" badge.

## Alternatives considered

1. **Full pipeline including throttling and drift-monitor.** Rejected per user decision recorded in plan file `please-review-the-following-glimmering-hartmanis.md`. Too risky to ship in a single initiative without a security-team coordination cycle.
2. **Skip GML entirely; defer to a later initiative.** Rejected: the data plumbing (B3) is independent of the model and useful on its own (alert sink + snapshot history). Shadow inference adds modest scope and validates the pipeline end-to-end.
3. **Ship shadow-mode but include a "manual throttle" UI button.** Rejected: a manual button still implies automation, blurring the line. Operators who want to throttle today have agent-level controls already.

## Verification gate

Phase I completion is met when:

- `grep -r "throttle\|rate_limit\|hysteresis" services/gml-inference/ server/services/gml-*` returns nothing in active code (only in comments referencing this ADR).
- The Operations widget, CTI display, and `gml.high_noise_detected` event are wired but no consumer mutates agent state based on them.
- `docs/configuration/gml-shadow.md` (added in Phase J) explicitly states the shadow-only constraint and references this ADR.
