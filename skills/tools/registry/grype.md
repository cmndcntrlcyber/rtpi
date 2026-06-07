---
name: Grype
description: Vulnerability scanner for container images, filesystems, and SBOMs
  with automatic CVE database updates.
registry: registry
tool_id: grype
category: security-scanning
tags:
  - vulnerability-scanning
  - container-security
  - sbom
  - cve-detection
  - image-analysis
  - supply-chain
summary: "Grype scans container images, filesystems, and SBOMs for known
  vulnerabilities (CVEs) using an automatically updated local vulnerability
  database. Invoke with `/opt/tools/bin/grype <target>` where target can be a
  Docker image (e.g., `ubuntu:latest`), registry image, filesystem path
  (`dir:/path`), or SBOM file. For remote registries, use `registry:<image>`
  format. Outputs table format by default; use `-o json` for machine-readable
  results or `-o cyclonedx`, `-o sarif` for standardized formats. Use `--file
  <path>` to save output. Filter results with `--fail-on <severity>`
  (negligible/low/medium/high/critical) to set exit codes for CI/CD gating. Use
  `--only-fixed` to show only vulnerabilities with available patches. Use
  `--scope all-layers` to scan all image layers, not just the squashed final
  image. Configuration via `.grype.yaml` allows ignoring specific CVEs or
  packages. Grype maintains a local database that updates automatically; first
  run downloads ~200MB of vulnerability data. For Docker containers: `docker run
  --rm --volume /var/run/docker.sock:/var/run/docker.sock <grype-image>
  <target>`. Does NOT perform active exploitation or penetration testing—this is
  passive vulnerability enumeration only. Use in reconnaissance phases to
  identify weak supply chain components before deeper exploitation phases."
sources:
  - https://blog.techiescamp.com/grype-vulnerability-scanner-guide/
  - https://developer.harness.io/docs/security-testing-orchestration/sto-techref-category/grype/grype-scanner-reference
  - https://dev.to/chainguard/deep-dive-where-does-grype-data-come-from-n9e
  - https://sylabs.io/2022/08/how-to-vulnerability-scanning-of-singularity-containers-with-syft-and-grype/
  - https://anchore.com/opensource/
  - https://hackersonlineclub.com/grype-a-vulnerability-scanner-for-container-images-and-filesystems/
  - https://megalinter.io/7.6.0/descriptors/repository_grype/
  - https://anchorecommunity.discourse.group/t/how-can-we-make-grypes-output-more-focused/57
  - https://wazuh.com/blog/streamlining-container-image-security-with-grype-and-wazuh/
  - https://www.cycognito.com/learn/red-teaming/red-teaming-vs-pentesting/
  - https://www.nuharborsecurity.com/blog/red-teaming-vs-penetration-testing
  - https://www.rapid7.com/blog/post/2016/06/23/penetration-testing-vs-red-teaming-the-age-old-debate-of-pirates-vs-ninja-continues/
generated_at: 2026-05-19T11:09:02.176Z
generated_by: anthropic
source_hash: 9c81f259aa6aa3914dcb8fa6beabca929a2e91f9b5072933161a1534ed3f22a4
---

# Grype

## Overview

Grype is an open-source vulnerability scanner developed by Anchore for container images, filesystems, and Software Bill of Materials (SBOMs). It compares detected packages against a curated vulnerability database aggregated from multiple upstream providers (NVD, OS-specific databases, GitHub Security Advisories, Chainguard advisories, etc.). The tool operates entirely locally after database download and does not send data externally. Grype identifies CVEs by severity (negligible through critical) and can generate compliance reports in multiple industry-standard formats. It integrates into CI/CD pipelines and supports both online and air-gapped environments.

## When to use

