---
name: Trivy
description: Vulnerability scanner for container images, filesystems, IaC, and
  Git repos; detects CVEs, secrets, misconfigurations, and license issues.
registry: registry
tool_id: trivy
category: security-scanning
tags:
  - vulnerability-scanning
  - container-security
  - sbom
  - iac-scanning
  - secret-detection
  - misconfiguration
  - cve
summary: "Trivy is a comprehensive vulnerability scanner invoked via
  `/opt/tools/bin/trivy <target> [--scanners <scanner>] <subject>`. Primary
  targets: `image` (container images), `filesystem` (local paths), `config` (IaC
  files), `repo` (Git repositories). Default scanner is vulnerability detection;
  add `--scanners vuln,secret,misconfig,license` to combine. Key flags:
  `--severity CRITICAL,HIGH` (filter results), `--ignore-unfixed` (suppress
  vulnerabilities without fixes), `--exit-code 1` (fail on findings), `--format
  json|table|sarif` (output type), `--output <file>` (save results). Cache dir
  defaults to local; configure via `--cache-dir` or `TRIVY_CACHE_DIR`. For image
  scanning: `trivy image <image-name>`; for filesystem: `trivy filesystem
  <path>`; for IaC: `trivy config <path>`. Outputs include CVE ID, package name,
  severity, installed/fixed versions, and references. Use `--skip-dirs` and
  `--skip-files` to exclude paths. Default timeout is 5 minutes; adjust with
  `--timeout`. Config file support via `trivy.yaml` or `--config`. All flags
  have environment variable equivalents: prefix `TRIVY_`, uppercase, replace `-`
  with `_`. Trivy does NOT perform active exploitation—it correlates installed
  packages against vulnerability databases. Not a penetration testing tool; use
  for pre-deployment security posture assessment."
sources:
  - https://github.com/aquasecurity/trivy-action
  - https://trivy.dev/docs/latest/plugin/user-guide/
  - https://www.jit.io/resources/appsec-tools/when-and-how-to-use-trivy-to-scan-containers-for-vulnerabilities
  - https://trivy.dev/docs/latest/getting-started/
  - https://edu.chainguard.dev/chainguard/chainguard-images/staying-secure/working-with-scanners/trivy-tutorial/
  - https://trivy.dev/docs/latest/references/configuration/cli/trivy_config/
  - https://trivy.dev/docs/latest/configuration/
  - https://trivy.dev/docs/latest/references/configuration/cli/trivy_filesystem/
  - https://blog.devops.dev/mastering-trivy-your-ultimate-guide-to-securing-containers-and-artifacts-in-devops-77324613aaad
  - https://www.yash.com/blog/red-team-assessment-and-penetration-testing
  - https://www.ebryx.com/blogs/what-is-red-team-penetration-testing
  - https://michaelpeters.org/red-team-penetration-testing-in-fedramp
generated_at: 2026-05-19T11:22:32.837Z
generated_by: anthropic
source_hash: 8b736fcc9fa60491acc6c723eda3097de91142395523bff8e8541a9ec0270c30
---

# Trivy

## Overview

Trivy is an open-source security scanner that identifies vulnerabilities (CVEs), secrets, misconfigurations, and license issues across container images, filesystems, Infrastructure-as-Code (IaC) files, and Git repositories. Written in Go and maintained by Aqua Security, Trivy operates offline after downloading vulnerability databases. It supports multiple output formats (table, JSON, SARIF, SBOM) and integrates into CI/CD pipelines. Trivy does not exploit vulnerabilities—it performs static analysis by matching installed software versions against known CVE databases. Version 0.69.3 is installed at `/opt/tools/bin/trivy`.

## When to use

Use Trivy to assess security posture of container images before deployment, scan filesystems for vulnerable packages, audit IaC templates (Terraform, Kubernetes manifests, Helm charts) for misconfigurations, detect hardcoded secrets in codebases, and generate SBOMs for supply chain visibility. Ideal for pre-engagement reconnaissance to identify vulnerable components in target infrastructure, verify patch levels in discovered containers, or analyze captured filesystems. NOT suitable for active exploitation, network-based vulnerability scanning, or dynamic application testing. Use during planning/reconnaissance phases to map attack surface, not during active red team operations where stealth is required (scanning generates logs and may trigger detection).

## Authentication & setup

No authentication required for local scans. Trivy downloads vulnerability databases on first run; ensure internet connectivity or pre-populate cache. Cache directory defaults to system-specific location; override with `--cache-dir /path/to/cache` or `TRIVY_CACHE_DIR` environment variable. For private container registries, provide credentials via environment variables or Docker config: mount `~/.docker/config.json` or use `TRIVY_USERNAME`/`TRIVY_PASSWORD`. For offline environments, download databases separately using `--download-db-only` and transfer cache directory. Configuration file `trivy.yaml` in current directory is auto-loaded; specify alternative with `--config /path/to/config.yaml`. Plugins require `trivy plugin install <name>` but are not needed for core functionality.

