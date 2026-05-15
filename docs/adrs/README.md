# Architecture Decision Records

ADRs capture decisions whose rationale isn't obvious from the code alone — usually because the alternative was *also* viable and a future contributor might otherwise undo the choice.

## Index

| # | Title | Status | Date |
|---|-------|--------|------|
| 009 | [Tonic 0.10 → 0.14 bump in rust-nexus](adr-009-tonic-014-bump.md) | Accepted | 2026-05-06 |
| 010 | [Canonical location for `a2a.proto`](adr-010-a2a-proto-canonical-location.md) | Accepted | 2026-05-06 |
| 011 | [Wrap (don't replace) `AgentMessageBus` for A2A](adr-011-agent-message-bus-wrap-strategy.md) | Accepted | 2026-05-06 |
| 012 | [GML telemetry is shadow-only in the v2.9.6.1 initiative](adr-012-gml-shadow-only-scope.md) | Accepted | 2026-05-06 |

ADRs 001–008 predate this initiative and are not yet indexed here. Add them when touched.

## Format

Each ADR follows the standard four-section layout:

- **Context** — what's the situation that forces a decision?
- **Decision** — what did we choose, in one sentence at the top of the section?
- **Consequences** — what becomes easier, harder, or constrained by this choice?
- **Alternatives considered** — what we rejected and why, so future readers don't relitigate.