Use Grype during reconnaissance to identify vulnerable components in target container infrastructure before exploitation phases. Ideal for supply chain attack planning—scan public images used by targets to find known CVE entry points. Use on captured filesystems or extracted container layers from compromised systems to identify lateral movement opportunities via vulnerable packages. Employ in pre-engagement phases to assess target attack surface when container registries are accessible. Use to generate SBOMs for later offline analysis when direct target access is time-limited. NOT appropriate for active exploitation—Grype only identifies vulnerabilities; pair findings with exploit frameworks for weaponization. Use when targets use containerized infrastructure (Docker, Kubernetes, Singularity) or when you have filesystem access to Linux systems.

## Authentication & setup

Grype requires no authentication for local scans of downloaded images or filesystems. For scanning remote private registries, provide credentials via environment variables or command-line flags (check `--help` for registry-specific auth). The tool auto-downloads its vulnerability database (~200MB) on first run to `~/.cache/grype/db/` and updates automatically. In air-gapped/RTPI environments, ensure database is pre-populated or manually synced. No configuration file required for basic operation, but `.grype.yaml` in working directory or `~/.grype.yaml` enables custom ignore rules for CVEs and severity thresholds. For scanning running Docker containers, Grype needs access to Docker socket (`/var/run/docker.sock`)—ensure containerized Grype has socket volume mounted. No API keys required unless accessing private registries. GitHub token needed only if building custom vulnerability database from source (not typical operational use).

## Key commands / parameters

Basic syntax: `grype <target>` where target formats are:
- Docker image: `ubuntu:latest`, `nginx@sha256:abc123...`
- Registry: `registry:example.com/image:tag`
- Filesystem: `dir:/path/to/filesystem`
- SBOM file: `sbom:/path/to/sbom.json`
- Running container: `docker:<container-id>`

Key flags:
- `-o, --output <format>`: Output format—`table` (default), `json`, `cyclonedx`, `cyclonedx-json`, `sarif`, `template`. Use `json` for maximum data extraction.
- `--file <path>`: Write output to file instead of stdout.
- `--fail-on <severity>`: Exit code 1 if vulnerability >= severity found (negligible/low/medium/high/critical). Critical for CI/CD gating.
- `--only-fixed`: Show only vulnerabilities with known fixes/patches.
- `--scope all-layers`: Scan all image layers, not just final squashed image.
- `--exclude <glob>`: Exclude paths matching glob pattern from scan.
- `-c, --config <file>`: Custom config file path.
- `--distro <name:version>`: Override distro detection (e.g., `ubuntu:20.04`).
- `-v, -vv`: Increase verbosity (info, debug).

Ignore rules in `.grype.yaml`:
```yaml
ignore:
  - vulnerability: CVE-2008-4318
    fix-state: unknown
```

## Example workflows

**Reconnaissance on public target infrastructure:**
```bash
# Scan publicly known image used by target
grype nginx:1.19.0 -o json --file nginx_vulns.json
grype --fail-on high ubuntu:18.04  # exit code indicates high+ vulns
```

**Private registry enumeration (with creds):**
```bash
# Scan private registry image
grype registry:target.internal/app:prod -o json
```

**Post-compromise filesystem analysis:**
```bash
# Scan extracted filesystem from compromised container
grype dir:/mnt/extracted_rootfs --scope all-layers -o json
```

**Scanning running container on compromised host:**
```bash
# List containers, then scan
docker ps --format '{{.ID}}'
grype docker:a1b2c3d4e5f6 --only-fixed -o table
```

**SBOM-based analysis (offline after exfil):**
```bash
# Generate SBOM with syft first, then analyze offline
syft target-image -o cyclonedx-json > sbom.json
grype sbom:sbom.json -o json --fail-on medium
```

**Batch scanning multiple images:**
```bash
for img in $(cat target_images.txt); do
  echo "Scanning $img"
  grype "$img" -o json --file "results_${img//[\/:]/_}.json"
done
```

**Filter for weaponizable high/critical with fixes:**
```bash
grype target:latest --only-fixed --fail-on high -o json | \
  jq '.matches[] | select(.vulnerability.severity=="Critical" or .vulnerability.severity=="High")'
```

## Output format

