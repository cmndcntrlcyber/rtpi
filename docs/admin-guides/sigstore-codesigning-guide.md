# Sigstore Codesigning Pipeline — Admin Guide

**Last Updated:** 2026-04-09
**Applies to:** rust-nexus release pipeline (v2.6.9)
**Status:** Implemented — `rust-nexus/.github/workflows/release.yml`

---

## Overview

All rust-nexus release artifacts (compiled Rust binaries, Docker container images, proto files) are cryptographically signed using [Sigstore](https://docs.sigstore.dev/) keyless signing. This provides supply chain integrity verification without managing long-lived signing keys.

**Key properties:**
- No private keys stored anywhere — uses GitHub Actions OIDC tokens
- Every signature recorded in the [Rekor transparency log](https://search.sigstore.dev/) (immutable, publicly auditable)
- Consumers verify artifacts with a single `cosign` command
- SLSA Level 3 build provenance generated via isolated reusable workflow

---

## Prerequisites

1. **GitHub repository** with Actions enabled
2. **GHCR (GitHub Container Registry)** access — comes free with any GitHub repo
3. **No signing keys needed** — Sigstore keyless signing uses GitHub's OIDC tokens automatically
4. **Rust toolchain** — handled by the workflow (installed via `dtolnay/rust-toolchain`)

No secrets to configure. No keys to generate. The pipeline uses GitHub's built-in OIDC identity provider to obtain short-lived certificates from Fulcio.

---

## Pipeline Architecture

### Files

| File | Purpose |
|------|---------|
| `rust-nexus/.github/workflows/release.yml` | 4-job CI pipeline: build, sign, verify, release |
| `rust-nexus/scripts/verify-release.sh` | End-user signature verification script |

### Job Flow

```
Tag push (v*.*.*) triggers the pipeline
  |
  +---> Job 1: build-binaries (3 targets in parallel)
  |     +-- cargo auditable build (embeds dependency metadata)
  |     +-- nexus-agent + nexus-sandbox for each target
  |     +-- SHA256 checksum per artifact
  |
  +---> Job 2: build-docker (multi-platform)
  |     +-- Docker Buildx (linux/amd64 + linux/arm64)
  |     +-- Push to ghcr.io/<repo>/nexus-agent:<version>
  |
  +---> Job 3: sign-and-release (after Jobs 1+2 complete)
  |     +-- cosign sign-blob: each binary gets .sigstore.json bundle
  |     +-- Proto files tarball: signed
  |     +-- Combined checksums.txt: signed
  |     +-- cosign sign: container image signed by digest
  |     +-- Syft: SBOM (CycloneDX) -> cosign attest (attested to image)
  |     +-- cosign verify-blob: all signatures verified in CI
  |     +-- cosign verify: container signature verified in CI
  |     +-- GitHub Release created with all artifacts
  |
  +---> Job 4: provenance (SLSA L3, isolated reusable workflow)
        +-- Non-falsifiable build provenance attestation
```

### Build Targets

| Target | OS | Architecture | Binary Extension |
|--------|----|-------------|-----------------|
| `x86_64-unknown-linux-gnu` | Linux | amd64 | (none) |
| `aarch64-unknown-linux-gnu` | Linux | arm64 | (none) |
| `x86_64-pc-windows-gnu` | Windows | amd64 | `.exe` |

### Required GitHub Actions Permissions

```yaml
permissions:
  contents: write       # Create GitHub releases
  packages: write       # Push to GHCR
  id-token: write       # Sigstore OIDC keyless signing
  attestations: write   # SBOM/vuln attestations
  actions: read         # SLSA provenance
```

---

## How Keyless Signing Works

1. GitHub Actions issues an **OIDC JWT** identifying the workflow run
2. Cosign sends the JWT to **Fulcio** (Sigstore CA), which issues a **short-lived X.509 certificate** (~10 minutes validity)
3. Cosign signs the artifact with an **ephemeral ECDSA-P256 private key**
4. The signature + certificate + Rekor inclusion proof are bundled into a single `.sigstore.json` file
5. The signing event is recorded in the **Rekor transparency log**
6. The ephemeral private key is **discarded** — it never touches disk

The certificate identity for GitHub Actions follows this pattern:
```
https://github.com/{owner}/{repo}/.github/workflows/{workflow-file}@refs/tags/{tag}
```

The OIDC issuer is always:
```
https://token.actions.githubusercontent.com
```

---

## Triggering a Release

Tag and push:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow triggers automatically. No manual intervention needed. Monitor progress in the Actions tab.

---

## Release Artifacts Produced

Each release includes:

| File | Purpose |
|------|---------|
| `nexus-agent-linux-amd64` | Linux x86_64 binary |
| `nexus-agent-linux-amd64.sigstore.json` | Sigstore signature bundle |
| `nexus-agent-linux-amd64.sha256` | SHA256 checksum |
| `nexus-agent-linux-arm64` | Linux ARM64 binary |
| `nexus-agent-linux-arm64.sigstore.json` | Sigstore signature bundle |
| `nexus-agent-linux-arm64.sha256` | SHA256 checksum |
| `nexus-agent-windows-amd64.exe` | Windows x86_64 binary |
| `nexus-agent-windows-amd64.exe.sigstore.json` | Sigstore signature bundle |
| `nexus-agent-windows-amd64.exe.sha256` | SHA256 checksum |
| `nexus-sandbox-linux-amd64` | Sandbox Linux x86_64 binary |
| `nexus-sandbox-linux-amd64.sigstore.json` | Sigstore signature bundle |
| `nexus-sandbox-linux-arm64` | Sandbox Linux ARM64 binary |
| `nexus-sandbox-linux-arm64.sigstore.json` | Sigstore signature bundle |
| `nexus-sandbox-windows-amd64.exe` | Sandbox Windows binary |
| `nexus-sandbox-windows-amd64.exe.sigstore.json` | Sigstore signature bundle |
| `proto-bundle-v*.tar.gz` | Signed proto definitions |
| `proto-bundle-v*.tar.gz.sigstore.json` | Proto bundle signature |
| `checksums.txt` | All SHA256 checksums |
| `checksums.txt.sigstore.json` | Checksums file signature |
| `sbom.cdx.json` | CycloneDX Software Bill of Materials |
| `verify-release.sh` | End-user verification script |

---

## Verifying Release Artifacts

### Option A: Use the verification script (recommended)

Download all release artifacts into a directory, then:

```bash
chmod +x verify-release.sh
./verify-release.sh
```

Override the repository identity if needed:

```bash
REPO=myorg/myrepo ./verify-release.sh
```

The script verifies:
1. Sigstore signatures on all binaries and proto bundle
2. SHA256 checksum integrity
3. Certificate identity matches the expected GitHub Actions workflow

Output is color-coded: green = verified, red = failed, yellow = skipped.

### Option B: Verify a single binary manually

```bash
# Install cosign (macOS)
brew install cosign

# Install cosign (Linux)
go install github.com/sigstore/cosign/v2/cmd/cosign@latest

# Verify
cosign verify-blob nexus-agent-linux-amd64 \
  --bundle nexus-agent-linux-amd64.sigstore.json \
  --certificate-identity-regexp="https://github.com/cmndcntrlcyber/rust-nexus/.*" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com"
```

On success, output is: `Verified OK`

### Option C: Verify with exact tag identity

For stricter verification, pin to the exact tag that produced the build:

```bash
cosign verify-blob nexus-agent-linux-amd64 \
  --bundle nexus-agent-linux-amd64.sigstore.json \
  --certificate-identity="https://github.com/cmndcntrlcyber/rust-nexus/.github/workflows/release.yml@refs/tags/v0.1.0" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com"
```

### Option D: Verify the container image

```bash
cosign verify \
  --certificate-identity-regexp="https://github.com/cmndcntrlcyber/rust-nexus/.*" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/cmndcntrlcyber/rust-nexus/nexus-agent:0.1.0
```

### Option E: Verify SBOM attestation on the container

```bash
cosign verify-attestation \
  --type cyclonedx \
  --certificate-identity-regexp="https://github.com/cmndcntrlcyber/rust-nexus/.*" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/cmndcntrlcyber/rust-nexus/nexus-agent:0.1.0
```

### Option F: Verify SLSA provenance

```bash
# Install the verifier
go install github.com/slsa-framework/slsa-verifier/v2/cli/slsa-verifier@latest

# Verify binary provenance
slsa-verifier verify-artifact nexus-agent-linux-amd64 \
  --provenance-path multiple.intoto.jsonl \
  --source-uri github.com/cmndcntrlcyber/rust-nexus \
  --source-tag v0.1.0
```

---

## Inspecting Rekor Transparency Log Entries

Every signing event is recorded in the public Rekor instance.

### Via web UI

Browse: https://search.sigstore.dev/

### Via CLI

```bash
# Install rekor-cli
go install github.com/sigstore/rekor/cmd/rekor-cli@latest

# Search by artifact hash
rekor-cli search --sha sha256:$(sha256sum nexus-agent-linux-amd64 | awk '{print $1}')

# Get entry details
rekor-cli get --log-index <INDEX> --format json | jq .

# Verify log integrity
rekor-cli loginfo --rekor_server https://rekor.sigstore.dev
```

---

## Supply Chain Security Features

| Feature | Tool | Purpose |
|---------|------|---------|
| Embedded dependency metadata | `cargo-auditable` | Post-build vulnerability scanning without source code |
| SHA256 checksums | `sha256sum` | Integrity verification |
| Keyless signatures | `cosign sign-blob` | Tamper detection with Sigstore bundles |
| Container image signatures | `cosign sign` | Image integrity stored in OCI registry |
| SBOM | `syft` + `cosign attest` | CycloneDX bill of materials attested to image |
| Build provenance | `slsa-github-generator` | SLSA Level 3 non-falsifiable provenance |
| Transparency log | Rekor | Immutable public audit trail |

### SLSA Level Compliance

| SLSA Level | Requirement | How Met |
|------------|-------------|---------|
| L1 | Provenance exists | `slsa-github-generator` produces provenance |
| L2 | Signed provenance + hosted build | Sigstore keyless signing via GitHub Actions OIDC |
| L3 | Hardened, isolated build | SLSA generator runs in isolated reusable workflow (non-falsifiable) |

---

## Troubleshooting

### "no OIDC token available"
The workflow needs `permissions: id-token: write`. This permission cannot be granted to workflows triggered by pull requests from forks.

### "certificate identity mismatch"
The `--certificate-identity` must exactly match the workflow file path + git ref. Use `--certificate-identity-regexp` for flexible matching during development.

### "Fulcio request failed"
Sigstore's public infrastructure has rate limits. If you hit them during development, wait a few minutes. Production releases are well within limits.

### Verifying old releases after workflow file rename
If you rename the workflow file, old signatures will have the old file path in their certificate identity. Use `--certificate-identity-regexp` to match both old and new paths.

### Inspecting a .sigstore.json bundle

```bash
# The bundle is a JSON file containing signature, certificate, and Rekor proof
cat nexus-agent-linux-amd64.sigstore.json | jq '.verificationMaterial.x509CertificateChain'
```

---

## Security Considerations

- The `id-token: write` permission should only be granted to workflows on **protected branches** (main, release tags)
- Certificate identities in Rekor are **public** — for GitHub Actions this is the workflow URL, not an email
- Rekor entries are **permanent and immutable** — every signing event is publicly auditable forever
- Consider using [rekor-monitor](https://github.com/sigstore/rekor-monitor) to watch for unexpected signing events under your identity
- Always sign container images by **digest** (`@sha256:...`), never by tag alone — tags are mutable
- The `--yes` flag is required in CI to avoid interactive prompts that would hang the pipeline
