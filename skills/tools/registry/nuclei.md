---
name: Nuclei
description: Fast YAML-based vulnerability scanner that detects CVEs,
  misconfigurations, and exposures across web apps, APIs, and infrastructure
registry: registry
tool_id: nuclei
category: vulnerability
tags:
  - vulnerability-scanner
  - cve-detection
  - web-recon
  - template-based
  - http-scanning
  - misconfiguration
  - yaml
mitre_techniques:
  - T1046
  - T1595.002
  - T1190
summary: "Nuclei is a template-driven vulnerability scanner optimized for speed
  and accuracy. Use it to detect known CVEs, misconfigurations, default
  credentials, and exposed services across web applications, APIs, and network
  services. Invoke with `/opt/tools/bin/nuclei -u <target>` for single targets
  or `-l <file>` for bulk scanning. Templates are stored in YAML format and
  auto-update; filter by severity, CVE, or tag using `-t` or `-tags`. Nuclei
  uses request clustering to minimize network traffic. Outputs are one line per
  finding: `[template-id] [protocol] [severity] <target>`. Save results with `-o
  <file>` or output JSON with `-json`. Use `-silent` to suppress banner and
  progress. Supports HTTP/HTTPS by default; test non-HTTP services with `-u
  host:port`. Ideal for initial reconnaissance, regression testing in CI/CD, and
  mass CVE validation. Low false-positive rate due to multi-step verification
  templates. Rate-limit with `-rl` to avoid triggering WAFs. Always verify
  findings manually before reporting."
sources:
  - https://www.bugcrowd.com/blog/the-ultimate-beginners-guide-to-nuclei/
  - https://doc.nucleisys.com/nuclei_sdk/quickstart.html
  - https://www.vaadata.com/en/blog/introduction-to-nuclei-an-open-source-vulnerability-scanner/
  - https://projectdiscovery.io/blog/ultimate-nuclei-guide
  - https://gist.github.com/E1A/6755b0e74a55cf9dcd8c133c5bf6e990
  - https://hackviser.com/tactics/tools/nuclei
  - https://bishopfox.com/blog/nuclei-vulnerability-scan
  - https://raxis.com/blog/cool-tools-series-nuclei/
  - https://csf.tools/reference/critical-security-controls/version-7-1/csc-20/
  - https://hackercoolmagazine.com/beginners-guide-to-nuclei-vulnerability-scanner/?srsltid=AfmBOorZBd0UvoYgqJPeZBxyXWan0mC1UOrN_d7uu-lutL9Dk88mx5Fj
  - https://orca.security/resources/blog/using-nuclei-templates-for-vulnerability-scanning/
  - https://github.com/projectdiscovery/nuclei
generated_at: 2026-05-19T10:56:56.618Z
generated_by: anthropic
source_hash: 79a3333a0b62d99955ff355dd5627373b110b2640e0c15793c59908fddf1dcda
---

# Nuclei

## Overview

Nuclei (v3.7.1) is an open-source scanning engine that uses YAML templates to detect vulnerabilities, misconfigurations, and exposed services. It supports multiple protocols (HTTP, DNS, TCP, SSL, WebSocket, Headless) and is backed by a large community-driven template library. The engine performs request clustering—if multiple templates need the same HTTP request, Nuclei makes one request and shares the response, drastically reducing scan time. Templates define multi-step checks that minimize false positives by simulating real exploit conditions.

## When to use

Use Nuclei for initial reconnaissance of web applications, APIs, and network services to identify low-hanging fruit and known vulnerabilities. Deploy it when you need to validate specific CVEs across many hosts, check for common misconfigurations (exposed panels, default credentials, sensitive files), or perform technology fingerprinting. Ideal for continuous scanning in CI/CD pipelines to catch regressions. Not a replacement for manual testing—use findings as starting points for deeper investigation. Effective when combined with subdomain enumeration (subfinder) and HTTP probing (httpx) in automated workflows.

## Authentication & setup

Nuclei is installed at `/opt/tools/bin/nuclei`. Templates auto-download on first run and are stored locally. Update templates with `nuclei -update-templates` or the tool itself with `nuclei -update`. No authentication is required for basic scans. For authenticated scans, use custom templates with session cookies or headers. To use custom or local templates, specify with `-t /path/to/template.yaml` or `-t /path/to/directory/`. Filter templates by tags (e.g., `-tags cve,apache`) or severity (e.g., `-severity critical,high`). List all available templates with `-tl`. Set custom User-Agent with `-H 'User-Agent: <value>'`. Use `-r <resolvers.txt>` for custom DNS resolvers.

