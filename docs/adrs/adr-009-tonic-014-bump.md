# ADR 009 — Tonic 0.10 → 0.14 bump in rust-nexus

**Status:** Accepted
**Date:** 2026-05-06
**Initiative:** v2.9.6 / v2.9.6.2 (Phase A1)
**Owner:** rust-nexus maintainers

## Context

The rust-nexus workspace pins `tonic = "0.10"`, `prost = "0.12"`, `tonic-build = "0.10"` in the root `Cargo.toml`. v2.9.6.2 (MatrixA2A) wants Tonic 0.14 + Prost 0.14 on the Rust side so that `crates/a2a-matrix-rs` can consume the upstream `a2aproject/A2A` proto without per-crate version pinning.

A two-Tonic workspace compiles, but causes:

- Symbol duplication for `tonic::Status`, `tonic::transport::*`, `prost-types`. Anything generated from a shared proto produces incompatible types depending on which Tonic generated it.
- Increased binary size (two copies of every gRPC primitive).
- A landmine for the `a2a-matrix-rs` adapter: if it ends up consuming `nexus.proto` types via `nexus-infra` *and* `a2a.proto` types via its own build script, the two `Status` types are incompatible.

## Decision

Bump the entire rust-nexus workspace to `tonic = "0.14"`, `prost = "0.14"`, `tonic-build = "0.14"` as a dedicated isolated phase (initiative phase A1) on a `chore/tonic-0.14-bump` branch, landing **before** v2.9.6.2's A2A gRPC interop work (initiative phase D), but **after** the joint scaffold (A0) and parallel-track Phase 1 mesh-identity work (B1) which does not touch gRPC.

## Consequences

**Easier:**
- `a2a-matrix-rs` consumes `a2a.proto` and `nexus.proto` from a single Tonic without conversion code.
- Future protocol additions (e.g. mesh control protos in Phase E) get a single generation pipeline.

**Harder:**
- Every existing gRPC handler in `nexus-infra/src/grpc_server.rs` and `nexus-infra/src/grpc_client.rs` gets touched. Tonic 0.10 → 0.14 has ergonomics changes around `tonic::Streaming`, `Request<T>::into_inner()`, and `tonic::transport::ServerTlsConfig` that need an audit.
- `rcgen 0.11` (used for ACME) may need a paired bump if it links against an incompatible `rustls`. Check during A1.

**Constrained:**
- Phase D cannot start until A1 lands and is verified end-to-end.
- The TS bridge at `server/api/v1/rust-nexus.ts` is unaffected because the bridge is at the DB layer (`rustNexusImplants`, `rustNexusTelemetry`, etc.), not at the gRPC layer. But verify zero regressions in the bridge as part of A1's smoke test.

## Alternatives considered

1. **Defer indefinitely; pin `a2a-matrix-rs` to Tonic 0.10.** Rejected: A2A's upstream proto evolves, and Tonic 0.10 is going EOL as the Tonic maintainer transitions to the new gRPC-Rust effort. We'd be pinning to a dead branch.
2. **Allow a two-Tonic workspace.** Rejected: see "Context" — the symbol-duplication issue is silent until runtime, and we share proto-generated types across crates.
3. **Move A2A protos out of rust-nexus entirely.** Rejected: cross-language interop with `services/a2a/` (Python) wants a single canonical proto tree (see ADR 010), and that tree lives in rust-nexus.

## Pin strategy

- Pin `tonic = "0.14.x"` (any patch). Avoid `*` and `>=`.
- Re-evaluate when `grpc-rust` (the renamed successor) ships its first stable release. Track in a follow-up ADR.

## Verification gate

A1 is complete when:

- `cargo check --workspace` and `cargo check --workspace --all-features` are clean.
- All existing tests in `nexus-infra/tests/` and `nexus-agent/tests/` pass.
- A real implant or the integration test suite completes register → heartbeat → task-dispatch → result round-trip.
- `server/api/v1/rust-nexus.ts` continues to read/write the `rustNexus*` DB tables without changes.
