---
name: Joomscan
description: OWASP Joomla vulnerability scanner; detects version, components,
  CVEs, misconfigurations, and backup files in Joomla CMS deployments.
registry: registry
tool_id: joomscan
category: cms
tags:
  - cms
  - joomla
  - vulnerability-scanner
  - owasp
  - enumeration
  - component-detection
  - web-application
mitre_techniques:
  - T1595.002
  - T1190
  - T1589.002
summary: Joomscan is a Perl-based OWASP tool for automated Joomla CMS security
  assessment. Use when target is confirmed or suspected Joomla installation.
  Invoke as `/opt/tools/bin/joomscan --url <target>` (required); add
  `--enumerate-components` or `-ec` to discover installed plugins/extensions and
  known CVEs. Supports `--cookie`, `--user-agent`, `--random-agent`,
  `--timeout`. Outputs text and HTML reports showing Joomla version, firewall
  detection, common backup/log files, component enumeration, and vulnerability
  mappings. Default scan completes in seconds; component enumeration
  significantly slower (checks 1200+ components). Always use `--url` or `-u`
  with full URL including protocol. Tool may fail silently if target is not
  Joomla; fingerprinting can fail on heavily customized installs. Outputs
  verbose findings to terminal and optional files. Generates noise; not
  OPSEC-safe for red team stealth operations. Use `--random-agent` to avoid
  signature-based blocking. Reports include links to exploit-db and CVE
  references.
sources:
  - https://github.com/OWASP/joomscan/blob/master/README.md
  - https://github.com/OWASP/joomscan
  - https://hackviser.com/tactics/tools/joomscan
  - https://www.geeksforgeeks.org/linux-unix/joomscan-vulnerability-scanner-tool-in-kali-linux/
  - https://www.kali.org/tools/joomscan/
  - https://linuxconfig.org/use-joomscan-to-scan-joomla-for-vulnerabilities-on-kali
  - https://linuxsecurity.expert/tools/joomscan/
  - https://www.rapid7.com/blog/post/2016/06/23/penetration-testing-vs-red-teaming-the-age-old-debate-of-pirates-vs-ninja-continues/
  - https://pentestreports.com/tool/joomscan
  - https://docs.hacken.io/methodologies/red-team/
  - https://www.cycognito.com/learn/red-teaming/red-teaming-tools/
  - https://myexploit.wordpress.com/web-application-owasp-joomla-vulnerability-scanner/
generated_at: 2026-05-19T11:14:27.121Z
generated_by: anthropic
source_hash: a8d2c8da390ab73f8a0c6fefab96681cc82850139c44066d987c84f3862d5038
---

# Joomscan

## Overview

Joomscan (OWASP Joomla Vulnerability Scanner) is a lightweight Perl-based tool designed for vulnerability detection and security assessment of Joomla CMS installations. It automates version fingerprinting, component enumeration (1200+ popular extensions), vulnerability correlation based on version, firewall detection, and discovery of common backup files, log files, and misconfigurations. Reports generated in both text and HTML format.

## When to use

Use when web application is confirmed or strongly suspected to be Joomla CMS. Ideal during initial reconnaissance to fingerprint version and surface, enumerate plugins/components for known CVEs, detect security misconfigurations (.htaccess rules, directory listings), and locate backup files or logs. Appropriate for penetration tests and vulnerability assessments where comprehensive Joomla-specific checks are needed. Not suitable for stealth red team operations—generates significant HTTP traffic and predictable requests. Use after initial discovery phase confirms Joomla presence (e.g., via Wappalyzer, manual inspection of /administrator/, or /language/ paths).

## Authentication & setup

