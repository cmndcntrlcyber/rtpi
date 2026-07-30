# v3.4.3 — SAST & SCA Skills

**Priority:** P2
**Status:** Dockerfile Updated, Skills Pending
**Skill Category:** `skills/offense/sast-sca/` (new)
**Tools:** 14
**Parent:** [v3.4 Tool Catalogue](../v3.4.md)

---

## Objective

Create a new `sast-sca/` skill category in nexus-harness for static application security testing (SAST), software composition analysis (SCA), dependency vulnerability scanning, and SSL/TLS security assessment. This is an entirely new category — nexus-harness currently has zero SAST/SCA coverage despite these tools being present in the rtpi-framework-agent container.

---

## Tool Inventory

| # | Tool | Purpose | Install Method | Skill Name |
|---|------|---------|----------------|------------|
| 1 | Semgrep | Multi-language SAST scanner with custom rules | pip | `sast-sca/semgrep-scan` |
| 2 | Bandit | Python-specific SAST scanner | pip | `sast-sca/bandit-scan` |
| 3 | Brakeman | Ruby on Rails SAST scanner | gem install | `sast-sca/brakeman-scan` |
| 4 | Trivy | Container/filesystem/repo vulnerability scanner | install script (aquasecurity/trivy) | `sast-sca/trivy-scan` |
| 5 | Grype | Container image vulnerability scanner | install script (anchore/grype) | `sast-sca/grype-scan` |
| 6 | Snyk | Multi-language vulnerability scanner (SCA + SAST) | npm global | `sast-sca/snyk-audit` |
| 7 | Retire.js | JavaScript dependency vulnerability scanner | npm global + git clone RetireJS/retire.js | `sast-sca/retirejs-scan` |
| 8 | Safety | Python dependency safety checker | pip | `sast-sca/safety-check` |
| 9 | pip-audit | Python package audit against vulnerability DBs | pip | `sast-sca/pip-audit` |
| 10 | OSV-Scanner | Google OSV database scanner (multi-ecosystem) | go install github.com/google/osv-scanner | `sast-sca/osv-scanner` |
| 11 | owasp-depscan | OWASP dependency and license scanner | pip | `sast-sca/depscan` |
| 12 | SSLyze | SSL/TLS configuration and certificate scanner | pip | `sast-sca/sslyze-scan` |
| 13 | testssl.sh | SSL/TLS testing (cipher suites, protocols, vulns) | git clone drwetter/testssl.sh | `sast-sca/testssl-scan` |
| 14 | shcheck / securityheaders | HTTP security header analysis | git clone + pip | `sast-sca/header-check` |

---

## Skill Structure

Each skill follows the nexus-harness offense skill pattern:

```
skills/offense/sast-sca/<skill-name>/
  SKILL.md          # YAML frontmatter + workflow sections
```

Standard sections per SKILL.md:
1. Scope Check (`$TARGET` must be in scope)
2. Quick Workflow (common one-liner usage)
3. Technique Sections (detailed usage patterns with output format selection)
4. Output Handling (results → `/results/$ENGAGEMENT/sast-sca/`)
5. Pitfalls (false positives, scan scope misconfiguration, rate limiting)
6. Verification (confirm tool ran, output is valid, findings are actionable)

SAST/SCA-specific additions:
- **Severity Mapping** — skills normalize findings to CVSS scores where available
- **CWE Cross-Referencing** — findings tagged with CWE identifiers
- **SBOM Integration** — SCA tools generate CycloneDX/SPDX-compatible output where supported
- **Suppression Guidance** — how to handle false positives and known-accepted risks

---

## Acceptance Criteria

- [ ] 14 SKILL.md files created under `skills/offense/sast-sca/`
- [ ] Each skill works standalone via `nexus` CLI inside nexus-kali
- [x] All 14 tools installed in nexus-kali image (`docker/Dockerfile` updated 2026-07-30 — semgrep, bandit, trivy, sslyze, testssl.sh via kali-linux-everything; grype, osv-scanner, safety, pip-audit, owasp-depscan, shcheck, brakeman, snyk, retire via new layers)
- [ ] Results output to `/results/$ENGAGEMENT/sast-sca/<tool>/`
- [ ] Scope enforcement: all skills check target against engagement scope before execution
- [ ] Findings include CWE identifiers and CVSS scores where available
- [ ] Skills reference MITRE ATT&CK techniques where applicable (Initial Access TA0001, Defense Evasion TA0005)
- [ ] SBOM output (CycloneDX or SPDX) supported for SCA tools (trivy, grype, snyk, osv-scanner, depscan)

---

## Nexus-Kali Image Requirements

### pip (single layer)
```
semgrep bandit sslyze safety pip-audit owasp-depscan
```

### npm (single layer)
```
retire snyk
```

### gem
```
brakeman
```

### go install
```
github.com/google/osv-scanner/cmd/osv-scanner@latest
```

### Binary downloads / install scripts
```
Trivy (aquasecurity/trivy install script)
Grype (anchore/grype install script)
```

### git clone
```
github.com/drwetter/testssl.sh
github.com/RetireJS/retire.js
github.com/santoru/shcheck
github.com/koenbuyens/securityheaders
```

### Runtime Prerequisites (not baked into image)
- Snyk API token (`SNYK_TOKEN` env var) — required for `snyk-audit`
- Network access to vulnerability databases (NVD, OSV, GitHub Advisory) — most tools fetch online
- Target source code or filesystem mounted/accessible inside nexus-kali
- Target container images pulled or tarballed for Trivy/Grype scanning
- Target HTTPS endpoints reachable for SSL/TLS scanning (sslyze, testssl.sh)

---

## Dependencies

- No existing skills in `sast-sca/` — this is a new category
- nexus-kali Dockerfile must include all tools above
- Scope guard must validate filesystem paths, container image references, and domain/IP targets
- Reporting skill (`reporting/engagement-report`) should accept SAST/SCA finding formats

---

## Risks

| Risk | Mitigation |
|------|------------|
| High false positive rate in SAST scans | Skills include severity filtering and suppression file guidance |
| Vulnerability database staleness | Skills document `--update-db` flags; nexus-kali build refreshes DBs |
| Snyk API rate limiting (free tier) | Skills document rate limits and recommend authenticated usage |
| Large scan times on big codebases | Skills include `--exclude` / `--skip` patterns and incremental scan guidance |
| SSL/TLS scanning against production targets | Skills enforce scope check and warn about potential service disruption |
| License compliance confusion with SCA | Skills separate vulnerability findings from license findings in output |
