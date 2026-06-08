---
name: Nuclei
description: Fast YAML template-driven vulnerability scanner for web apps, APIs,
  cloud infrastructure, and network services with zero false positives.
registry: security
tool_id: nuclei
category: vulnerability_scanning
tags:
  - vulnerability-scanning
  - template-based
  - web-security
  - cve-detection
  - misconfiguration
  - offensive-security
  - automation
mitre_techniques:
  - T1046
  - T1595.002
  - T1190
summary: "Nuclei is a template-driven vulnerability scanner that detects CVEs,
  misconfigurations, and exposed services across HTTP(S), TCP, DNS, SSL, and
  other protocols. Use it after reconnaissance to systematically check for known
  vulnerabilities, technology fingerprints, default credentials, and security
  issues. Templates are YAML-based and maintained by a large community; the tool
  performs request clustering to minimize network traffic. Invoke with `nuclei
  -u <target>` for single targets or `nuclei -l <file>` for bulk scanning.
  Filter templates using `-t <path>` (specific template/directory) or `-tags
  <tagname>` (e.g., cve, exposure, cloud). Output is line-based: [template-id]
  [protocol] [severity] <target>. Use `-o <file>` to save results, `-json` for
  machine-readable output, `-silent` to suppress console noise. Critical flags:
  `-rl <num>` (rate limit), `-timeout <sec>`, `-v` (verbose), `-exclude <file>`
  (skip templates). Templates live in ~/nuclei-templates/ by default; run
  `nuclei -update-templates` to refresh. Nuclei excels at CVE detection when PoC
  exists, technology enumeration (frameworks, servers, APIs), and default
  credential testing. Integrate into workflows via pipes (subfinder → httpx →
  nuclei). Expect output immediately on match; no output means no detections.
  Template clustering means one HTTP GET to /login.php serves 5 templates
  needing that request. Watch for rate limiting on targets; use `-rl` to
  throttle. Results are actionable: severity flagged
  (info/low/medium/high/critical), and successful exploits (e.g., Log4j RCE)
  clearly marked. Custom templates extend functionality for recon or bespoke
  checks. Tool is dual-use: defenders scan assets, attackers find
  exploits—assume targets may detect/block Nuclei traffic. No authentication
  required for tool itself; templates handle target auth if needed. Designed for
  integration: accepts stdin, outputs parseable formats, resumes scans with
  `-resume`. Verbose mode (-v) shows requests/responses; silent mode hides
  progress. Use `-health` to verify installation. Store HTTP traffic with
  `--store-requests` for forensics. Community templates cover 12K+ checks;
  always update before engagements."
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
  - https://orca.security/resources/blog/using-nuclei-templates-for-vulnerability-scanning/
  - https://projectdiscovery.io/nuclei
generated_at: 2026-05-19T11:24:54.174Z
generated_by: anthropic
source_hash: 9a78918036dff427fdbd7c1972e0bab12c0681e1f3ff6da381493f1ff87b3b29
---

# Nuclei

## Overview

Nuclei v3.8.0 is an open-source vulnerability scanner that uses YAML templates to define HTTP, DNS, TCP, SSL, and other protocol-based security checks. It detects CVEs, misconfigurations, exposed services, default credentials, and technology stacks. The engine performs request clustering (batching identical requests across templates) to reduce network load. Templates are community-maintained with 12K+ checks covering web apps, cloud, APIs, and infrastructure. Output is immediate and actionable with severity ratings. Designed for integration into security workflows via stdin/stdout piping.

## When to use

Use Nuclei after initial reconnaissance (subdomain enumeration, port scanning, service identification) to systematically probe for known vulnerabilities and misconfigurations. Ideal for: detecting recently published CVEs with PoC templates; fingerprinting technologies, frameworks, and server versions; testing for default credentials; finding sensitive files (robots.txt, config files, logs); validating patch status across multiple hosts; external and internal penetration testing. Integrate into automation pipelines to scan discovered assets at scale. Run targeted scans with specific template tags (e.g., `-tags cve,exposure`) when hunting particular issue classes. Use custom templates for repetitive checks unique to your target environment.

## Authentication & setup

No authentication required for the Nuclei binary itself. Install on Kali with `apt install nuclei` or download from GitHub releases. Templates are stored in ~/nuclei-templates/ by default. Run `nuclei -update-templates` before engagements to fetch latest CVE and vulnerability checks from the community repository. For targets requiring authentication, templates can embed credentials or session tokens in YAML—check template documentation. No API keys or registration needed. Verify installation with `nuclei -version` and `nuclei -health`. If targets use custom DNS, specify resolvers with `-r resolvers.txt`. Set user-agent with `-ua "CustomUserAgent"` to blend traffic or match policy requirements.

## Key commands / parameters

**Basic invocation:**
`nuclei -u <target>` — scan single URL/host
`nuclei -u <host:port>` — scan non-HTTP services
`nuclei -l targets.txt` — scan multiple targets from file
`nuclei -stdin` — accept targets from stdin (for piping)

