# ADR 010 — Canonical location for `a2a.proto`

**Status:** Accepted
**Date:** 2026-05-06
**Initiative:** v2.9.6.2 (Phase A0 + D)
**Owner:** services/a2a + rust-nexus maintainers

## Context

v2.9.6.2 vendors the upstream `a2aproject/A2A` `a2a.proto` plus a small `a2a_matrix/v1/matrix.proto` extension. Both Python (via `grpcio-tools`) and Rust (via `tonic-build`) need to generate from this proto tree.

Two viable homes:

1. **`rust-nexus/nexus-infra/proto/a2a/v1/a2a.proto`.** Sits next to the existing `nexus.proto`. Single Rust-friendly tree.
2. **`services/a2a/proto/a2a/v1/a2a.proto`.** Sits next to the Python package that's the primary consumer.

Whichever path is chosen, the *other* language's build pipeline has to reach into that directory.

The risk we're optimizing against: silent forks. If both languages vendor independently, version drift between them is invisible until runtime — at which point messages serialize and deserialize but field-number mismatches corrupt routing.

## Decision

Canonical location is `rust-nexus/nexus-infra/proto/`. Subdirectories:

```
rust-nexus/nexus-infra/proto/
├── nexus/v1/nexus.proto         # existing
├── a2a/v1/a2a.proto             # vendored from a2aproject/A2A at pinned tag (Phase D)
└── a2a_matrix/v1/matrix.proto   # rtpi extension for matrix routing (Phase D)
```

The Python build (in `services/a2a/`) invokes `grpcio-tools.protoc` against this tree via a relative path (`../../rust-nexus/nexus-infra/proto/`) in its `pyproject.toml` build script or a checked-in `Makefile`. Generated Python stubs land in `services/a2a/src/matrix_a2a/codegen/` — not committed; regenerated as part of the build.

The Rust build (in `crates/a2a-matrix-rs/`, a rust-nexus workspace member) uses `tonic-build` against the same tree via `build.rs`, also relative.

## Consequences

**Easier:**
- One source of truth. `git diff` on the proto tree is the authoritative change record.
- A2A version pin is documented in one place (this ADR plus the proto file's leading comment).
- Mesh-related protos can land under `nexus/v1/` or a new `mesh/v1/` next door without context-switching repos.

**Harder:**
- Python build needs to traverse out of `services/a2a/` to reach the proto. Operationally fine for a monorepo; would be friction if `services/a2a/` is ever extracted to a separate package — at which point the protos travel with it as a vendored copy with a pin recorded in the new repo.
- CI must invalidate caches when `rust-nexus/nexus-infra/proto/**` changes for both Rust and Python build steps.

**Constrained:**
- Anyone adding a new proto to `services/a2a/` or `services/gml-inference/` must add it to `rust-nexus/nexus-infra/proto/` instead. Document this in the `services/a2a/README.md`.
- Pin the upstream A2A release tag in the proto file's leading comment AND in this ADR's "Pin record" section. Bump them together.

## Alternatives considered

1. **`services/a2a/proto/`** (Python-tree home). Rejected: Rust crate `a2a-matrix-rs` lives in rust-nexus, so the tonic-build path becomes a `../../../services/a2a/proto/` traversal. Same friction, less neighborly with `nexus.proto`.
2. **A separate top-level `proto/` directory at the rtpi root.** Rejected: orphan directory with no obvious owner; nexus-infra's `build.rs` is the existing canonical proto consumer.
3. **Vendored independently in both locations.** Rejected: silent-fork risk (see Context).

## Pin record

| Date | A2A release tag | Notes |
|------|-----------------|-------|
| TBD (Phase D)  | (TBD; pin to a specific tag, e.g. `v0.3.x`) | Initial vendor. Document in proto file header. |

## Verification gate

A0 ADR completion is met when:

- The directory tree above exists (the proto files themselves arrive in Phase D — this ADR locks the location).
- Both `services/a2a/README.md` and `crates/a2a-matrix-rs/README.md` (when those land in B2/D) reference this ADR.