No authentication required for basic operation. Tool is pre-installed at `/opt/tools/bin/joomscan`. If authentication is needed to access Joomla site (e.g., behind login portal), use `--cookie <String>` flag to pass session cookie in format `name=value;name2=value2`. No configuration files or API keys needed. Ensure target is reachable and includes protocol (http:// or https://). Tool runs as unprivileged user; does not require root. Update capability exists via `--update` flag but may require network access to upstream repository.

## Key commands / parameters

`--url <URL>` or `-u <URL>`: (required) Target Joomla URL with protocol. Example: `--url https://example.com`
`--enumerate-components` or `-ec`: Enumerates installed components/extensions; checks against vulnerability database (1030+ exploits). Significantly increases scan time.
`--cookie <String>`: Set HTTP cookie for authenticated scans. Format: `sessionid=abc123;token=xyz`
`--user-agent <string>` or `-a <string>`: Custom User-Agent header.
`--random-agent` or `-r`: Randomize User-Agent to evade basic signature detection.
`--timeout <seconds>`: Set HTTP request timeout (useful for slow/unstable targets).
`--help` or `-h`: Display help menu.
`--version`: Show tool version.
`--update`: Update to latest version from repository.
`--about`: Display author information.

## Example workflows

**Basic scan for version and vulnerabilities:**
`/opt/tools/bin/joomscan --url https://target.com`
Outputs Joomla version, firewall detection, backup file checks, and known CVEs.

**Full enumeration with components:**
`/opt/tools/bin/joomscan -u https://target.com --enumerate-components`
Adds component discovery (slow; may take several minutes) and component-specific CVEs.

**Authenticated scan with custom User-Agent:**
`/opt/tools/bin/joomscan --url https://target.com --cookie "PHPSESSID=abc123" --random-agent`
Uses session cookie to access protected areas and randomizes User-Agent.

**Scan with increased timeout for slow target:**
`/opt/tools/bin/joomscan -u http://slow-target.com --timeout 10`
Prevents premature timeouts on high-latency or rate-limited targets.

**Typical red team recon chain:**
1. Confirm Joomla via `curl -s https://target.com | grep -i joomla`
2. Run basic scan: `/opt/tools/bin/joomscan -u https://target.com -r`
3. If vulnerabilities found, enumerate components: `/opt/tools/bin/joomscan -u https://target.com -ec -r`
4. Parse output for exploitable CVEs, backup files, or directory listings.

## Output format

Outputs to terminal (stdout) with structured sections:
- **Joomla version fingerprint**: Core version number or "Unable to detect" if heavily customized.
- **Firewall detection**: Identifies mod_rewrite rules, WAF presence (checks for 403 responses to common payloads like base64_encode, GLOBALS).
- **Common files**: Lists discovered backup files (.zip, .tar.gz, .sql), log files, configuration backups (configuration.php~).
- **Vulnerabilities**: CVE IDs, affected versions, exploit-db links.
- **Component enumeration** (if `-ec` used): Installed components with version and known exploits.
- **Directory listings**: Exposed directories (e.g., /tmp/, /images/).

Optional report generation in text and HTML formats (flags not documented in canonical usage but referenced in source). Reports include clickable CVE/exploit links. Terminal output is verbose; grep for "Vulnerability", "Component", or "Exploit" to filter actionable findings.

## Common pitfalls

**Target is not Joomla**: Tool may fail silently or output "Unable to detect version." Always verify Joomla presence first (check /administrator/ path, view-source for Joomla meta tags).
**Missing protocol in URL**: Command requires `http://` or `https://`—will fail if omitted.
**Component enumeration is slow**: `-ec` flag sends 1200+ HTTP requests; can take 10–30 minutes on slow connections. Use only when needed.
**Firewall/WAF blocking**: Generates predictable requests (e.g., /administrator/manifests/files/joomla.xml). Use `--random-agent` and consider proxying through tools like Burp. High-security targets may block or rate-limit.
**False negatives on custom installs**: Heavily modified Joomla installations (custom admin paths, renamed files) may evade fingerprinting.
**Noisy for OPSEC**: Generates logs in web server access logs with obvious scanner signatures. Not suitable for covert red team operations.
**No proxy support documented**: Canonical flags do not include proxy option, despite some sources mentioning `-x proxy:port` (may be version-dependent).
**Outdated vulnerability database**: Use `--update` before engagements to ensure latest CVE mappings.

## References

- https://github.com/OWASP/joomscan
- https://github.com/OWASP/joomscan/blob/master/README.md
- https://www.kali.org/tools/joomscan/
- https://linuxconfig.org/use-joomscan-to-scan-joomla-for-vulnerabilities-on-kali
- https://hackviser.com/tactics/tools/joomscan
- https://www.geeksforgeeks.org/linux-unix/joomscan-vulnerability-scanner-tool-in-kali-linux/
- https://linuxsecurity.expert/tools/joomscan/
- https://pentestreports.com/tool/joomscan