**Template control:**
`-t <path>` — use specific template file or directory (e.g., `-t ~/nuclei-templates/cves/`)
`-tags <tag1,tag2>` — filter by tags (e.g., `-tags cve,exposure,log4j`)
`-exclude <file>` — skip templates listed in file
`-update-templates` — refresh template library

**Output:**
`-o <file>` — write results to file
`-json` — output in JSON format
`-silent` — suppress progress, show only findings
`-v` — verbose mode (show requests/responses)
`-stats` — display scan statistics

**Performance:**
`-rl <num>` — rate limit requests/sec (e.g., `-rl 10`)
`-timeout <sec>` — request timeout (default varies)
`-c <num>` — concurrency level

**Advanced:**
`-resume <file>` — resume interrupted scan from state file
`--store-requests` — save HTTP requests/responses to disk
`-health` — verify tool health
`-version` — show version
`-h` — help menu

## Example workflows

**1. Single target full scan:**
`nuclei -u https://example.com -o results.txt`

**2. Scan for CVEs only:**
`nuclei -u https://example.com -tags cve -silent`

**3. Bulk scan from subdomain enumeration:**
`subfinder -d target.com -silent | httpx -silent | nuclei -tags cve,exposure -o findings.txt`

**4. Technology fingerprinting:**
`nuclei -l hosts.txt -tags tech -json -o tech_stack.json`

**5. Test specific CVE across targets:**
`nuclei -l targets.txt -t ~/nuclei-templates/cves/2021/CVE-2021-44228.yaml -rl 5`

**6. Internal network misconfiguration scan:**
`nuclei -l internal_hosts.txt -tags config,default-login -v -o internal_issues.txt`

**7. Resume interrupted scan:**
`nuclei -l large_list.txt -resume scan_state.json`

**8. Rate-limited external pentest:**
`nuclei -u https://client.com -tags cve,exposure -rl 3 -timeout 10 -silent`

**9. Custom template test:**
`nuclei -u https://target.com -t custom_check.yaml -v`

**10. Cloud asset scan:**
`nuclei -l cloud_endpoints.txt -tags cloud,aws,azure -json -o cloud_vulns.json`

## Output format

Default output is line-based, human-readable:
`[template-id] [protocol] [severity] <impacted-target>`

Example:
`[CVE-2021-44228] [http] [critical] https://vulnerable.com/api`
`[robots-txt-endpoint] [http] [info] https://example.com/robots.txt`

Severity levels: info, low, medium, high, critical. Critical findings (RCE, auth bypass) flagged explicitly. No output means no matches—templates only print on positive detection. With `-json`, output is newline-delimited JSON objects with fields: template-id, matched-at, severity, tags, extracted-results. Use `-o <file>` to redirect results; combine with `-silent` to suppress progress bars and stats. Verbose mode (`-v`) shows full HTTP request/response pairs. Statistics summary printed at end unless `-silent` is used. Machine-readable formats enable downstream parsing for ticketing, dashboards, or further automation.

## Common pitfalls

**1. Outdated templates:** Always run `-update-templates` before scans; new CVE templates released daily.
**2. Rate limiting / WAF blocks:** Default concurrency can trigger defenses; use `-rl <num>` to throttle and `-timeout` to handle slow responses.
**3. Scope creep:** Nuclei follows redirects and may hit out-of-scope domains; validate target lists carefully.
**4. False sense of coverage:** Templates only detect known issues with existing PoCs; does not replace manual testing or custom exploit development.
**5. Noisy scans:** Tool generates significant HTTP traffic; targets with IDS/IPS will detect and may block source IP. Use `-silent` to reduce log verbosity, not network noise.
**6. Dual-use risk:** Attackers use Nuclei for exploit discovery; ensure defensive scanning is authorized and targets are isolated from production if testing destructive templates.
**7. Template selection:** Running all templates indiscriminately wastes time; use `-tags` to focus on relevant categories (cve, exposure, config).
**8. JSON parsing:** Default output is not valid JSON; must use `-json` flag for structured data.
**9. Ignoring severity:** Info-level findings (tech fingerprints) are low-risk but guide further exploitation; don't discard them in recon phase.
**10. No result handling:** Successful exploit templates (e.g., Log4j RCE) report match but don't execute shells; manually follow up critical findings for validation.

## References

• https://www.bugcrowd.com/blog/the-ultimate-beginners-guide-to-nuclei/
• https://projectdiscovery.io/blog/ultimate-nuclei-guide
• https://gist.github.com/E1A/6755b0e74a55cf9dcd8c133c5bf6e990
• https://hackviser.com/tactics/tools/nuclei
• https://bishopfox.com/blog/nuclei-vulnerability-scan
• https://raxis.com/blog/cool-tools-series-nuclei/
• https://orca.security/resources/blog/using-nuclei-templates-for-vulnerability-scanning/
• https://projectdiscovery.io/nuclei
• https://www.vaadata.com/en/blog/introduction-to-nuclei-an-open-source-vulnerability-scanner/
