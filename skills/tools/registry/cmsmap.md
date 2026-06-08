---
name: Cmsmap
description: Python CMS scanner automating detection of WordPress, Joomla,
  Drupal, and Moodle vulnerabilities and misconfigurations.
registry: registry
tool_id: cmsmap
category: cms
tags:
  - cms
  - wordpress
  - joomla
  - drupal
  - vulnerability-scanner
  - enumeration
  - recon
  - web
mitre_techniques:
  - T1595.002
  - T1190
  - T1110.001
  - T1078
summary: CMSmap automates security enumeration and vulnerability detection for
  WordPress, Joomla, Drupal, and Moodle installations. Invoke with
  `/usr/local/bin/cmsmap <target_url>` for automatic CMS detection, or force
  specific CMS with `-f W/J/D`. Tool enumerates CMS version, themes, plugins,
  known vulnerabilities (searches exploit databases by default), configuration
  files, users, and directory listings. Use `-F` for aggressive full scan with
  large plugin wordlists (slow, high false positives). Thread count defaults to
  5; adjust with `-t`. Supports dictionary attacks (`-d` for 5 attempts per user
  during scan, or full brute-force with `-u <user>` and `-p <password>`).
  WordPress brute-force uses XML-RPC by default; disable with `-x`. For multiple
  targets, use `-i <file>`. Save results with `-o <file>`. Disable exploit DB
  lookups with `-E` for faster enumeration-only mode. Set custom User-Agent with
  `-a` or headers with `-H`. Disable SSL validation with `-s` (use for
  self-signed certs). Expect high false-positive rates on full scans; manually
  validate findings. Output is text-based with sections for CMS details,
  vulnerable components, interesting files, and directory listings. Tool stops
  at identification—does not exploit or remediate. Best for mature security
  teams conducting external reconnaissance or red team initial access phases on
  known CMS targets.
sources:
  - https://github.com/dionach/CMSmap
  - https://cybersectools.com/tools/cmsmap
  - https://www.geeksforgeeks.org/linux-unix/cmsmap-open-source-cms-scanner/
  - https://cybersectools.com/compare/awvs-vs-cmsmap
  - https://latesthackingnews.com/2018/12/23/cmsmap-an-open-source-cms-scanner/
  - https://www.cisco.com/c/dam/en/us/td/docs/conferencing/ciscoMeetingServer/Reference_Guides/Version-3-7/Cisco-Meeting-Server-MMP-Command-Reference-3-7.pdf
  - https://craftcms.com/docs/5.x/system/cli.html
  - https://www.cycognito.com/learn/red-teaming/red-teaming-vs-pentesting/
  - https://www.offsec.com/blog/red-teaming-vs-pentesting/
  - https://evalian.co.uk/penetration-testing-vs-red-team-testing/
  - https://www.cycognito.com/learn/penetration-testing/
  - https://canarytrap.com/blog/penetration-testing-tools-unpacked/
generated_at: 2026-05-19T11:20:35.162Z
generated_by: anthropic
source_hash: ddc0960e83c4740eca9edf7d28197314735ca44805fa7ec2e550cb157d37e02b
---

# Cmsmap

## Overview

CMSmap v1.0 is a Python-based open-source scanner targeting the most popular Content Management Systems: WordPress, Joomla, Drupal, and Moodle. It automates reconnaissance by fingerprinting CMS versions, enumerating themes and plugins, identifying known vulnerabilities via exploit database correlation, discovering backup/config files, listing valid usernames, and performing optional dictionary or brute-force authentication attacks. The tool combines passive fingerprinting with active probing, providing a consolidated view of CMS attack surface within red team or penetration testing engagements.

## When to use

Use CMSmap during initial external reconnaissance or red team enumeration when you identify or suspect a target is running WordPress, Joomla, Drupal, or Moodle. Deploy it to quickly enumerate CMS version, installed themes/plugins, known CVEs, and valid usernames before manual exploitation. Ideal for time-boxed assessments where automated CMS enumeration accelerates vulnerability identification. Suitable for both single-target deep dives and multi-target sweeps via input file. Do NOT use when you need post-exploitation capabilities, remediation guidance, or SIEM integration—CMSmap identifies issues but does not exploit beyond authentication brute-forcing or provide mitigation steps. Skip this tool if stealth is paramount; aggressive scanning modes generate significant HTTP traffic and may trigger WAF/IDS alerts.

## Authentication & setup

No authentication configuration required for basic scanning. CMSmap operates unauthenticated against target CMS installations. For brute-force attacks, supply credentials via `-u <username|file>` and `-p <password|file>` flags. WordPress brute-force defaults to XML-RPC; disable with `-x` to use standard login forms. For targets behind authentication proxies or requiring specific headers, use `-H 'Authorization: Basic <token>'` or similar. Self-signed certificates will fail validation; bypass with `-s` flag. Custom User-Agent strings can be set with `-a` to evade basic fingerprinting defenses. Tool requires Python runtime; first execution auto-installs dependencies. No API keys or service accounts needed. For multi-target operations, prepare newline-delimited URL list and reference with `-i <file>`.

## Key commands / parameters