## Key commands / parameters

`nuclei -u <URL>` – scan single target
`nuclei -l <targets.txt>` – scan multiple targets from file
`nuclei -t <template>` – use specific template or directory (e.g., `-t cves/` or `-t http/misconfiguration/`)
`nuclei -tags <tag1,tag2>` – filter templates by tag (e.g., `cve`, `rce`, `lfi`, `apache`)
`nuclei -severity <level>` – filter by severity: info, low, medium, high, critical
`nuclei -o <output.txt>` – save results to file
`nuclei -json` – output in JSON format
`nuclei -silent` – suppress banner and progress, show only findings
`nuclei -v` – verbose mode for debugging
`nuclei -rl <num>` – rate limit requests per second
`nuclei -timeout <sec>` – request timeout (default varies)
`nuclei -exclude <file.yaml>` – exclude specific templates
`nuclei -resume <session.json>` – resume interrupted scan
`nuclei -tl` – list all available templates
`nuclei -update-templates` – update template library

## Example workflows

**Basic scan:** `/opt/tools/bin/nuclei -u https://target.com`
**Scan list of hosts:** `/opt/tools/bin/nuclei -l targets.txt -o results.txt`
**CVE-only scan:** `/opt/tools/bin/nuclei -u https://target.com -tags cve -severity critical,high`
**Technology fingerprinting:** `/opt/tools/bin/nuclei -u https://target.com -tags tech -silent`
**Scan specific service:** `/opt/tools/bin/nuclei -u target.com:8080`
**Integrated workflow:** `subfinder -d target.com -silent | httpx -silent | nuclei -tags cve,exposure -o findings.txt`
**Test for specific CVE:** `/opt/tools/bin/nuclei -u https://target.com -t ~/nuclei-templates/cves/2023/CVE-2023-XXXX.yaml`
**Rate-limited scan:** `/opt/tools/bin/nuclei -l targets.txt -rl 10 -severity high,critical -json -o results.json`
**Default credential check:** `/opt/tools/bin/nuclei -u https://target.com -tags default-login`

## Output format

Standard output format: `[template-id] [protocol] [severity] <impacted-target>`
Example: `[robots-txt-endpoint] [http] [info] https://example.com/robots.txt`
Silent mode (`-silent`) shows only findings, no banner or progress. Verbose mode (`-v`) adds request/response details and template loading info. JSON output (`-json`) provides structured data with fields: template-id, info (name, severity, tags), type, host, matched-at, extracted-results, timestamp, matcher-name. Use `-jsonl` for JSON Lines format (one object per line). Output to file with `-o` appends results; combine with `-resume` to continue interrupted scans. Severity levels: info, low, medium, high, critical. Results include the matched template ID for easy reference to template details.

## Common pitfalls

**Rate limiting / WAF blocks:** Nuclei can be aggressive; use `-rl` to throttle requests. Default concurrency may trigger IDS/IPS; adjust with `-c` (concurrency) and `-bulk-size`. **Outdated templates:** Always run `-update-templates` before engagements to detect latest CVEs. **Noisy scans:** Without filtering, Nuclei runs thousands of templates; use `-tags` or `-severity` to focus. **False sense of completeness:** Nuclei detects known issues only; zero findings ≠ secure. Manual testing is essential. **Scope violations:** Nuclei will scan any reachable URL; ensure your target list is in-scope. **Over-reliance on default templates:** Custom environments may need custom templates. **Ignoring output:** Review findings; some 'info' severity results (tech detection, exposed files) are high-value recon. **Credential testing ethics:** Default-login templates may trigger account lockouts; understand target policies. **Verbose output overload:** `-v` generates massive logs; use sparingly or redirect to file.

## References

• https://www.bugcrowd.com/blog/the-ultimate-beginners-guide-to-nuclei/
• https://projectdiscovery.io/blog/ultimate-nuclei-guide
• https://github.com/projectdiscovery/nuclei
• https://gist.github.com/E1A/6755b0e74a55cf9dcd8c133c5bf6e990
• https://hackviser.com/tactics/tools/nuclei
• https://bishopfox.com/blog/nuclei-vulnerability-scan
• https://raxis.com/blog/cool-tools-series-nuclei/
• https://hackercoolmagazine.com/beginners-guide-to-nuclei-vulnerability-scanner/
• https://orca.security/resources/blog/using-nuclei-templates-for-vulnerability-scanning/