## Key commands / parameters

**Targets**: `image` (container images), `filesystem` (directories/files), `config` (IaC files), `repo` (Git repositories), `rootfs` (VM/root filesystems). **Scanners** (via `--scanners`): `vuln` (vulnerabilities, default), `secret`, `misconfig`, `license`; combine with commas. **Filtering**: `--severity CRITICAL,HIGH,MEDIUM,LOW,UNKNOWN` (default: all), `--ignore-unfixed` (skip vulnerabilities without patches), `--ignore-status end_of_life,will_not_fix` (ignore specific statuses). **Output**: `--format table|json|sarif|cyclonedx|spdx` (default: table), `--output <file>` (save to file), `--exit-code 1` (return non-zero on findings). **Performance**: `--timeout 10m` (default: 5m), `--skip-dirs /path/one,/path/two`, `--skip-files pattern`. **IaC-specific**: `--include-non-failures` (show passed checks), `--include-deprecated-checks`, `--k8s-version 1.21.0` (validate Kubernetes API versions). **Misc**: `--quiet` (suppress progress), `--debug` (verbose logging), `--ignorefile .trivyignore` (custom ignore file).

## Example workflows

**Scan container image**: `trivy image nginx:latest` or `trivy image --severity CRITICAL,HIGH --exit-code 1 myapp:v1.2.3` to fail on critical/high findings. **Scan filesystem**: `trivy filesystem /mnt/captured-rootfs --format json --output results.json`. **Scan IaC directory**: `trivy config ./terraform/ --severity HIGH,CRITICAL --include-non-failures` to audit Terraform files. **Detect secrets in repo**: `trivy repo https://github.com/target/repo --scanners secret`. **Generate SBOM**: `trivy image myapp:latest --format cyclonedx --output sbom.json`. **Scan tarball**: `trivy image --input image.tar` for offline analysis. **Filter and export**: `trivy filesystem /opt/app --ignore-unfixed --severity CRITICAL --format sarif --output report.sarif`. **Use config file**: Create `trivy.yaml` with `severity: [CRITICAL, HIGH]` and `format: json`, then run `trivy image myapp:latest`.

## Output format

**Table format** (default): Human-readable table with columns: Target, Vulnerability ID, Package, Severity, Installed Version, Fixed Version, Title. **JSON format**: Structured output with `Results` array containing `Target`, `Vulnerabilities` (array of objects with `VulnerabilityID`, `PkgName`, `InstalledVersion`, `FixedVersion`, `Severity`, `Description`, `References`). **SARIF format**: Compatible with GitHub Code Scanning and other SARIF consumers; includes rules, results, and locations. **SBOM formats** (CycloneDX, SPDX): Bill of materials listing all components, versions, licenses. Severity levels: UNKNOWN, LOW, MEDIUM, HIGH, CRITICAL. References include CVE database links (NVD, vendor advisories). Exit code: 0 if no issues, non-zero if `--exit-code` set and vulnerabilities found. Progress messages go to stderr; results to stdout unless `--output` specified.

## Common pitfalls

**Database staleness**: Trivy's vulnerability database may be outdated; run `trivy image --download-db-only` to update before scans. **False positives**: OS package scanners may report vulnerabilities in statically-linked binaries incorrectly; verify findings manually. **Ignored vulnerabilities**: `.trivyignore` file in scan directory auto-excludes CVEs; check for suppressions that hide critical issues. **Incomplete scans**: Default scanner is `vuln` only; secrets and misconfigurations require explicit `--scanners` flag. **Performance**: Large images/filesystems may exceed default 5m timeout; increase with `--timeout`. **Network dependencies**: First run requires internet to fetch databases; pre-download in offline environments. **Exit code confusion**: Trivy exits 0 even with findings unless `--exit-code 1` specified. **Registry authentication**: Private registries need credentials; mount Docker config or set environment variables. **IaC false negatives**: Policy checks are opinionated; validate against organizational security standards, not just Trivy defaults.

## References

• https://trivy.dev/docs/latest/getting-started/
• https://trivy.dev/docs/latest/references/configuration/cli/trivy_filesystem/
• https://trivy.dev/docs/latest/references/configuration/cli/trivy_config/
• https://trivy.dev/docs/latest/configuration/
• https://github.com/aquasecurity/trivy-action
• https://edu.chainguard.dev/chainguard/chainguard-images/staying-secure/working-with-scanners/trivy-tutorial/
• https://www.jit.io/resources/appsec-tools/when-and-how-to-use-trivy-to-scan-containers-for-vulnerabilities
• https://blog.devops.dev/mastering-trivy-your-ultimate-guide-to-securing-containers-and-artifacts-in-devops-77324613aaad