`/usr/local/bin/cmsmap <target_url>` — automatic CMS detection and enumeration.
`-f W/J/D` — force scan WordPress (W), Joomla (J), or Drupal (D) without auto-detection.
`-F` — full scan using large plugin/theme wordlists (slow, high false-positive rate).
`-t <num>` — set thread count (default 5); increase for faster scans, decrease if rate-limited.
`-a <string>` — set custom User-Agent header.
`-H <header>` — add custom HTTP header (e.g., 'Authorization: Basic ...').
`-i <file>` — scan multiple targets from file (one URL per line).
`-o <file>` — save output to file.
`-E` — enumerate plugins/themes without searching exploit databases (faster, enumeration-only).
`-c` — disable clean URLs for Drupal scanning (use if site uses query parameters).
`-s` — disable SSL certificate validation (required for self-signed certs).
`-d` — run low-intensity dictionary attack during scan (5 attempts per discovered user).
`-u <user|file>` — username or username file for brute-force.
`-p <pass|file>` — password or password file for brute-force.
`-x` — brute-force WordPress without XML-RPC (use standard login).
`-k <file>` — crack password hashes (requires hashcat; WordPress/Joomla only).
`-w <file>` — wordlist for hash cracking.
`-v` — verbose mode for debugging.

## Example workflows

**Basic reconnaissance**: `/usr/local/bin/cmsmap https://target.com` — auto-detect CMS and enumerate version, plugins, themes, users, vulnerabilities.

**Force WordPress scan with output**: `/usr/local/bin/cmsmap -f W -o results.txt https://target.com` — explicitly scan as WordPress, save findings.

**Aggressive plugin enumeration**: `/usr/local/bin/cmsmap -F -t 10 https://target.com` — full scan with 10 threads; expect longer runtime and false positives.

**Enumeration without exploit lookups**: `/usr/local/bin/cmsmap -E https://target.com` — faster scan skipping CVE correlation; useful for large target lists.

**Multi-target sweep**: `/usr/local/bin/cmsmap -i targets.txt -o results.txt` — scan all URLs in targets.txt, consolidate output.

**Dictionary attack during scan**: `/usr/local/bin/cmsmap -d https://target.com` — enumerate users and attempt 5 password attempts per user.

**Full brute-force**: `/usr/local/bin/cmsmap -u admin -p /usr/share/wordlists/rockyou.txt https://target.com` — brute-force 'admin' account with rockyou wordlist.

**WordPress brute-force without XML-RPC**: `/usr/local/bin/cmsmap -x -u users.txt -p pass.txt https://target.com` — use standard login form instead of XML-RPC endpoint.

**Custom header for authenticated proxy**: `/usr/local/bin/cmsmap -H 'Authorization: Bearer TOKEN' https://internal-cms.local` — inject custom auth header.

**Self-signed cert target**: `/usr/local/bin/cmsmap -s https://dev-cms.local` — bypass certificate validation.

## Output format

Text-based output organized into sections: (1) CMS identification (type, version, server details), (2) Themes and templates discovered, (3) Plugins/components with version numbers, (4) Known vulnerabilities with CVE/exploit references (if not using `-E`), (5) Interesting files (config backups, readme, license, etc.), (6) Valid usernames enumerated, (7) Directory listings exposed, (8) Brute-force results if attempted. Vulnerabilities list includes exploit types (SQLi, XSS, RCE) and links to exploit databases. When using `-o`, output is saved as plaintext file preserving section structure. Verbose mode (`-v`) adds HTTP requests/responses and debug information. No JSON, XML, or structured formats available—parse text output programmatically or manually review. Expect high noise in full-scan mode; findings require manual validation to filter false positives. Tool reports completed checks and skipped tests at end of output.

## Common pitfalls

**False positives in full scan mode**: `-F` flag uses large wordlists that generate many false plugin/theme detections; always manually verify findings before exploitation attempts. **Rate limiting and blocking**: aggressive threading or full scans trigger WAF/IDS; reduce threads with `-t 2` and avoid `-F` for stealthy ops. **XML-RPC brute-force detection**: WordPress XML-RPC brute-forcing is loud and often logged; use `-x` for slightly stealthier standard login attempts, but expect account lockouts. **Outdated vulnerability database**: tool relies on hardcoded exploit signatures; newer CVEs may not appear; cross-reference findings with current databases. **No stealth mode**: tool does not randomize timing, rotate user-agents automatically, or use proxy chains; combine with external traffic obfuscation if operational security matters. **Enumeration != exploitation**: CMSmap identifies issues but does not provide exploit payloads or post-exploitation capabilities; transition to Metasploit, WPScan, or manual exploitation for next steps. **Certificate validation failures**: self-signed or internal CAs cause connection failures; always use `-s` for lab/internal environments. **Dictionary attacks are noisy**: even `-d` low-intensity mode generates authentication logs; expect blue team visibility. **No remediation output**: tool lists vulnerabilities but provides no patching guidance or remediation priorities; manually correlate findings with vendor advisories.

## References

- https://github.com/dionach/CMSmap
- https://cybersectools.com/tools/cmsmap
- https://www.geeksforgeeks.org/linux-unix/cmsmap-open-source-cms-scanner/
- https://latesthackingnews.com/2018/12/23/cmsmap-an-open-source-cms-scanner/