Default `table` format shows columnar summary: Package | Version | Vulnerability | Severity | Fix.

**JSON output** (`-o json`) provides complete data:
```json
{
  "matches": [
    {
      "vulnerability": {
        "id": "CVE-2021-12345",
        "severity": "High",
        "description": "...",
        "fix": {"state": "fixed", "versions": ["1.2.3"]}
      },
      "artifact": {
        "name": "libcurl",
        "version": "1.0.0",
        "type": "deb",
        "locations": ["/usr/lib/..."]
      }
    }
  ],
  "source": {...},
  "descriptor": {...}
}
```

**Key JSON fields for red team use:**
- `matches[].vulnerability.id`: CVE identifier for exploit lookup
- `matches[].vulnerability.severity`: Prioritize Critical/High
- `matches[].vulnerability.fix.state`: `fixed`/`not-fixed`/`unknown`—fixed vulns indicate patch available
- `matches[].artifact.name`, `.version`: Exact package for exploit matching
- `matches[].artifact.locations`: File paths for targeted exploitation

**Other formats:**
- `cyclonedx`, `cyclonedx-json`: Industry-standard SBOM format for tool interop
- `sarif`: Static Analysis Results Interchange Format for CI/CD integration
- `template`: Custom Go template for bespoke output parsing

Exit codes: 0 (no vulns or below threshold), 1 (vulnerabilities found when using `--fail-on`), or error codes for execution failures.

## Common pitfalls

**Database not updated:** First run downloads ~200MB; in bandwidth-constrained environments this times out. Pre-stage database or use `grype db update` explicitly.

**False positives from distro mismatch:** Grype may misidentify OS version. Use `--distro` flag to override when detection fails or when scanning filesystems without clear OS markers.

**Scanning only final layer:** Default scans squashed image. Vulnerabilities in intermediate layers (that don't appear in final filesystem) are missed. Use `--scope all-layers` for comprehensive coverage, especially when hunting for developer secrets or build-time vulnerabilities.

**Ignoring 'not-fixed' vulnerabilities:** Filtering for `--only-fixed` misses real vulnerabilities that simply lack patches. These can be equally exploitable; balance fix availability with exploitability research.

**Over-reliance on severity scores:** CVSS scores don't reflect real-world exploitability or context. A 'Medium' CVE in a network-exposed service may be more valuable than a 'Critical' CVE in an unused library. Manually assess each finding.

**Docker socket permission errors:** When running Grype in container to scan other containers, missing socket mount or permissions cause failures. Ensure `-v /var/run/docker.sock:/var/run/docker.sock` and appropriate user permissions.

**Rate limiting on registries:** Scanning many images from public registries (Docker Hub, etc.) without authentication triggers rate limits. Provide credentials even for public images during bulk scanning.

**Noise in output:** Large images produce thousands of vulnerabilities. Combine `--only-fixed`, `--fail-on`, and JSON output with `jq` filtering to extract actionable findings efficiently.

**Not correlating with exploit-db:** Grype identifies CVEs but doesn't indicate exploit availability. Cross-reference findings with exploit databases (Metasploit, Exploit-DB, GitHub PoCs) before prioritizing targets.

## References

• https://blog.techiescamp.com/grype-vulnerability-scanner-guide/
• https://developer.harness.io/docs/security-testing-orchestration/sto-techref-category/grype/grype-scanner-reference
• https://dev.to/chainguard/deep-dive-where-does-grype-data-come-from-n9e
• https://sylabs.io/2022/08/how-to-vulnerability-scanning-of-singularity-containers-with-syft-and-grype/
• https://anchore.com/opensource/
• https://hackersonlineclub.com/grype-a-vulnerability-scanner-for-container-images-and-filesystems/
• https://megalinter.io/7.6.0/descriptors/repository_grype/
• https://anchorecommunity.discourse.group/t/how-can-we-make-grypes-output-more-focused/57
• https://wazuh.com/blog/streamlining-container-image-security-with-grype-and-wazuh/
