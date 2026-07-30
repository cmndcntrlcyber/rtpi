# v3.4.3 SAST & SCA — Internal Workflows

**Context:** Standalone nexus-kali usage via `nexus` CLI. No RTPI involved.

---

## Workflow 1: Full SAST Scan

**Trigger:** `/engage` or manual skill invocation
**Skills used:** `sast-sca/semgrep-scan`, `sast-sca/bandit-scan`, `sast-sca/brakeman-scan`

```
1. Scope check → verify target codebase/repo is in engagement scope
2. Identify languages present in target codebase
3. semgrep scan --config auto /target/repo
   → multi-language SAST with auto rule selection
   → /results/$ENGAGEMENT/sast-sca/semgrep/
4. If Python detected:
   bandit -r /target/repo -f json
   → Python-specific security analysis
   → /results/$ENGAGEMENT/sast-sca/bandit/
5. If Ruby/Rails detected:
   brakeman -p /target/repo -f json
   → Rails-specific security analysis
   → /results/$ENGAGEMENT/sast-sca/brakeman/
6. Consolidate findings by CWE category → engagement-report skill
```

## Workflow 2: Dependency Audit

**Skills used:** `sast-sca/trivy-scan`, `sast-sca/snyk-audit`, `sast-sca/retirejs-scan`, `sast-sca/safety-check`, `sast-sca/pip-audit`, `sast-sca/osv-scanner`, `sast-sca/depscan`

```
1. Scope check → verify target project is in engagement scope
2. trivy fs /target/repo --format json --scanners vuln
   → filesystem-level dependency scan (all ecosystems)
   → /results/$ENGAGEMENT/sast-sca/trivy/
3. osv-scanner scan --recursive /target/repo
   → Google OSV database cross-reference
   → /results/$ENGAGEMENT/sast-sca/osv-scanner/
4. If Python project:
   pip-audit -r /target/repo/requirements.txt -f json
   safety check -r /target/repo/requirements.txt --json
   → /results/$ENGAGEMENT/sast-sca/pip-audit/
   → /results/$ENGAGEMENT/sast-sca/safety/
5. If JavaScript/Node project:
   retire --path /target/repo --outputformat json
   snyk test --json
   → /results/$ENGAGEMENT/sast-sca/retirejs/
   → /results/$ENGAGEMENT/sast-sca/snyk/
6. depscan --src /target/repo --type generic
   → OWASP dependency and license scan
   → /results/$ENGAGEMENT/sast-sca/depscan/
7. Deduplicate findings across tools → consolidated vulnerability report
```

## Workflow 3: SSL/TLS Assessment

**Skills used:** `sast-sca/sslyze-scan`, `sast-sca/testssl-scan`, `sast-sca/header-check`

```
1. Scope check → verify target domain/IP is in engagement scope
2. sslyze --regular target.example.com --json_out results.json
   → certificate validation, cipher suite analysis, protocol support
   → /results/$ENGAGEMENT/sast-sca/sslyze/
3. testssl.sh --jsonfile results.json target.example.com:443
   → comprehensive TLS testing (BEAST, POODLE, Heartbleed, ROBOT, etc.)
   → /results/$ENGAGEMENT/sast-sca/testssl/
4. shcheck https://target.example.com
   → HTTP security header analysis (HSTS, CSP, X-Frame-Options, etc.)
   → /results/$ENGAGEMENT/sast-sca/headers/
5. Cross-reference findings with compliance requirements (PCI-DSS, NIST)
6. Results → engagement-report skill
```

## Workflow 4: Container Image Scan

**Skills used:** `sast-sca/trivy-scan`, `sast-sca/grype-scan`

```
1. Scope check → verify container image is in engagement scope
2. trivy image target-image:tag --format json --scanners vuln,misconfig,secret
   → OS package vulns + misconfigurations + embedded secrets
   → /results/$ENGAGEMENT/sast-sca/trivy/
3. grype target-image:tag -o json
   → secondary container image vuln scan (cross-validation)
   → /results/$ENGAGEMENT/sast-sca/grype/
4. trivy image target-image:tag --format cyclonedx
   → generate SBOM in CycloneDX format
   → /results/$ENGAGEMENT/sast-sca/sbom/
5. Compare trivy vs grype findings → identify discrepancies
6. Results → engagement-report skill
```
