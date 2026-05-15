# ADR 011 — Wrap (don't replace) `AgentMessageBus` for A2A

**Status:** Accepted
**Date:** 2026-05-06
**Initiative:** v2.9.6.2 (Phase H)
**Owner:** server/services maintainers

## Context

`server/services/agent-message-bus.ts` (≈409 lines, EventEmitter-based) is the in-process message hub for rtpi agents. It backs:

- `agent-loops.ts` (agent-to-agent loops with circuit breakers)
- `agent-conversation-service.ts` (multi-turn agent dialogue)
- `tool-execution-loop.ts` (agent-tool inner loops)
- `operations-manager-agent.ts` (event-driven operations synthesis)

State is persisted in DB tables `agentMessages`, `agentMessageSubscriptions`. Subscriptions support agent-to-agent, broadcast-to-role, and TTL-expiring messages.

v2.9.6.2 introduces MatrixA2A's `InMemoryChannel` and `GrpcChannel` as alternative transports. Three viable strategies:

1. **Replace.** Rip out `AgentMessageBus`, route everything through `matrix_a2a`.
2. **Wrap.** Introduce an `A2ATransport` interface; keep `AgentMessageBus` as the default in-process implementation; route only `is_a2a_enabled` agents through MatrixA2A.
3. **Coexist.** Two parallel buses, agents pick one.

## Decision

**Wrap.** `AgentMessageBus` stays. Add an `A2ATransport` interface where:

```typescript
interface A2ATransport {
  send(from: AgentRef, to: AgentRef, msg: AgentMessage): Promise<void>;
  subscribe(agent: AgentRef, handler: (msg: AgentMessage) => Promise<void>): Subscription;
}
```

The existing `AgentMessageBus` becomes the default `A2ATransport` implementation (`InMemoryDbTransport`). MatrixA2A is added as a second implementation (`MatrixA2AGrpcTransport`). The selector is per-agent: rows with `agents.isA2aEnabled = true` route through `MatrixA2AGrpcTransport`; everyone else stays on the default.

## Consequences

**Easier:**
- Existing call sites do not change. `agent-loops.ts`, `agent-conversation-service.ts`, etc. keep working untouched.
- A2A rollout is per-agent, so we can canary one agent at a time. If it breaks, flip `isA2aEnabled` back to `false`.
- The `agentMessages` table remains the single source of truth for human-debuggable message history. The MatrixA2A audit log (BLAKE3 hash-chain) is an additional record specific to A2A-enabled paths.

**Harder:**
- Two transports means two failure modes. Operators need a UI signal showing which transport an agent is using — adds a small column to the agent details view.
- Cross-transport messaging (A2A-enabled agent sending to a non-A2A agent) needs an explicit fallback path: if `to.isA2aEnabled = false`, write through `InMemoryDbTransport`. Document this in `server/services/agent-message-bus.ts`.

**Constrained:**
- Don't put A2A-only fields (e.g. matrix routing scores, A2A-specific metadata) into the `agentMessages` table. They belong in MatrixA2A's storage, joined by message ID when needed.
- The capability matrix gate (Phase H) lives at the *transport level*, not inside `AgentMessageBus`. `MatrixA2AGrpcTransport` enforces capabilities; `InMemoryDbTransport` does not (existing agents continue working under the existing implicit trust model).

## Alternatives considered

1. **Replace.** Rejected: half the agent stack ends up rewritten. `AgentLoopService` alone is ~260 lines and tightly coupled to the message bus's contract. Time better spent shipping A2A as additive.
2. **Coexist (no shared interface).** Rejected: every caller has to know which bus to use. Two parallel APIs is the worst of both worlds.
3. **Migrate per-feature instead of per-agent.** Considered. Rejected because feature boundaries don't cleanly align with agent boundaries — `tool-execution-loop.ts` would need to dual-route on the same agent.

## Verification gate

A0 lock is met when this ADR exists and is referenced. Implementation in Phase H is complete when:

- Toggling `agents.isA2aEnabled = true` for one agent successfully routes its outbound messages through `MatrixA2AGrpcTransport` (verified via audit log entries).
- Toggling it back to `false` returns the agent to `InMemoryDbTransport` with no message loss.
- A non-A2A agent can still receive a message from an A2A-enabled agent (cross-transport fallback verified).
