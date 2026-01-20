# Rust-Nexus Build Errors Troubleshooting Guide

This document covers common build errors encountered when compiling the rust-nexus agent and their solutions.

## Current Build Status

As of the last troubleshooting session, there are **5 remaining compilation errors** in `nexus-infra` related to dependency API changes.

---

## Error Summary Table

| Error Code | File | Issue | Status |
|------------|------|-------|--------|
| `E0432` | `cert_manager.rs` | `rustls_pemfile::private_key` import doesn't exist | Pending |
| `E0425` | `cert_manager.rs` | `pem::parse()` function doesn't exist | Pending |
| `E0425` | `letsencrypt.rs` | `pem::parse()` function doesn't exist | Pending |
| `E0603` | `cert_manager.rs` | `time::OffsetDateTime` is private | Pending |
| `E0603` | `cert_manager.rs` | `time::Duration` is private | Pending |

---

## Detailed Error Fixes

### 1. rustls_pemfile API Change (E0432)

**Error:**
```
error[E0432]: unresolved import `rustls_pemfile::private_key`
```

**Cause:** The `rustls_pemfile` crate changed its API. The `private_key()` function signature changed in newer versions.

**Fix:** Update the import and usage in `nexus-infra/src/cert_manager.rs`:

```rust
// Old API (broken)
use rustls_pemfile::{certs, private_key};
let private_key = private_key(&mut reader)?;

// New API (rustls_pemfile 2.x)
use rustls_pemfile::{certs, pkcs8_private_keys, rsa_private_keys};

// Try PKCS8 first, then RSA
let keys = pkcs8_private_keys(&mut reader)
    .map(|k| k.map(|k| PrivateKey(k.secret_pkcs8_der().to_vec())))
    .collect::<Result<Vec<_>, _>>()?;
```

---

### 2. pem Crate API Change (E0425)

**Error:**
```
error[E0425]: cannot find function `parse` in module `pem`
```

**Cause:** The `pem` crate renamed `pem::parse()` in newer versions.

**Fix:** Update the function call:

```rust
// Old API (broken)
let pem = pem::parse(cert_pem)?;

// New API (pem 3.x)
let pem = pem::parse(cert_pem)
    .map_err(|e| InfraError::CertificateError(format!("Failed to parse PEM: {}", e)))?;

// Or use the Pem struct directly
use pem::Pem;
let pem: Pem = cert_pem.parse()?;
```

**Alternative:** Pin the pem crate to an older version in `Cargo.toml`:
```toml
pem = "1.1"  # Instead of latest
```

---

### 3. time Crate Private Types (E0603)

**Error:**
```
error[E0603]: struct `OffsetDateTime` is private
error[E0603]: struct `Duration` is private
```

**Cause:** The `time` crate requires explicit feature flags to expose these types.

**Fix:** Update `nexus-infra/Cargo.toml`:

```toml
# Before
time = "0.3"

# After - enable macros feature for proper exports
time = { version = "0.3", features = ["std", "macros"] }
```

And use the correct import path:

```rust
// Correct imports
use time::OffsetDateTime;
use time::Duration as TimeDuration;
```

---

## Previously Fixed Errors

The following errors were resolved in earlier troubleshooting sessions:

### Fixed: chrono vs time Type Mismatch
- **Issue:** `rcgen` expects `time::OffsetDateTime`, not `chrono::DateTime`
- **Solution:** Added `time` crate dependency and converted date types

### Fixed: webpki_roots API Change
- **Issue:** Field renamed from `subject_public_key_info` to `spki`
- **Solution:** Updated field access in `cert_manager.rs`

### Fixed: Hickory DNS Async Resolver
- **Issue:** Used sync `Resolver` instead of `TokioAsyncResolver`
- **Solution:** Changed to `hickory_resolver::TokioAsyncResolver`

### Fixed: Goblin COFF Symbols API
- **Issue:** Iteration now returns `(index, name_option, Symbol)` tuples
- **Solution:** Updated iteration pattern in `bof_loader.rs`

### Fixed: gRPC Stream Types
- **Issue:** `FileChunk` struct fields didn't match proto definition
- **Solution:** Updated to use correct field names

### Fixed: Duration Conversion
- **Issue:** `TokioDuration::from_std()` unnecessary
- **Solution:** Removed conversion, use `std::time::Duration` directly with tokio

### Fixed: acme-lib API Changes
- **Issue:** Account creation and certificate finalization API changed
- **Solution:** Updated to use `FilePersist`, `confirm_validations()`, and `finalize_pkey()`

---

## Docker Build Environment Issues

### Exit Code 101 - Read-Only Filesystem

**Error:**
```
error: failed to write /build/rust-nexus/Cargo.lock
Caused by: Read-only file system (os error 30)
```

**Cause:** Docker volume mounted with `:ro` flag but Cargo needs to write `Cargo.lock`

**Fix:** Remove `:ro` from volume mount in `server/services/agent-build-service.ts:148`:
```typescript
// Before
'-v', `${path.resolve(this.rustNexusPath)}:/build/rust-nexus:ro`,

// After
'-v', `${path.resolve(this.rustNexusPath)}:/build/rust-nexus`,
```

### Cross-Compilation OpenSSL Error (ARM64 Host → x86_64 Target)

**Error:**
```
cc1: error: unrecognized command-line option '-m64'
```

**Cause:** Vendored OpenSSL build uses x86-specific compiler flags on ARM64 host

**Workaround:** Build for native architecture (arm64) instead of cross-compiling to x64:
```bash
docker run --rm \
  -v /path/to/rust-nexus:/build/rust-nexus \
  -v /tmp/output:/output \
  rtpi/agent-builder:latest linux arm64 "" /output
```

---

## Verification Commands

### Check Build Errors
```bash
docker run --rm --entrypoint bash \
  -v "/path/to/rust-nexus:/build/rust-nexus" \
  rtpi/agent-builder:latest \
  -c "cd /build/rust-nexus && cargo check -p nexus-infra 2>&1"
```

### Full Build Test
```bash
docker run --rm \
  -v "/path/to/rust-nexus:/build/rust-nexus" \
  -v "/tmp/test-build:/output" \
  rtpi/agent-builder:latest linux arm64 "" /output
```

### Check Specific Error Codes
```bash
docker run --rm --entrypoint bash \
  -v "/path/to/rust-nexus:/build/rust-nexus" \
  rtpi/agent-builder:latest \
  -c "cd /build/rust-nexus && cargo check -p nexus-infra 2>&1" | grep "^error\[E"
```

---

## Dependency Version Matrix

Recommended versions for compatibility:

| Crate | Recommended Version | Notes |
|-------|---------------------|-------|
| `rustls` | `0.21` | API stable |
| `rustls-pemfile` | `1.0` | v2.x has breaking changes |
| `webpki-roots` | `0.25` | Field names changed in 0.26+ |
| `pem` | `1.1` or `3.0` | API changed between versions |
| `time` | `0.3` with features | Requires `std` and `macros` features |
| `rcgen` | `0.11` | Uses `time` crate types |
| `acme-lib` | `0.8` | Requires `FilePersist` pattern |
| `hickory-resolver` | `0.24` | Use `TokioAsyncResolver` |
| `goblin` | `0.7` | Symbol iteration changed |

---

## Next Steps

1. Fix the 5 remaining errors listed in the summary table
2. Rebuild Docker image if Dockerfile changes
3. Test full build pipeline
4. Verify agent binary is produced successfully
